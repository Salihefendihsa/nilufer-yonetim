/**
 * Demo veride ödeme ↔ iş tutarlılığı (docs/HEALTH_AUDIT.md V-3).
 *
 * seedDemo'nun 24 aylık gelir trendi için ürettiği ödemeler müşterilere
 * işlerden bağımsız dağıtılıyordu: müşteriler fatura edilenin katlarını
 * ödemiş görünüyor, bakiyeler negatife düşüyordu.
 *
 * Çözüm (hiçbir ödeme/iş silinmez, gelir trendi aynen kalır): her müşterinin
 * ödemeleri kronolojik sırayla, ödeme tarihinden ÖNCEKİ borca yazılan
 * işlerine (iptaller hariç) FIFO eşlenir. Bir ödemenin karşılanmayan kısmı
 * için ödeme gününe o tutarda TAMAMLANMIŞ bir iş oluşturulur — yani her
 * tahsilatın arkasında yapılmış bir hizmet olur ve bakiye ≥ 0 kalır
 * (= henüz ödenmemiş işler). İdempotent: ikinci çalıştırmada iş eklemez.
 *
 *   npx ts-node prisma/demoConsistency.ts            → kuru çalıştırma
 *   npx ts-node prisma/demoConsistency.ts --apply    → uygular
 * seedDemo.ts sonunda otomatik çağrılır.
 */
import { JobStatus, PrismaClient, Role } from "@prisma/client";

const FALLBACK_SERVICE_TYPES = ["Genel Haşere İlaçlama", "Hamamböceği İlaçlama", "Karınca İlaçlama", "Fare ve Kemirgen Kontrolü"];

export interface BackfillResult {
  customersFixed: number;
  jobsCreated: number;
  amountBackfilled: number;
}

/** `customerIds`: testlerde yalnızca test müşterilerini işlemek için (dev verisine dokunmamak adına). */
export async function backfillJobsForUncoveredPayments(
  prisma: PrismaClient,
  opts: { apply: boolean; customerIds?: string[] }
): Promise<BackfillResult> {
  const [customers, fieldStaff, serviceTypeRows] = await Promise.all([
    prisma.customer.findMany({
      where: opts.customerIds ? { id: { in: opts.customerIds } } : undefined,
      select: {
        id: true,
        jobs: { where: { status: { not: JobStatus.CANCELLED } }, select: { price: true, completedAt: true, scheduledAt: true, createdAt: true } },
        payments: { select: { amount: true, createdAt: true, collectedByStaffId: true }, orderBy: { createdAt: "asc" } },
      },
    }),
    prisma.staff.findMany({
      where: { archivedAt: null, user: { role: { in: [Role.STAFF, Role.TEAM_LEAD] }, isActive: true } },
      select: { id: true },
      orderBy: { id: "asc" },
    }),
    prisma.serviceType.findMany({ where: { isActive: true }, select: { name: true }, orderBy: { name: "asc" } }).catch(() => [] as { name: string }[]),
  ]);
  const serviceTypes = serviceTypeRows.length ? serviceTypeRows.map((s) => s.name) : FALLBACK_SERVICE_TYPES;

  const result: BackfillResult = { customersFixed: 0, jobsCreated: 0, amountBackfilled: 0 };
  let rr = 0; // personel / hizmet türü için deterministik sıra

  for (const customer of customers) {
    // Borç kalemleri: işin gerçekleştiği tarih + kalan (henüz ödenmemiş) tutar
    const debts = customer.jobs
      .map((j) => ({ at: (j.completedAt ?? j.scheduledAt ?? j.createdAt).getTime(), left: Number(j.price ?? 0) }))
      .filter((d) => d.left > 0)
      .sort((a, b) => a.at - b.at);

    const toCreate: { at: Date; amount: number; staffId: string | null }[] = [];
    for (const payment of customer.payments) {
      let remaining = Number(payment.amount);
      for (const d of debts) {
        if (remaining <= 0.005) break;
        if (d.at > payment.createdAt.getTime() || d.left <= 0.005) continue;
        const used = Math.min(d.left, remaining);
        d.left -= used;
        remaining -= used;
      }
      if (remaining > 0.005) toCreate.push({ at: payment.createdAt, amount: Math.round(remaining * 100) / 100, staffId: payment.collectedByStaffId });
    }
    if (toCreate.length === 0) continue;

    result.customersFixed++;
    result.jobsCreated += toCreate.length;
    result.amountBackfilled += toCreate.reduce((s, x) => s + x.amount, 0);
    if (!opts.apply) continue;

    for (const item of toCreate) {
      // Hizmet ödemeden birkaç saat önce yapılmış olsun.
      const completedAt = new Date(item.at.getTime() - 3 * 3600 * 1000);
      const staffId = item.staffId ?? (fieldStaff.length ? fieldStaff[rr % fieldStaff.length].id : null);
      await prisma.job.create({
        data: {
          customerId: customer.id,
          assignedStaffId: staffId,
          serviceType: serviceTypes[rr % serviceTypes.length],
          status: JobStatus.COMPLETED,
          scheduledAt: completedAt,
          startedAt: new Date(completedAt.getTime() - 90 * 60 * 1000),
          completedAt,
          price: item.amount,
          createdAt: new Date(completedAt.getTime() - 3 * 24 * 3600 * 1000),
        },
      });
      rr++;
    }
  }
  result.amountBackfilled = Math.round(result.amountBackfilled * 100) / 100;
  return result;
}

if (require.main === module) {
  const prisma = new PrismaClient();
  const apply = process.argv.includes("--apply");
  backfillJobsForUncoveredPayments(prisma, { apply })
    .then((r) => {
      console.log(
        `${apply ? "Uygulandı" : "Kuru çalıştırma"}: ${r.customersFixed} müşteri, ${r.jobsCreated} geçmiş iş, ${r.amountBackfilled.toLocaleString("tr-TR")} ₺ karşılanmamış ödeme${apply ? "" : " (uygulamak için --apply)"}`
      );
    })
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}

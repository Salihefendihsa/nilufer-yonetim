/**
 * KALICI demo/gösterim verisi — prisma/seed.ts'teki temel hesaplar/referans
 * verisinin (rol başına 1 kullanıcı, 6 hizmet türü vb.) ÜZERİNE, sistemi
 * müşteriye/yatırımcıya gösterirken dolu ve gerçekçi görünmesi için ekler.
 * seed.ts'in aksine bu script test/geliştirme temizliği kapsamında
 * SİLİNMEK ÜZERE tasarlanmadı — bkz. PROJECT_HANDOFF_TR.md.
 *
 * Çalıştırma: `npm run db:seed:demo` (önce `npm run db:seed` çalışmış,
 * temel hesaplar/hizmet türleri/ilçeler var olmalı).
 *
 * Güvenli tekrar çalıştırma: her bölüm kendi tablosunun mevcut satır
 * sayısını kontrol eder; hedef eşiğe zaten ulaşılmışsa o bölüm atlanır
 * (log'da "zaten yeterli ... var, atlanıyor" görünür) — script'i yanlışlıkla
 * ikinci kez çalıştırmak veri yığını/mükerrer kayıt oluşturmaz. İsimle
 * bulunabilen tekil kayıtlar (Product, CustomerTag, EvaluationCriterion,
 * Supplier) `findFirst`/`upsert` ile zaten idempotenttir.
 */
import {
  PrismaClient,
  JobStatus,
  RecurrenceType,
  ProductCategory,
  ComplaintStatus,
  ComplaintPriority,
  EvaluationStatus,
  StaffBonusStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(randomInt(8, 17), randomItem([0, 15, 30, 45]), 0, 0);
  return d;
}

function dateOnly(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function main() {
  console.log("Demo veri seed'i başlıyor...");

  // ── Ön koşullar: seed.ts'in oluşturduğu temel hesaplar/referans verisi ──
  const owner = await prisma.user.findUniqueOrThrow({ where: { email: "owner@nilufer.com" } });
  const manager = await prisma.user.findUniqueOrThrow({ where: { email: "manager@nilufer.com" } });
  const teamLead = await prisma.user.findUniqueOrThrow({ where: { email: "ekiplideri@nilufer.com" } });
  const teamLeadStaff = await prisma.staff.findUniqueOrThrow({ where: { userId: teamLead.id } });
  const staffUsers = await prisma.user.findMany({
    where: { email: { in: ["personel1@nilufer.com", "personel2@nilufer.com", "personel3@nilufer.com", "personel4@nilufer.com", "personel5@nilufer.com"] } },
  });
  const staffRows = await prisma.staff.findMany({ where: { userId: { in: staffUsers.map((u) => u.id) } } });
  const allFieldStaff = [teamLeadStaff, ...staffRows];
  const districts = (await prisma.district.findMany()).map((d) => d.name);
  const serviceTypes = (await prisma.serviceType.findMany()).map((s) => s.name);
  if (districts.length === 0 || serviceTypes.length === 0 || allFieldStaff.length === 0) {
    throw new Error("Önce `npm run db:seed` çalıştırılmalı (temel hesaplar/ilçeler/hizmet türleri bulunamadı).");
  }

  // ── Bazı hizmet türlerine garanti süresi (Bölüm Y) — demo işlerdeki
  // warrantyExpiresAt'in anlamlı görünmesi için. ──
  await prisma.serviceType.updateMany({
    where: { name: "Genel Haşere İlaçlama" },
    data: { defaultWarrantyDays: 30 },
  });
  await prisma.serviceType.updateMany({
    where: { name: "Fare ve Kemirgen Kontrolü" },
    data: { defaultWarrantyDays: 90 },
  });

  // ── Tedarikçiler (Bölüm E) — ProductBatch.supplierId için ──
  const supplierDefs = [
    { name: "Marmara Kimya Dağıtım A.Ş.", contactPerson: "Serdar Yıldırım", phone: "0224 444 10 10", email: "siparis@marmarakimya.com" },
    { name: "Anadolu Haşere Ürünleri Ltd. Şti.", contactPerson: "Nazlı Ergün", phone: "0224 444 20 20", email: "info@anadoluhasere.com" },
    { name: "Bursa Sarf Malzeme Toptan", contactPerson: "Kaya Aksu", phone: "0224 444 30 30", email: "satis@bursasarf.com" },
  ];
  const suppliers = [];
  for (const def of supplierDefs) {
    const existing = await prisma.supplier.findFirst({ where: { name: def.name } });
    suppliers.push(existing ?? (await prisma.supplier.create({ data: def })));
  }
  console.log(`${suppliers.length} tedarikçi hazır.`);

  // ══════════════════════════════════════════════════════════════════════
  // ÜRÜNLER — en az 20 ürün (mevcut 6 + yeni ~15)
  // ══════════════════════════════════════════════════════════════════════
  const newProductDefs: { code: string; name: string; unit: string; description: string; category: ProductCategory; currentStock: number; criticalThreshold: number }[] = [
    { code: "INS-410", name: "Cypermethrin 25 EC", unit: "Litre", description: "Geniş spektrumlu piretroid insektisit konsantresi", category: ProductCategory.BIOCIDAL, currentStock: 22, criticalThreshold: 6 },
    { code: "ROD-108", name: "Fare Zehiri Granül (Bromadiolon)", unit: "Kg", description: "İkinci nesil antikoagülan kemirgen yemi, granül", category: ProductCategory.BIOCIDAL, currentStock: 14, criticalThreshold: 5 },
    { code: "INS-415", name: "Deltamethrin WP 25", unit: "Kg", description: "Islanabilir toz formülasyon, kalıntı etkili", category: ProductCategory.BIOCIDAL, currentStock: 4, criticalThreshold: 5 },
    { code: "INS-420", name: "Tahta Kurusu İlacı (Imidacloprid)", unit: "Litre", description: "Tahta kurusu ve sürünen böceklere özel formülasyon", category: ProductCategory.BIOCIDAL, currentStock: 8, criticalThreshold: 3 },
    { code: "INS-425", name: "Kene ve Pire İlacı", unit: "Litre", description: "Dış mekan kene/pire uygulaması için", category: ProductCategory.BIOCIDAL, currentStock: 6, criticalThreshold: 3 },
    { code: "CON-201", name: "Sinek Bandı (Yapışkan Tuzak)", unit: "Adet", description: "Asma tip yapışkan sinek tuzağı, 4'lü paket", category: ProductCategory.CONSUMABLE, currentStock: 65, criticalThreshold: 15 },
    { code: "CON-205", name: "Güve Feromon Tuzağı", unit: "Adet", description: "Un güvesi/gıda güvesi için feromon kapsüllü tuzak", category: ProductCategory.CONSUMABLE, currentStock: 30, criticalThreshold: 10 },
    { code: "CON-210", name: "Böcek İzleme Tuzağı (Yapışkan Kart)", unit: "Adet", description: "Hamamböceği/karınca izleme için yapışkan kart tuzak", category: ProductCategory.CONSUMABLE, currentStock: 48, criticalThreshold: 12 },
    { code: "CON-215", name: "Tek Kullanımlık Eldiven (Nitril)", unit: "Kutu", description: "100'lü kutu, pudrasız nitril eldiven", category: ProductCategory.CONSUMABLE, currentStock: 20, criticalThreshold: 6 },
    { code: "CON-220", name: "Yüz Maskesi (FFP2)", unit: "Kutu", description: "20'li kutu, kimyasal uygulama için solunum maskesi", category: ProductCategory.CONSUMABLE, currentStock: 16, criticalThreshold: 5 },
    { code: "EQP-301", name: "Yem İstasyonu (Kilitli Kutu)", unit: "Adet", description: "Dış mekan kemirgen yem istasyonu, kilitli", category: ProductCategory.EQUIPMENT, currentStock: 24, criticalThreshold: 8 },
    { code: "EQP-305", name: "ULV Sisleme Cihazı", unit: "Adet", description: "Soğuk sisleme (ULV) uygulama cihazı", category: ProductCategory.EQUIPMENT, currentStock: 3, criticalThreshold: 1 },
    { code: "EQP-310", name: "Sırt Tipi Motorlu Pülverizatör", unit: "Adet", description: "20L kapasiteli motorlu sırt pülverizatörü", category: ProductCategory.EQUIPMENT, currentStock: 5, criticalThreshold: 2 },
    { code: "DIS-401", name: "Yüzey Dezenfektanı (Sodyum Hipoklorit)", unit: "Litre", description: "Genel yüzey dezenfeksiyonu için klor bazlı solüsyon", category: ProductCategory.DISINFECTANT, currentStock: 30, criticalThreshold: 10 },
    { code: "DIS-405", name: "El Dezenfektanı", unit: "Litre", description: "Alkol bazlı el dezenfektanı, saha ekibi için", category: ProductCategory.DISINFECTANT, currentStock: 12, criticalThreshold: 4 },
  ];
  const newProducts = [];
  for (const def of newProductDefs) {
    const existing = await prisma.product.findFirst({ where: { name: def.name } });
    newProducts.push(existing ?? (await prisma.product.create({ data: def })));
  }
  const allProducts = [...(await prisma.product.findMany({ where: { name: { notIn: newProductDefs.map((p) => p.name) } } })), ...newProducts];
  console.log(`${newProducts.length} yeni ürün hazır (toplam ${allProducts.length}).`);

  // ── Ürün partileri (Bölüm AM) — bazı ürünlere parti no + SKT ──
  const batchCount = await prisma.productBatch.count();
  if (batchCount === 0) {
    const batchDefs: { product: (typeof allProducts)[number]; batchNumber: string; expiryOffsetDays: number; qty: number }[] = [
      { product: newProducts[0], batchNumber: "CYP-2026-03", expiryOffsetDays: 420, qty: 20 },
      { product: newProducts[0], batchNumber: "CYP-2025-11", expiryOffsetDays: 18, qty: 6 }, // yakında dolacak
      { product: newProducts[1], batchNumber: "ROD-2026-01", expiryOffsetDays: 540, qty: 15 },
      { product: newProducts[2], batchNumber: "DEL-2025-09", expiryOffsetDays: -10, qty: 2 }, // süresi dolmuş, stokta kalan az
      { product: newProducts[3], batchNumber: "IMI-2026-02", expiryOffsetDays: 300, qty: 8 },
      { product: newProducts[13], batchNumber: "DIS-2026-04", expiryOffsetDays: 25, qty: 18 }, // yakında dolacak
      { product: allProducts.find((p) => p.name === "K-Othrine SC 25")!, batchNumber: "KOT-2026-01", expiryOffsetDays: 200, qty: 18 },
      { product: allProducts.find((p) => p.name === "Fendona 6SC")!, batchNumber: "FEN-2025-08", expiryOffsetDays: 45, qty: 3 },
    ];
    for (const def of batchDefs) {
      await prisma.productBatch.create({
        data: {
          productId: def.product.id,
          batchNumber: def.batchNumber,
          expiryDate: dateOnly(def.expiryOffsetDays),
          quantityReceived: def.qty,
          quantityRemaining: def.qty,
          receivedAt: daysFromNow(-randomInt(5, 60)),
          supplierId: randomItem(suppliers).id,
        },
      });
    }
    console.log(`${batchDefs.length} ürün partisi (parti no + SKT) hazır.`);
  } else {
    console.log(`Zaten ${batchCount} ürün partisi var, atlanıyor.`);
  }

  // ══════════════════════════════════════════════════════════════════════
  // MÜŞTERİLER — en az 28-30 (mevcut 18 + yeni 12)
  // ══════════════════════════════════════════════════════════════════════
  const existingCustomerCount = await prisma.customer.count();
  let customers = await prisma.customer.findMany();
  if (existingCustomerCount < 28) {
    const newCustomerDefs: { fullName: string; phone: string; email?: string }[] = [
      { fullName: "Canan Erdoğan", phone: "0541 200 30 01", email: "canan.erdogan@example.com" },
      { fullName: "Serkan Tekin", phone: "0541 200 30 02" },
      { fullName: "Gül Aydemir", phone: "0541 200 30 03", email: "gul.aydemir@example.com" },
      { fullName: "Tolga Bayraktar", phone: "0541 200 30 04" },
      { fullName: "Nurcan Şimşek", phone: "0541 200 30 05", email: "nurcan.simsek@example.com" },
      { fullName: "Volkan Öz", phone: "0541 200 30 06" },
      { fullName: "Aylin Korkmaz", phone: "0541 200 30 07", email: "aylin.korkmaz@example.com" },
      { fullName: "Cem Baştürk", phone: "0541 200 30 08" },
      { fullName: "Yeşil Vadi Sitesi Yönetimi", phone: "0224 200 40 01", email: "yonetim@yesilvadisitesi.com" },
      { fullName: "Prestij AVM Yönetimi", phone: "0224 200 40 02", email: "teknik@prestijavm.com" },
      { fullName: "Uludağ Otel", phone: "0224 200 40 03", email: "info@uludagotel.com" },
      { fullName: "Zeytin Dalı Restoran", phone: "0224 200 40 04", email: "info@zeytindalirestoran.com" },
    ];
    const created = [];
    for (const [i, def] of newCustomerDefs.entries()) {
      const existing = await prisma.customer.findFirst({ where: { fullName: def.fullName } });
      if (existing) {
        created.push(existing);
        continue;
      }
      const district = districts[i % districts.length];
      const customer = await prisma.customer.create({
        data: {
          fullName: def.fullName,
          phone: def.phone,
          email: def.email,
          address: `${district} Mah. ${randomInt(1, 60)}. Sokak No: ${randomInt(1, 120)}`,
          district,
        },
      });
      created.push(customer);
    }
    customers = await prisma.customer.findMany();
    console.log(`${created.length} yeni müşteri hazır (toplam ${customers.length}).`);
  } else {
    console.log(`Zaten ${existingCustomerCount} müşteri var, yeni müşteri eklenmedi.`);
  }

  // ── Müşteri referans kodları (Bölüm P) — bazılarına kod ver, birini birine bağla ──
  const referrerCandidates = customers.filter((c) => !c.referralCode).slice(0, 5);
  for (const c of referrerCandidates) {
    const code = `NLF${c.id.slice(0, 6).toUpperCase()}`;
    await prisma.customer.update({ where: { id: c.id }, data: { referralCode: code } });
  }
  const referred = customers.find((c) => c.fullName === "Cem Baştürk");
  const referrer = referrerCandidates[0];
  if (referred && referrer && !referred.referredByCustomerId) {
    await prisma.customer.update({ where: { id: referred.id }, data: { referredByCustomerId: referrer.id } });
  }
  console.log(`${referrerCandidates.length} müşteriye referans kodu atandı.`);

  // ── Müşteri etiketleri (Bölüm X): VIP / Kurumsal / Konut ──
  const tagCount = await prisma.customerTag.count();
  if (tagCount === 0) {
    const vip = await prisma.customerTag.create({ data: { name: "VIP", color: "#B8860B" } });
    const kurumsal = await prisma.customerTag.create({ data: { name: "Kurumsal", color: "#2563EB" } });
    const konut = await prisma.customerTag.create({ data: { name: "Konut", color: "#3D8A4E" } });

    const vipNames = ["Bahar Pastanesi", "Yeşim Tekstil San. Tic. Ltd. Şti.", "Uludağ Otel", "Prestij AVM Yönetimi"];
    const kurumsalNames = ["Yeşim Tekstil San. Tic. Ltd. Şti.", "Bursa Cafe & Restoran", "Zeytin Dalı Restoran", "Yeşil Vadi Sitesi Yönetimi", "Prestij AVM Yönetimi", "Uludağ Otel"];
    const konutNames = customers.filter((c) => !kurumsalNames.includes(c.fullName)).slice(0, 14).map((c) => c.fullName);

    let assignCount = 0;
    for (const c of customers) {
      const tagIds: string[] = [];
      if (vipNames.includes(c.fullName)) tagIds.push(vip.id);
      if (kurumsalNames.includes(c.fullName)) tagIds.push(kurumsal.id);
      if (konutNames.includes(c.fullName)) tagIds.push(konut.id);
      for (const tagId of tagIds) {
        await prisma.customerTagAssignment.create({ data: { customerId: c.id, tagId } }).catch(() => {});
        assignCount++;
      }
    }
    console.log(`3 müşteri etiketi (VIP/Kurumsal/Konut) hazır, ${assignCount} atama yapıldı.`);
  } else {
    console.log(`Zaten ${tagCount} müşteri etiketi var, atlanıyor.`);
  }

  // ══════════════════════════════════════════════════════════════════════
  // İŞLER (Job) — en az 60-80 toplam (mevcut 36 + yeni ~40)
  // ══════════════════════════════════════════════════════════════════════
  const existingJobCount = await prisma.job.count();
  if (existingJobCount < 60) {
    let created = 0;

    // 15 tamamlanmış (geçmiş 3 ay), bazılarında rating + Bölüm S geri bildirimi + garanti
    for (let i = 0; i < 15; i++) {
      const customer = randomItem(customers);
      const staff = randomItem(allFieldStaff);
      const serviceType = randomItem(serviceTypes);
      const completedAt = daysFromNow(-randomInt(1, 90));
      const hasFullFeedback = Math.random() > 0.5;
      const warrantyDays = serviceType === "Genel Haşere İlaçlama" ? 30 : serviceType === "Fare ve Kemirgen Kontrolü" ? 90 : null;
      await prisma.job.create({
        data: {
          customerId: customer.id,
          assignedStaffId: staff.id,
          serviceType,
          status: JobStatus.COMPLETED,
          scheduledAt: completedAt,
          completedAt,
          price: randomInt(350, 3200),
          rating: Math.random() > 0.3 ? randomInt(3, 5) : null,
          ratingComment: Math.random() > 0.55 ? randomItem([
            "Personel çok ilgiliydi, işini titizlikle yaptı.",
            "Randevu saatine sadık kaldılar, memnun kaldık.",
            "Sonuç beklediğimizden iyi oldu, teşekkürler.",
            "Fiyat/performans açısından tavsiye ederim.",
            "Uygulama sonrası bilgilendirme yapıldı, teşekkürler.",
          ]) : null,
          serviceQualityScore: hasFullFeedback ? randomInt(3, 5) : null,
          punctualityScore: hasFullFeedback ? randomInt(3, 5) : null,
          staffProfessionalismScore: hasFullFeedback ? randomInt(3, 5) : null,
          wouldRecommend: hasFullFeedback ? Math.random() > 0.15 : null,
          feedbackComment: hasFullFeedback && Math.random() > 0.5 ? "Genel olarak hizmetten memnun kaldık." : null,
          feedbackSubmittedAt: hasFullFeedback ? completedAt : null,
          warrantyExpiresAt: warrantyDays ? new Date(completedAt.getTime() + warrantyDays * 24 * 60 * 60 * 1000) : null,
        },
      });
      created++;
    }

    // 8 iptal edilmiş
    const cancelReasons = [
      "Müşteri erteleme talep etti",
      "Hava koşulları nedeniyle iptal edildi",
      "Müşteriye ulaşılamadı",
      "Müşteri hizmeti kendisi çözdü, ihtiyaç kalmadı",
    ];
    for (let i = 0; i < 8; i++) {
      const customer = randomItem(customers);
      const isPastCancel = Math.random() > 0.4;
      const scheduledAt = isPastCancel ? daysFromNow(-randomInt(1, 60)) : daysFromNow(randomInt(1, 14));
      await prisma.job.create({
        data: {
          customerId: customer.id,
          assignedStaffId: Math.random() > 0.3 ? randomItem(allFieldStaff).id : undefined,
          serviceType: randomItem(serviceTypes),
          status: JobStatus.CANCELLED,
          scheduledAt,
          cancelledAt: isPastCancel ? scheduledAt : daysFromNow(-1),
          cancellationReason: randomItem(cancelReasons),
          price: randomInt(350, 2500),
        },
      });
      created++;
    }

    // 8 planlanmış (gelecek 2 hafta, personel atanmış)
    for (let i = 0; i < 8; i++) {
      const customer = randomItem(customers);
      const staff = randomItem(allFieldStaff);
      const scheduledAt = daysFromNow(randomInt(1, 14));
      const scheduledEndAt = new Date(scheduledAt.getTime() + randomInt(1, 3) * 60 * 60 * 1000);
      await prisma.job.create({
        data: {
          customerId: customer.id,
          assignedStaffId: staff.id,
          serviceType: randomItem(serviceTypes),
          status: JobStatus.SCHEDULED,
          scheduledAt,
          scheduledEndAt,
          price: randomInt(350, 2800),
        },
      });
      created++;
    }

    // 5 bekleyen (henüz personel atanmamış olabilir)
    for (let i = 0; i < 5; i++) {
      const customer = randomItem(customers);
      const scheduledAt = daysFromNow(randomInt(1, 14));
      await prisma.job.create({
        data: {
          customerId: customer.id,
          assignedStaffId: Math.random() > 0.5 ? randomItem(allFieldStaff).id : undefined,
          serviceType: randomItem(serviceTypes),
          status: JobStatus.PENDING,
          scheduledAt,
          price: randomInt(350, 2800),
        },
      });
      created++;
    }

    // 4 devam eden (bugün, başlamış)
    for (let i = 0; i < 4; i++) {
      const customer = randomItem(customers);
      const staff = randomItem(allFieldStaff);
      const today = daysFromNow(0);
      await prisma.job.create({
        data: {
          customerId: customer.id,
          assignedStaffId: staff.id,
          serviceType: randomItem(serviceTypes),
          status: JobStatus.IN_PROGRESS,
          scheduledAt: today,
          startedAt: today,
          price: randomInt(350, 2800),
        },
      });
      created++;
    }

    console.log(`${created} yeni iş hazır (toplam ${existingJobCount + created}).`);
  } else {
    console.log(`Zaten ${existingJobCount} iş var, atlanıyor.`);
  }

  // ══════════════════════════════════════════════════════════════════════
  // SÖZLEŞMELER — en az 15-20 toplam (mevcut 10 + yeni ~8)
  // ══════════════════════════════════════════════════════════════════════
  const existingContractCount = await prisma.contract.count();
  if (existingContractCount < 15) {
    // Zaten sözleşmesi olmayan müşteriler öncelikli — index/slice yerine
    // güvenilir bir sorgu (findMany sırası garanti değildir).
    const customersWithContract = new Set((await prisma.contract.findMany({ select: { customerId: true } })).map((c) => c.customerId));
    const pool = customers.filter((c) => !customersWithContract.has(c.id));
    const fallback = customers.filter((c) => customersWithContract.has(c.id));
    const pick = (i: number) => pool[i] ?? fallback[i % Math.max(fallback.length, 1)];
    const contractDefs = [
      { customer: pick(0), startOffset: -100, months: 12, recurrence: RecurrenceType.MONTHLY },
      { customer: pick(1), startOffset: -20, months: 12, recurrence: null }, // 10 gün içinde bitecek
      { customer: pick(2), startOffset: -250, months: 12, recurrence: RecurrenceType.SEMIANNUAL },
      { customer: pick(3), startOffset: -400, months: 12, recurrence: null }, // süresi dolmuş
      { customer: pick(4), startOffset: -30, months: 24, recurrence: RecurrenceType.QUARTERLY },
      { customer: pick(5), startOffset: -355, months: 12, recurrence: null }, // 10 gün içinde bitecek
      { customer: pick(6), startOffset: -450, months: 12, recurrence: null }, // süresi dolmuş
      { customer: pick(7), startOffset: -10, months: 12, recurrence: RecurrenceType.ANNUAL },
    ];
    let created = 0;
    for (const def of contractDefs) {
      if (!def.customer) continue;
      const startDate = daysFromNow(def.startOffset);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + def.months);
      const status = endDate < new Date() ? "EXPIRED" : "ACTIVE";
      const nextGenerationDate =
        def.recurrence && status === "ACTIVE"
          ? daysFromNow(def.recurrence === RecurrenceType.MONTHLY ? randomInt(1, 30) : randomInt(1, 90))
          : null;
      await prisma.contract.create({
        data: {
          customerId: def.customer.id,
          startDate,
          endDate,
          durationMonths: def.months,
          status,
          serviceType: randomItem(serviceTypes),
          amount: randomInt(2000, 18000),
          recurrenceType: def.recurrence,
          nextGenerationDate,
        },
      });
      created++;
    }
    console.log(`${created} yeni sözleşme hazır (toplam ${existingContractCount + created}).`);
  } else {
    console.log(`Zaten ${existingContractCount} sözleşme var, atlanıyor.`);
  }

  // ══════════════════════════════════════════════════════════════════════
  // TEKLİF TALEPLERİ — en az 15 toplam (mevcut 6 + yeni ~10)
  // ══════════════════════════════════════════════════════════════════════
  const existingQuoteCount = await prisma.quoteRequest.count();
  if (existingQuoteCount < 15) {
    const quoteDefs: { fullName: string; phone: string; propertyType: string; serviceType: string; district: string; status: string; note?: string }[] = [
      { fullName: "Kader Aslan", phone: "0542 300 20 01", propertyType: "Konut", serviceType: "Güve İlaçlama", district: "Nilüfer", status: "NEW" },
      { fullName: "Barış Tunç", phone: "0542 300 20 02", propertyType: "İş Yeri", serviceType: "Genel Haşere İlaçlama", district: "Osmangazi", status: "NEW" },
      { fullName: "Ece Kurtuluş", phone: "0542 300 20 03", propertyType: "Konut", serviceType: "Hamamböceği İlaçlama", district: "Yıldırım", status: "CONTACTED" },
      { fullName: "Fatih Demirbaş", phone: "0542 300 20 04", propertyType: "Depo", serviceType: "Fare ve Kemirgen Kontrolü", district: "Mudanya", status: "CONTACTED" },
      { fullName: "Songül Avcı", phone: "0542 300 20 05", propertyType: "Restoran", serviceType: "Karınca İlaçlama", district: "Gemlik", status: "REVISION", note: "Müşteri fiyat revizesi istedi, alan büyüklüğü güncellendi." },
      { fullName: "Turan Akgün", phone: "0542 300 20 06", propertyType: "Fabrika", serviceType: "Sivrisinek ve Karasinek İlaçlama", district: "Karacabey", status: "CONVERTED" },
      { fullName: "Melis Sarıkaya", phone: "0542 300 20 07", propertyType: "Konut", serviceType: "Genel Haşere İlaçlama", district: "Nilüfer", status: "CONVERTED" },
      { fullName: "Yakup Öztaş", phone: "0542 300 20 08", propertyType: "Otel", serviceType: "Hamamböceği İlaçlama", district: "Osmangazi", status: "REJECTED" },
      { fullName: "Buse Çakır", phone: "0542 300 20 09", propertyType: "Kreş", serviceType: "Genel Haşere İlaçlama", district: "Yıldırım", status: "NEW" },
      { fullName: "İsmail Koçak", phone: "0542 300 20 10", propertyType: "AVM", serviceType: "Fare ve Kemirgen Kontrolü", district: "Nilüfer", status: "CONTACTED" },
    ];
    for (const def of quoteDefs) {
      const isConverted = def.status === "CONVERTED";
      const isContacted = def.status !== "NEW";
      await prisma.quoteRequest.create({
        data: {
          fullName: def.fullName,
          phone: def.phone,
          propertyType: def.propertyType,
          serviceType: def.serviceType,
          district: def.district,
          status: def.status,
          note: def.note,
          firstContactedAt: isContacted ? daysFromNow(-randomInt(1, 20)) : null,
          convertedAt: isConverted ? daysFromNow(-randomInt(1, 10)) : null,
          createdAt: daysFromNow(-randomInt(1, 45)),
        },
      });
    }
    console.log(`${quoteDefs.length} yeni teklif talebi hazır (toplam ${existingQuoteCount + quoteDefs.length}).`);
  } else {
    console.log(`Zaten ${existingQuoteCount} teklif talebi var, atlanıyor.`);
  }

  // ══════════════════════════════════════════════════════════════════════
  // MÜŞTERİ ŞİKAYETLERİ (Bölüm AO)
  // ══════════════════════════════════════════════════════════════════════
  const existingComplaintCount = await prisma.customerComplaint.count();
  if (existingComplaintCount === 0) {
    const someJobs = await prisma.job.findMany({ take: 20, orderBy: { createdAt: "desc" } });
    const complaintDefs: { subject: string; description: string; status: ComplaintStatus; priority: ComplaintPriority; resolutionNote?: string }[] = [
      { subject: "Uygulama sonrası koku şikayeti", description: "İlaçlama sonrası evde kalıcı bir koku var, 2 gündür geçmiyor.", status: ComplaintStatus.OPEN, priority: ComplaintPriority.MEDIUM },
      { subject: "Randevu saatine geç kalındı", description: "Personel randevu saatinden 1,5 saat geç geldi, haber verilmedi.", status: ComplaintStatus.IN_PROGRESS, priority: ComplaintPriority.LOW },
      { subject: "Sonuç alınamadı", description: "İlaçlamadan 1 hafta sonra hamamböceği görülmeye devam ediyor.", status: ComplaintStatus.IN_PROGRESS, priority: ComplaintPriority.HIGH },
      { subject: "Fatura tutarı itirazı", description: "Teklifte belirtilen tutardan farklı bir tutar tahsil edildi.", status: ComplaintStatus.RESOLVED, priority: ComplaintPriority.MEDIUM, resolutionNote: "Fark iade edildi, teklif kaydı düzeltildi." },
      { subject: "Kapı önünde ekipman unutuldu", description: "Personel bir sprey ekipmanını kapı önünde unutmuş.", status: ComplaintStatus.RESOLVED, priority: ComplaintPriority.LOW, resolutionNote: "Ekipman aynı gün teslim alındı." },
      { subject: "Evcil hayvan güvenliği endişesi", description: "Kullanılan ürünün kedi için güvenli olup olmadığı soruldu.", status: ComplaintStatus.CLOSED, priority: ComplaintPriority.MEDIUM, resolutionNote: "Ürün güvenlik bilgi formu paylaşıldı, müşteri bilgilendirildi." },
      { subject: "Personel iletişimsizliği", description: "Uygulama öncesi ne yapılacağı hakkında bilgi verilmedi.", status: ComplaintStatus.OPEN, priority: ComplaintPriority.LOW },
      { subject: "Tekrar eden karınca sorunu", description: "3. kez ilaçlama yapıldı ama karıncalar tekrar ortaya çıkıyor.", status: ComplaintStatus.IN_PROGRESS, priority: ComplaintPriority.HIGH },
    ];
    let idx = 0;
    for (const def of complaintDefs) {
      const customer = randomItem(customers);
      const relatedJob = Math.random() > 0.4 ? randomItem(someJobs) : null;
      const createdAt = daysFromNow(-randomInt(1, 40));
      await prisma.customerComplaint.create({
        data: {
          customerId: customer.id,
          jobId: relatedJob?.id,
          subject: def.subject,
          description: def.description,
          status: def.status,
          priority: def.priority,
          assignedToUserId: def.status !== ComplaintStatus.OPEN ? randomItem([manager.id, teamLead.id]) : null,
          resolutionNote: def.resolutionNote,
          createdAt,
          resolvedAt: def.status === ComplaintStatus.RESOLVED || def.status === ComplaintStatus.CLOSED ? daysFromNow(-randomInt(0, 10)) : null,
        },
      });
      idx++;
    }
    console.log(`${idx} müşteri şikayeti hazır.`);
  } else {
    console.log(`Zaten ${existingComplaintCount} şikayet var, atlanıyor.`);
  }

  // ══════════════════════════════════════════════════════════════════════
  // DEĞERLENDİRME KRİTERLERİ + DÖNEMLER + DEĞERLENDİRMELER + PRİMLER
  // ══════════════════════════════════════════════════════════════════════
  const criterionCount = await prisma.evaluationCriterion.count();
  let criteria = await prisma.evaluationCriterion.findMany();
  if (criterionCount === 0) {
    const criterionDefs = [
      { name: "İş Kalitesi", description: "Uygulamanın teknik doğruluğu ve sonuç etkinliği", sortOrder: 1 },
      { name: "Zamanında Gelme", description: "Randevu saatine uyum", sortOrder: 2 },
      { name: "Müşteri İletişimi", description: "Müşteriyle profesyonel ve anlaşılır iletişim", sortOrder: 3 },
      { name: "Ekipman ve Malzeme Kullanımı", description: "Ekipman/ürünlerin doğru ve tasarruflu kullanımı", sortOrder: 4 },
      { name: "Güvenlik Prosedürlerine Uyum", description: "KKD kullanımı ve güvenlik talimatlarına uyum", sortOrder: 5 },
      { name: "Takım Çalışması", description: "Ekip içi uyum ve iş birliği", sortOrder: 6 },
    ];
    criteria = [];
    for (const def of criterionDefs) {
      criteria.push(await prisma.evaluationCriterion.create({ data: def }));
    }
    console.log(`${criteria.length} değerlendirme kriteri hazır.`);
  } else {
    console.log(`Zaten ${criterionCount} değerlendirme kriteri var, atlanıyor.`);
  }

  const periodCount = await prisma.evaluationPeriod.count();
  if (periodCount === 0) {
    const period1 = await prisma.evaluationPeriod.create({
      data: {
        label: "2026 Ç1 (Ocak-Mart)",
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-03-31"),
        isLocked: true,
        bonusThreshold: 16,
        bonusAmount: 1500,
      },
    });
    const period2 = await prisma.evaluationPeriod.create({
      data: {
        label: "2026 Ç2 (Nisan-Haziran)",
        startDate: new Date("2026-04-01"),
        endDate: new Date("2026-06-30"),
        isLocked: true,
        bonusThreshold: 16,
        bonusAmount: 1750,
      },
    });
    const period3 = await prisma.evaluationPeriod.create({
      data: {
        label: "2026 Ç3 (Temmuz-Eylül)",
        startDate: new Date("2026-07-01"),
        endDate: new Date("2026-09-30"),
        isLocked: false,
      },
    });
    console.log("3 değerlendirme dönemi hazır (2 kilitli + 1 açık).");

    // Kilitli dönemler için: her saha personeline (teamLead dahil) manager'dan
    // bir değerlendirme, tüm kriterlerde puan.
    let evalCount = 0;
    let bonusCount = 0;
    for (const period of [period1, period2]) {
      for (const staff of allFieldStaff) {
        const scores = criteria.map((c) => ({ criterionId: c.id, score: randomInt(11, 20) }));
        const evaluation = await prisma.evaluation.create({
          data: {
            evaluatorUserId: manager.id,
            targetStaffId: staff.id,
            periodId: period.id,
            status: EvaluationStatus.LOCKED,
            comment: randomItem([
              "Genel olarak başarılı bir dönem geçirdi.",
              "Müşteri geri bildirimleri olumlu, devam etsin.",
              "Bazı alanlarda gelişim alanı var, birebir görüşüldü.",
              "Ekip içinde örnek performans sergiledi.",
            ]),
            submittedAt: period.endDate,
            lockedAt: period.endDate,
            scores: { createMany: { data: scores } },
          },
        });
        evalCount++;

        const avg = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;
        if (avg >= 16) {
          await prisma.staffBonus.create({
            data: {
              staffId: staff.id,
              evaluationPeriodId: period.id,
              evaluationId: evaluation.id,
              amount: period.bonusAmount!,
              status: period === period1 ? StaffBonusStatus.APPROVED : StaffBonusStatus.PENDING,
              approvedByUserId: period === period1 ? owner.id : null,
              approvedAt: period === period1 ? period.endDate : null,
            },
          });
          bonusCount++;
        }
      }
    }
    // Açık dönem için birkaç taslak/gönderilmiş değerlendirme — "devam ediyor" görünümü.
    for (const staff of allFieldStaff.slice(0, 3)) {
      const scores = criteria.map((c) => ({ criterionId: c.id, score: randomInt(12, 20) }));
      await prisma.evaluation.create({
        data: {
          evaluatorUserId: manager.id,
          targetStaffId: staff.id,
          periodId: period3.id,
          status: staff === allFieldStaff[0] ? EvaluationStatus.SUBMITTED : EvaluationStatus.DRAFT,
          submittedAt: staff === allFieldStaff[0] ? daysFromNow(-2) : null,
          scores: { createMany: { data: scores } },
        },
      });
      evalCount++;
    }
    console.log(`${evalCount} personel değerlendirmesi hazır, ${bonusCount} prim önerisi oluştu.`);
  } else {
    console.log(`Zaten ${periodCount} değerlendirme dönemi var, atlanıyor.`);
  }

  console.log("Demo veri seed'i tamamlandı.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

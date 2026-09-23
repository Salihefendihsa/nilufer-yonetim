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
  StockMovementType,
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

  // ══════════════════════════════════════════════════════════════════════
  // ÖDEMELER — 24 aylık trend (bu yıl + geçen yıl aynı aylar) mevsimsel
  // dalgalanma ve hafif yıllık büyüme ile — /analytics/revenue-trend ve
  // /analytics/year-over-year için gerçek veri.
  // ══════════════════════════════════════════════════════════════════════
  const paymentTrendCount = await prisma.payment.count();
  if (paymentTrendCount < 150) {
    const paymentTypes = ["CASH", "CREDIT_CARD", "TRANSFER"];
    // Haşere ilaçlama talebi ılık aylarda (Nis-Eyl) artar, kışın düşer (Oca=0 .. Ara=11).
    const seasonMultiplier = [0.65, 0.7, 0.85, 1.1, 1.35, 1.5, 1.55, 1.45, 1.2, 0.95, 0.75, 0.6];
    let createdPayments = 0;
    const now = new Date();
    for (let monthsBack = 23; monthsBack >= 0; monthsBack--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
      const month = monthDate.getMonth();
      const isThisYear = monthsBack < 12;
      // Bu yıl geçen yıla göre ortalama biraz daha yüksek (büyüme trendi).
      const growthFactor = isThisYear ? 1 : 0.87;
      const base = 6 + seasonMultiplier[month] * 4;
      const paymentsThisMonth = Math.round(base * growthFactor * (0.85 + Math.random() * 0.3));
      for (let i = 0; i < paymentsThisMonth; i++) {
        const day = randomInt(1, 27);
        const createdAt = new Date(monthDate.getFullYear(), month, day, randomInt(8, 19), randomItem([0, 15, 30, 45]));
        if (createdAt > now) continue; // gelecek tarihli ödeme olmaz
        const amount = Math.round(randomInt(300, 3400) * seasonMultiplier[month] * growthFactor);
        await prisma.payment.create({
          data: {
            customerId: randomItem(customers).id,
            amount,
            paymentType: randomItem(paymentTypes),
            collectedByStaffId: Math.random() > 0.4 ? randomItem(allFieldStaff).id : undefined,
            createdAt,
          },
        });
        createdPayments++;
      }
    }
    console.log(`${createdPayments} yeni ödeme hazır (24 aylık trend + YoY, toplam ${paymentTrendCount + createdPayments}).`);
  } else {
    console.log(`Zaten ${paymentTrendCount} ödeme var, atlanıyor.`);
  }

  // ══════════════════════════════════════════════════════════════════════
  // DEĞERLENDİRME DÖNEMLERİ — geçmişe 2 dönem daha eklenerek toplam 5 dönem
  // (gerçek bir trend çizgisi için) — ortalama puan zamanla yükseliyor.
  // ══════════════════════════════════════════════════════════════════════
  const extraPeriodDefs: { label: string; startDate: Date; endDate: Date; bonusThreshold: number; bonusAmount: number; scoreRange: [number, number] }[] = [
    { label: "2025 Ç3 (Temmuz-Eylül)", startDate: new Date("2025-07-01"), endDate: new Date("2025-09-30"), bonusThreshold: 15, bonusAmount: 1250, scoreRange: [8, 15] },
    { label: "2025 Ç4 (Ekim-Aralık)", startDate: new Date("2025-10-01"), endDate: new Date("2025-12-31"), bonusThreshold: 15, bonusAmount: 1350, scoreRange: [9, 16] },
  ];
  let extraEvalCount = 0;
  let extraBonusCount = 0;
  let extraPeriodCount = 0;
  for (const def of extraPeriodDefs) {
    const period =
      (await prisma.evaluationPeriod.findFirst({ where: { label: def.label } })) ??
      (await (async () => {
        extraPeriodCount++;
        return prisma.evaluationPeriod.create({
          data: {
            label: def.label,
            startDate: def.startDate,
            endDate: def.endDate,
            isLocked: true,
            bonusThreshold: def.bonusThreshold,
            bonusAmount: def.bonusAmount,
          },
        });
      })());
    const existingEvalForPeriod = await prisma.evaluation.count({ where: { periodId: period.id } });
    if (existingEvalForPeriod > 0) continue;
    for (const staff of allFieldStaff) {
      const scores = criteria.map((c) => ({ criterionId: c.id, score: randomInt(def.scoreRange[0], def.scoreRange[1]) }));
      const evaluation = await prisma.evaluation.create({
        data: {
          evaluatorUserId: manager.id,
          targetStaffId: staff.id,
          periodId: period.id,
          status: EvaluationStatus.LOCKED,
          comment: randomItem([
            "Dönem başında belirlenen gelişim alanlarında ilerleme var.",
            "Müşteri şikayeti olmadı, istikrarlı bir performans sergiledi.",
            "Ekip içi koordinasyon güçlü, örnek davranışlar gözlemlendi.",
            "Bazı işlerde zamanlama sorunları yaşandı, geri bildirim verildi.",
          ]),
          submittedAt: def.endDate,
          lockedAt: def.endDate,
          scores: { createMany: { data: scores } },
        },
      });
      extraEvalCount++;
      const avg = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;
      if (avg >= def.bonusThreshold) {
        await prisma.staffBonus.create({
          data: {
            staffId: staff.id,
            evaluationPeriodId: period.id,
            evaluationId: evaluation.id,
            amount: def.bonusAmount,
            status: StaffBonusStatus.APPROVED,
            approvedByUserId: owner.id,
            approvedAt: def.endDate,
          },
        });
        extraBonusCount++;
      }
    }
  }
  if (extraEvalCount > 0) {
    console.log(`${extraPeriodCount} yeni değerlendirme dönemi (toplam 5) + ${extraEvalCount} değerlendirme + ${extraBonusCount} prim hazır.`);
  } else {
    console.log("Ek değerlendirme dönemleri/değerlendirmeleri zaten mevcut, atlanıyor.");
  }

  // ══════════════════════════════════════════════════════════════════════
  // İŞLER — geçmişi 6 aya uzat (91-180 gün önce) + puan çeşitliliği (1-5,
  // yalnızca 5 değil) — geri bildirim/rapor grafiklerinin gerçekçi görünmesi için.
  // ══════════════════════════════════════════════════════════════════════
  const oldCompletedCount = await prisma.job.count({
    where: { status: JobStatus.COMPLETED, completedAt: { lt: daysFromNow(-90) } },
  });
  if (oldCompletedCount < 15) {
    let createdOldJobs = 0;
    for (let i = 0; i < 18; i++) {
      const customer = randomItem(customers);
      const staff = randomItem(allFieldStaff);
      const serviceType = randomItem(serviceTypes);
      const completedAt = daysFromNow(-randomInt(91, 180));
      const hasFullFeedback = Math.random() > 0.45;
      const warrantyDays = serviceType === "Genel Haşere İlaçlama" ? 30 : serviceType === "Fare ve Kemirgen Kontrolü" ? 90 : null;
      // Ağırlıklı dağılım: çoğunlukla 4-5, azınlıkta 1-2 (gerçekçi karışık geri bildirim).
      const rating = randomItem([1, 2, 2, 3, 3, 4, 4, 4, 5, 5, 5, 5]);
      await prisma.job.create({
        data: {
          customerId: customer.id,
          assignedStaffId: staff.id,
          serviceType,
          status: JobStatus.COMPLETED,
          scheduledAt: completedAt,
          completedAt,
          price: randomInt(350, 3200),
          rating: Math.random() > 0.2 ? rating : null,
          ratingComment:
            rating <= 2 && Math.random() > 0.4
              ? randomItem([
                  "Beklediğimiz sonucu alamadık, tekrar uygulama istedik.",
                  "İletişim zayıftı, randevu değişikliği geç haber verildi.",
                  "Fiyat/performans açısından memnun kalmadık.",
                ])
              : rating >= 4 && Math.random() > 0.5
              ? randomItem([
                  "Personel çok ilgiliydi, işini titizlikle yaptı.",
                  "Sonuç beklediğimizden iyi oldu, teşekkürler.",
                ])
              : null,
          serviceQualityScore: hasFullFeedback ? rating : null,
          punctualityScore: hasFullFeedback ? Math.max(1, Math.min(5, rating + randomInt(-1, 1))) : null,
          staffProfessionalismScore: hasFullFeedback ? Math.max(1, Math.min(5, rating + randomInt(-1, 1))) : null,
          wouldRecommend: hasFullFeedback ? rating >= 3 : null,
          feedbackComment: hasFullFeedback && Math.random() > 0.6 ? "Geri bildirimimiz yukarıdaki gibidir." : null,
          feedbackSubmittedAt: hasFullFeedback ? completedAt : null,
          warrantyExpiresAt: warrantyDays ? new Date(completedAt.getTime() + warrantyDays * 24 * 60 * 60 * 1000) : null,
        },
      });
      createdOldJobs++;
    }
    console.log(`${createdOldJobs} ek geçmiş iş hazır (91-180 gün önce, 1-5 puan çeşitliliği dahil).`);
  } else {
    console.log(`Zaten ${oldCompletedCount} 90+ gün önce tamamlanmış iş var, atlanıyor.`);
  }

  // ══════════════════════════════════════════════════════════════════════
  // STOK HAREKETLERİ — ürün başına 30-60 günlük IN/OUT geçmişi, GET
  // /products/:id/forecast'ın (son 30 gün OUT toplamı) veri bulması için.
  // ══════════════════════════════════════════════════════════════════════
  const movementCount = await prisma.stockMovement.count();
  if (movementCount < 120) {
    let createdMovements = 0;
    for (const product of allProducts) {
      const n = randomInt(5, 10);
      // Hareketler kronolojik üretilir ve currentStock'a GERÇEKTEN uygulanır
      // (önceden yalnızca hareket kaydı yazılıyor, stok değeri güncellenmiyordu
      // → hareket defteri ile stok tutarsızdı). Çıkış mevcut stoğu aşamaz.
      const dayOffsets = Array.from({ length: n }, () => randomInt(0, 60)).sort((a, b) => b - a);
      let stock = Number(product.currentStock);
      for (const dayOffset of dayOffsets) {
        const threshold = Math.max(2, Math.round(Number(product.criticalThreshold)));
        let isOut = Math.random() > 0.3; // çoğunlukla saha sarfiyatı
        let qty = isOut ? randomInt(1, Math.max(2, Math.round(threshold / 2))) : randomInt(5, Math.max(10, threshold * 2));
        if (isOut && qty > stock) {
          isOut = false; // yetersiz stok → bu gün bir stok girişi olsun
          qty = randomInt(5, Math.max(10, threshold * 2));
        }
        stock += isOut ? -qty : qty;
        await prisma.stockMovement.create({
          data: {
            productId: product.id,
            type: isOut ? StockMovementType.OUT : StockMovementType.IN,
            quantity: qty,
            note: isOut ? "Saha uygulaması sarfiyatı" : "Stok girişi",
            createdAt: daysFromNow(-dayOffset),
          },
        });
        createdMovements++;
      }
      await prisma.product.update({ where: { id: product.id }, data: { currentStock: stock } });
    }
    console.log(`${createdMovements} yeni stok hareketi hazır (ürün başına 30-60 günlük geçmiş, toplam ${movementCount + createdMovements}).`);
  } else {
    console.log(`Zaten ${movementCount} stok hareketi var, atlanıyor.`);
  }

  // ══════════════════════════════════════════════════════════════════════
  // TEKLİF TALEPLERİ — yanıt süresi metrikleri için daha geniş zaman damgası
  // çeşitliliği (30 ve 90 günlük pencerelerin ikisinde de veri olsun).
  // ══════════════════════════════════════════════════════════════════════
  const quoteCount2 = await prisma.quoteRequest.count();
  if (quoteCount2 < 30) {
    const quoteDefs2: { fullName: string; phone: string; propertyType: string; serviceType: string; district: string; status: string; createdDaysAgo: number; contactHoursLater?: number; convertHoursLater?: number }[] = [
      { fullName: "Pınar Doğan", phone: "0543 400 10 01", propertyType: "Konut", serviceType: "Genel Haşere İlaçlama", district: "Nilüfer", status: "NEW", createdDaysAgo: 2 },
      { fullName: "Emre Kaya", phone: "0543 400 10 02", propertyType: "İş Yeri", serviceType: "Hamamböceği İlaçlama", district: "Osmangazi", status: "CONTACTED", createdDaysAgo: 5, contactHoursLater: 3 },
      { fullName: "Derya Uçar", phone: "0543 400 10 03", propertyType: "Restoran", serviceType: "Fare ve Kemirgen Kontrolü", district: "Yıldırım", status: "CONVERTED", createdDaysAgo: 8, contactHoursLater: 1, convertHoursLater: 30 },
      { fullName: "Okan Bilgin", phone: "0543 400 10 04", propertyType: "Konut", serviceType: "Karınca İlaçlama", district: "Mudanya", status: "CONTACTED", createdDaysAgo: 12, contactHoursLater: 20 },
      { fullName: "Selma Aksoy", phone: "0543 400 10 05", propertyType: "Depo", serviceType: "Fare ve Kemirgen Kontrolü", district: "Gemlik", status: "CONVERTED", createdDaysAgo: 18, contactHoursLater: 2, convertHoursLater: 48 },
      { fullName: "Burak Şen", phone: "0543 400 10 06", propertyType: "Otel", serviceType: "Güve İlaçlama", district: "Karacabey", status: "REJECTED", createdDaysAgo: 22, contactHoursLater: 40 },
      { fullName: "Zehra Polat", phone: "0543 400 10 07", propertyType: "Konut", serviceType: "Genel Haşere İlaçlama", district: "Nilüfer", status: "NEW", createdDaysAgo: 25 },
      { fullName: "Hakan Türker", phone: "0543 400 10 08", propertyType: "AVM", serviceType: "Sivrisinek ve Karasinek İlaçlama", district: "Osmangazi", status: "CONVERTED", createdDaysAgo: 33, contactHoursLater: 5, convertHoursLater: 72 },
      { fullName: "Nilay Er", phone: "0543 400 10 09", propertyType: "Fabrika", serviceType: "Fare ve Kemirgen Kontrolü", district: "Yıldırım", status: "CONTACTED", createdDaysAgo: 40, contactHoursLater: 60 },
      { fullName: "Cansu Yıldız", phone: "0543 400 10 10", propertyType: "Kreş", serviceType: "Genel Haşere İlaçlama", district: "Mudanya", status: "REVISION", createdDaysAgo: 47, contactHoursLater: 4 },
      { fullName: "Deniz Arslan", phone: "0543 400 10 11", propertyType: "Konut", serviceType: "Hamamböceği İlaçlama", district: "Gemlik", status: "CONVERTED", createdDaysAgo: 55, contactHoursLater: 8, convertHoursLater: 96 },
      { fullName: "Murat Çelik", phone: "0543 400 10 12", propertyType: "Restoran", serviceType: "Karınca İlaçlama", district: "Karacabey", status: "REJECTED", createdDaysAgo: 63, contactHoursLater: 90 },
      { fullName: "Sibel Avcıoğlu", phone: "0543 400 10 13", propertyType: "İş Yeri", serviceType: "Genel Haşere İlaçlama", district: "Nilüfer", status: "CONTACTED", createdDaysAgo: 71, contactHoursLater: 15 },
      { fullName: "Ozan Güneş", phone: "0543 400 10 14", propertyType: "Otel", serviceType: "Fare ve Kemirgen Kontrolü", district: "Osmangazi", status: "CONVERTED", createdDaysAgo: 82, contactHoursLater: 6, convertHoursLater: 120 },
    ];
    for (const def of quoteDefs2) {
      const createdAt = daysFromNow(-def.createdDaysAgo);
      const firstContactedAt = def.contactHoursLater != null ? new Date(createdAt.getTime() + def.contactHoursLater * 3600 * 1000) : null;
      const convertedAt = def.convertHoursLater != null ? new Date(createdAt.getTime() + def.convertHoursLater * 3600 * 1000) : null;
      await prisma.quoteRequest.create({
        data: {
          fullName: def.fullName,
          phone: def.phone,
          propertyType: def.propertyType,
          serviceType: def.serviceType,
          district: def.district,
          status: def.status,
          firstContactedAt,
          convertedAt,
          createdAt,
        },
      });
    }
    console.log(`${quoteDefs2.length} yeni teklif talebi hazır (yanıt süresi çeşitliliği, toplam ${quoteCount2 + quoteDefs2.length}).`);
  } else {
    console.log(`Zaten ${quoteCount2} teklif talebi var, atlanıyor.`);
  }

  // ══════════════════════════════════════════════════════════════════════
  // STOK MUTABAKATI — eski seed sürümü stok hareketlerini currentStock'a
  // uygulamadığı için bazı ürünler negatif görünüyordu (ör. Biyosidal Sis
  // Jeneratörü Solüsyonu: -6 L). Negatif stoklar, uygulamanın kendi "fiili
  // sayım mutabakatı" deseniyle (productsController.adjustProductCount: tek
  // IN hareketi + değeri eşitle) gerçekçi bir sayıma çekilir.
  // ══════════════════════════════════════════════════════════════════════
  const negativeProducts = await prisma.product.findMany({ where: { currentStock: { lt: 0 } } });
  for (const p of negativeProducts) {
    const previous = Number(p.currentStock);
    const counted = Math.max(1, Math.round(Number(p.criticalThreshold))) + randomInt(2, 8);
    await prisma.$transaction([
      prisma.product.update({ where: { id: p.id }, data: { currentStock: counted } }),
      prisma.stockMovement.create({
        data: {
          productId: p.id,
          type: StockMovementType.IN,
          quantity: counted - previous,
          note: `Fiili sayım mutabakatı (demo veri düzeltmesi), önceki: ${previous}, sayılan: ${counted}`,
        },
      }),
    ]);
  }
  console.log(
    negativeProducts.length > 0
      ? `${negativeProducts.length} negatif stoklu ürün sayım mutabakatıyla düzeltildi.`
      : "Negatif stoklu ürün yok, atlanıyor."
  );

  // ══════════════════════════════════════════════════════════════════════
  // İŞ ŞABLONLARI — Yeni İş formundaki "Şablondan doldur" listesi boş kalmasın.
  // ══════════════════════════════════════════════════════════════════════
  const templateDefs = [
    { name: "Standart Hamamböceği İlaçlama", serviceType: "Hamamböceği İlaçlama", defaultPrice: 1200, defaultDurationMinutes: 60, defaultNotes: "Mutfak ve banyo öncelikli jel + püskürtme uygulaması. Müşteriye 4 saat havalandırma bilgisi verilecek." },
    { name: "Aylık Bakım Kontrolü", serviceType: "Genel Haşere İlaçlama", defaultPrice: 850, defaultDurationMinutes: 45, defaultNotes: "Sözleşmeli müşteri rutin ziyareti: tuzak kontrolü, gerekirse takviye uygulama, rapor imzası." },
    { name: "Kemirgen Yem İstasyonu Kurulumu", serviceType: "Fare ve Kemirgen Kontrolü", defaultPrice: 1800, defaultDurationMinutes: 90, defaultNotes: "Dış çevreye kilitli yem istasyonları, istasyon krokisi müşteriye teslim edilecek." },
    { name: "Restoran Kapsamlı İlaçlama", serviceType: "Genel Haşere İlaçlama", defaultPrice: 3200, defaultDurationMinutes: 150, defaultNotes: "Kapanış sonrası uygulama. Gıda temas yüzeyleri örtülecek, HACCP formu doldurulacak." },
    { name: "Sivrisinek ULV Sisleme (Bahçe)", serviceType: "Sivrisinek ve Karasinek İlaçlama", defaultPrice: 1500, defaultDurationMinutes: 60, defaultNotes: "Akşam saatlerinde ULV cihazı ile soğuk sisleme; durgun su kaynakları raporlanacak." },
    { name: "Karınca Jel Uygulaması", serviceType: "Karınca İlaçlama", defaultPrice: 700, defaultDurationMinutes: 40, defaultNotes: "Giriş noktalarına jel yem; evcil hayvan erişimine kapalı noktalar tercih edilecek." },
  ];
  let createdTemplates = 0;
  for (const def of templateDefs) {
    const existing = await prisma.jobTemplate.findFirst({ where: { name: def.name } });
    if (existing) continue;
    await prisma.jobTemplate.create({ data: def });
    createdTemplates++;
  }
  console.log(`${createdTemplates} yeni iş şablonu hazır (toplam ${await prisma.jobTemplate.count()}).`);

  // ══════════════════════════════════════════════════════════════════════
  // TEKLİF TARİHÇESİ — mevcut tekliflere geçmiş olaylar (AuditLog,
  // targetType="QuoteRequest"); quotesController'daki gerçek action/detail
  // biçimleriyle aynı (quote.update → JSON, quote.convert → "-> Customer").
  // ══════════════════════════════════════════════════════════════════════
  const quoteAuditCount = await prisma.auditLog.count({ where: { targetType: "QuoteRequest" } });
  if (quoteAuditCount < 15) {
    const quotedIds = new Set(
      (await prisma.auditLog.findMany({ where: { targetType: "QuoteRequest" }, select: { targetId: true } })).map((a) => a.targetId)
    );
    const quotes = await prisma.quoteRequest.findMany({ where: { status: { not: "NEW" } } });
    let createdEvents = 0;
    for (const q of quotes) {
      if (quotedIds.has(q.id)) continue;
      const actor = randomItem([manager, owner]);
      const contactedAt = q.firstContactedAt ?? new Date(q.createdAt.getTime() + randomInt(2, 30) * 3600 * 1000);
      const events: { action: string; detail: string; at: Date }[] = [
        { action: "quote.update", detail: JSON.stringify({ status: "CONTACTED" }), at: contactedAt },
      ];
      const later = (h: number) => new Date(contactedAt.getTime() + h * 3600 * 1000);
      if (q.status === "REVISION") {
        events.push({ action: "quote.update", detail: JSON.stringify({ note: q.note ?? "Müşteri fiyat revizesi istedi." }), at: later(6) });
        events.push({ action: "quote.update", detail: JSON.stringify({ status: "REVISION" }), at: later(7) });
      } else if (q.status === "CONVERTED") {
        events.push({ action: "quote.update", detail: JSON.stringify({ surveyAt: later(24).toISOString() }), at: later(1) });
        const customer = await prisma.customer.findFirst({ where: { phone: q.phone } });
        events.push({
          action: "quote.convert",
          detail: customer ? `-> Customer ${customer.id} (${customer.fullName})` : `-> Customer (${q.fullName})`,
          at: q.convertedAt ?? later(30),
        });
      } else if (q.status === "REJECTED") {
        events.push({ action: "quote.update", detail: JSON.stringify({ status: "REJECTED" }), at: later(20) });
      }
      for (const e of events) {
        await prisma.auditLog.create({
          data: {
            actorUserId: actor.id,
            action: e.action,
            targetUserId: actor.id,
            targetType: "QuoteRequest",
            targetId: q.id,
            detail: e.detail,
            createdAt: e.at,
          },
        });
        createdEvents++;
      }
    }
    console.log(`${createdEvents} teklif tarihçesi olayı hazır.`);
  } else {
    console.log(`Zaten ${quoteAuditCount} teklif tarihçesi olayı var, atlanıyor.`);
  }

  // ══════════════════════════════════════════════════════════════════════
  // GİDERLER — son 4 ay, farklı kategoriler (Giderler sekmesi + net kâr).
  // ══════════════════════════════════════════════════════════════════════
  const expenseCount = await prisma.expense.count();
  if (expenseCount < 20) {
    const expenseDefs: { category: "FUEL" | "CHEMICALS" | "EQUIPMENT" | "OTHER" | "RENT" | "UTILITIES"; min: number; max: number; descriptions: string[] }[] = [
      { category: "FUEL", min: 900, max: 2600, descriptions: ["Servis aracı yakıt (34 NLF 01)", "Servis aracı yakıt (16 NLF 02)", "Haftalık yakıt kartı dolumu"] },
      { category: "CHEMICALS", min: 1500, max: 7800, descriptions: ["Cypermethrin 25 EC — 10 L", "Fare yemi granül — 25 kg", "Jel yem (hamamböceği) — 20 tüp", "K-Othrine SC 25 — 5 L"] },
      { category: "EQUIPMENT", min: 650, max: 9500, descriptions: ["Pülverizatör nozul ve conta seti", "Yem istasyonu (kilitli) — 12 adet", "FFP2 maske ve nitril eldiven", "ULV cihazı yıllık bakım"] },
      { category: "OTHER", min: 250, max: 2200, descriptions: ["Araç yıkama", "Kırtasiye ve form baskısı", "Otopark ve köprü geçiş ücretleri", "Personel iş kıyafeti"] },
    ];
    let createdExpenses = 0;
    for (let monthsBack = 3; monthsBack >= 0; monthsBack--) {
      // Her ay: 1 kira + 1 fatura + 4 değişken gider (≈ 24 kayıt).
      const monthStart = new Date();
      monthStart.setMonth(monthStart.getMonth() - monthsBack, 1);
      const inMonth = (day: number) => {
        const d = new Date(monthStart);
        d.setDate(Math.min(day, 28));
        d.setHours(randomInt(9, 17), 0, 0, 0);
        return d > new Date() ? new Date() : d;
      };
      await prisma.expense.create({ data: { category: "RENT", amount: 18000, description: "Depo ve ofis kirası", date: inMonth(1), recordedByUserId: owner.id } });
      await prisma.expense.create({ data: { category: "UTILITIES", amount: randomInt(1400, 2600), description: "Elektrik, su ve internet faturaları", date: inMonth(10), recordedByUserId: manager.id } });
      createdExpenses += 2;
      for (const def of expenseDefs) {
        await prisma.expense.create({
          data: {
            category: def.category,
            amount: randomInt(def.min, def.max),
            description: randomItem(def.descriptions),
            date: inMonth(randomInt(2, 27)),
            recordedByUserId: randomItem([owner.id, manager.id]),
          },
        });
        createdExpenses++;
      }
    }
    console.log(`${createdExpenses} gider kaydı hazır (son 4 ay).`);
  } else {
    console.log(`Zaten ${expenseCount} gider var, atlanıyor.`);
  }

  // ══════════════════════════════════════════════════════════════════════
  // KVKK VERİ SİLME TALEPLERİ — PENDING / REJECTED / COMPLETED örnekleri.
  // COMPLETED talep, dataDeletionController'ın yaptığı gibi anonimleştirilmiş
  // bir müşteriye bağlanır (gerçek bir müşterinin verisi silinmez).
  // ══════════════════════════════════════════════════════════════════════
  const deletionCount = await prisma.dataDeletionRequest.count();
  if (deletionCount === 0) {
    const pendingCustomer = customers.find((c) => c.fullName === "Tolga Bayraktar") ?? customers[0];
    const rejectedCustomer = customers.find((c) => c.fullName === "Serkan Tekin") ?? customers[1];
    await prisma.dataDeletionRequest.create({
      data: { customerId: pendingCustomer.id, requestedAt: daysFromNow(-2) },
    });
    await prisma.dataDeletionRequest.create({
      data: {
        customerId: rejectedCustomer.id,
        status: "REJECTED",
        requestedAt: daysFromNow(-25),
        processedByUserId: owner.id,
        processedAt: daysFromNow(-23),
        rejectionReason: "Aktif sözleşme ve açık bakiye bulunduğundan yasal saklama süresi dolmadan silinemez.",
      },
    });
    const anonymized = await prisma.customer.create({
      data: { fullName: "Silinmiş Müşteri", phone: "000 000 00 00" },
    });
    await prisma.dataDeletionRequest.create({
      data: {
        customerId: anonymized.id,
        status: "COMPLETED",
        requestedAt: daysFromNow(-40),
        processedByUserId: owner.id,
        processedAt: daysFromNow(-38),
      },
    });
    console.log("3 veri silme talebi hazır (Bekliyor / Reddedildi / Tamamlandı).");
  } else {
    console.log(`Zaten ${deletionCount} veri silme talebi var, atlanıyor.`);
  }

  // ══════════════════════════════════════════════════════════════════════
  // ORGANİZASYON ŞEMASI — şefi tanımsız STAFF'ları şeflere dağıt. Model düz:
  // STAFF → TEAM_LEAD (getTeamStaffIds tek seviye); TEAM_LEAD/MANAGER kök.
  // Kasıtlı olarak bağlantısız bırakılanlar: Burak Aydın (seed.ts'te
  // supervised:false örneği) ve adı "Outside" geçen test hesabı.
  // ══════════════════════════════════════════════════════════════════════
  const teamLeads = await prisma.staff.findMany({
    where: { archivedAt: null, user: { role: "TEAM_LEAD", isActive: true } },
    orderBy: { createdAt: "asc" },
  });
  const orphanStaff = await prisma.staff.findMany({
    where: {
      archivedAt: null,
      supervisorId: null,
      user: {
        role: "STAFF",
        isActive: true,
        email: { not: "personel5@nilufer.com" },
        NOT: { fullName: { contains: "Outside" } },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  if (teamLeads.length > 0 && orphanStaff.length > 0) {
    for (const [i, s] of orphanStaff.entries()) {
      await prisma.staff.update({ where: { id: s.id }, data: { supervisorId: teamLeads[i % teamLeads.length].id } });
    }
    console.log(`${orphanStaff.length} personel bir şefe bağlandı (${teamLeads.length} şef).`);
  } else {
    console.log("Şefi tanımsız personel yok (kasıtlı örnekler hariç), atlanıyor.");
  }
  // Şefler müdüre raporlar (supervisorId polimorfik: MANAGER için User.id —
  // bkz. staffController.getOrgChart / resolveSupervisorInfo). Erişim kapsamı
  // (getTeamStaffIds) tek seviyeli kaldığı için yalnızca şema görünümünü etkiler.
  const leadsWithoutManager = teamLeads.filter((t) => !t.supervisorId);
  if (leadsWithoutManager.length > 0) {
    await prisma.staff.updateMany({
      where: { id: { in: leadsWithoutManager.map((t) => t.id) } },
      data: { supervisorId: manager.id },
    });
    console.log(`${leadsWithoutManager.length} şef müdüre (${manager.fullName}) bağlandı.`);
  }

  // ══════════════════════════════════════════════════════════════════════
  // SAHA RAPORLARI — raporsuz tamamlanmış işlere onaylı JobReport. Önceden
  // 55 tamamlanmış işin 41'inde rapor yoktu → müşteri detayındaki "Rapor PDF"
  // 404 ("İş raporu bulunamadı") dönüyordu.
  // ══════════════════════════════════════════════════════════════════════
  const reportlessJobs = await prisma.job.findMany({
    where: { status: JobStatus.COMPLETED, assignedStaffId: { not: null }, jobReports: { none: {} } },
  });
  if (reportlessJobs.length > 0) {
    const usedProducts = allProducts.filter((p) => p.category === ProductCategory.BIOCIDAL);
    for (const job of reportlessJobs) {
      const product = usedProducts.length > 0 ? randomItem(usedProducts) : null;
      const doneAt = job.completedAt ?? job.scheduledAt ?? new Date();
      await prisma.jobReport.create({
        data: {
          jobId: job.id,
          staffId: job.assignedStaffId!,
          productsUsed: product ? `${product.name} (${product.unit})` : "Jel yem",
          dosage: randomItem(["%1 seyreltme, 50 ml/m²", "10 ml/L su, yüzey püskürtme", "Nokta uygulama, 0,5 g/nokta", "Yem istasyonu başına 40 g"]),
          notes: randomItem([
            "Uygulama sorunsuz tamamlandı, müşteri bilgilendirildi.",
            "Yoğun bulaşık alan tespit edildi; 15 gün sonra kontrol önerildi.",
            "Giriş noktaları kapatılması için öneride bulunuldu.",
            null,
          ]),
          approvedAt: new Date(doneAt.getTime() + randomInt(2, 30) * 3600 * 1000),
          approvedByUserId: manager.id,
          createdAt: doneAt,
        },
      });
    }
    console.log(`${reportlessJobs.length} tamamlanmış işe onaylı saha raporu eklendi.`);
  } else {
    console.log("Raporsuz tamamlanmış iş yok, atlanıyor.");
  }

  // ══════════════════════════════════════════════════════════════════════
  // AVANS GEÇMİŞİ — Bekleyen Onaylar → avans kartındaki geçmiş/güvenilirlik
  // özeti boş kalmasın: saha personeline geçmiş onaylı/reddedilmiş avanslar.
  // ══════════════════════════════════════════════════════════════════════
  const decidedAdvances = await prisma.advanceRequest.count({ where: { status: { not: "PENDING" } } });
  if (decidedAdvances < 6) {
    const reasons = ["Kira ödemesi", "Araç bakımı", "Sağlık gideri", "Okul masrafı", "Ailevi ihtiyaç"];
    let createdAdvances = 0;
    for (const staff of allFieldStaff) {
      const n = randomInt(1, 3);
      for (let i = 0; i < n; i++) {
        const approved = Math.random() > 0.25;
        const createdAt = daysFromNow(-randomInt(30, 300));
        await prisma.advanceRequest.create({
          data: {
            staffId: staff.id,
            amount: randomItem([1000, 1500, 2000, 2500, 3000]),
            reason: randomItem(reasons),
            status: approved ? "APPROVED" : "REJECTED",
            createdAt,
          },
        });
        createdAdvances++;
      }
    }
    console.log(`${createdAdvances} geçmiş avans kaydı hazır.`);
  } else {
    console.log(`Zaten ${decidedAdvances} sonuçlanmış avans var, atlanıyor.`);
  }

  // ══════════════════════════════════════════════════════════════════════
  // BUGÜNÜN İŞLERİ — demo sonraki günlerde gösterildiğinde de Ana Sayfa
  // "Bugünkü İş" kartı ve takvim boş kalmasın (bugün hiç iş yoksa eklenir).
  // ══════════════════════════════════════════════════════════════════════
  const todayStart = dateOnly(0);
  const todayEnd = new Date(todayStart.getTime() + 24 * 3600 * 1000 - 1);
  const todaysJobs = await prisma.job.count({ where: { scheduledAt: { gte: todayStart, lte: todayEnd } } });
  if (todaysJobs === 0) {
    const plans: JobStatus[] = [JobStatus.SCHEDULED, JobStatus.SCHEDULED, JobStatus.IN_PROGRESS, JobStatus.SCHEDULED, JobStatus.PENDING];
    for (const status of plans) {
      const scheduledAt = daysFromNow(0);
      await prisma.job.create({
        data: {
          customerId: randomItem(customers).id,
          assignedStaffId: status === JobStatus.PENDING ? undefined : randomItem(allFieldStaff).id,
          serviceType: randomItem(serviceTypes),
          status,
          scheduledAt,
          scheduledEndAt: new Date(scheduledAt.getTime() + randomInt(1, 2) * 3600 * 1000),
          startedAt: status === JobStatus.IN_PROGRESS ? scheduledAt : undefined,
          price: randomInt(500, 2800),
        },
      });
    }
    console.log(`${plans.length} bugünkü iş eklendi.`);
  } else {
    console.log(`Bugün için zaten ${todaysJobs} iş var, atlanıyor.`);
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

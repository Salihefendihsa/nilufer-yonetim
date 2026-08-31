import bcrypt from "bcrypt";
import { PrismaClient, Role, JobStatus, AdvanceStatus, RecurrenceType, StockMovementType } from "@prisma/client";

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;
const DEMO_PASSWORD = "Test1234!";

const DISTRICTS = ["Nilüfer", "Osmangazi", "Yıldırım", "Mudanya", "Gemlik", "Karacabey"];

const SERVICE_TYPES = [
  "Genel Haşere İlaçlama",
  "Hamamböceği İlaçlama",
  "Fare ve Kemirgen Kontrolü",
  "Karınca İlaçlama",
  "Güve İlaçlama",
  "Sivrisinek ve Karasinek İlaçlama",
];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

async function upsertUser(email: string, fullName: string, role: Role, phone: string, passwordHash: string) {
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, fullName, role, phone, passwordHash },
  });
}

async function main() {
  console.log("Seed başlıyor...");
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, SALT_ROUNDS);

  // ── Districts ──
  for (const name of DISTRICTS) {
    await prisma.district.upsert({ where: { name }, update: {}, create: { name } });
  }
  console.log(`${DISTRICTS.length} ilçe hazır.`);

  // ── Service types ──
  for (const name of SERVICE_TYPES) {
    await prisma.serviceType.upsert({ where: { name }, update: {}, create: { name } });
  }
  console.log(`${SERVICE_TYPES.length} hizmet türü hazır.`);

  // ── Settings ──
  const settings: Record<string, string> = {
    company_name: "Nilüfer İlaçlama",
    company_phone: "0224 555 12 34",
    company_email: "info@nilufer-ilaclama.com",
    company_address: "Fethiye Mah. Üçevler Cad. No: 14, Nilüfer / Bursa",
    contract_expiry_reminder_days: "30,14,7,1",
  };
  for (const [key, value] of Object.entries(settings)) {
    await prisma.setting.upsert({ where: { key }, update: {}, create: { key, value } });
  }
  console.log(`${Object.keys(settings).length} ayar hazır.`);

  // ── Staff (manager, team lead, staff) ──
  const manager = await upsertUser("manager@nilufer.com", "Ayşe Yılmaz", Role.MANAGER, "0532 111 22 33", passwordHash);
  const managerStaff = await prisma.staff.upsert({
    where: { userId: manager.id },
    update: {},
    create: { userId: manager.id, position: "Operasyon Müdürü", salaryBase: 35000 },
  });

  const teamLead = await upsertUser("ekiplideri@nilufer.com", "Mehmet Demir", Role.TEAM_LEAD, "0532 222 33 44", passwordHash);
  const teamLeadStaff = await prisma.staff.upsert({
    where: { userId: teamLead.id },
    update: {},
    create: { userId: teamLead.id, position: "Saha Ekip Lideri", salaryBase: 28000 },
  });

  const staffDefs = [
    { email: "personel1@nilufer.com", fullName: "Ali Kaya", phone: "0533 111 11 11", position: "İlaçlama Teknisyeni", salary: 18000, supervised: true },
    { email: "personel2@nilufer.com", fullName: "Veli Çelik", phone: "0533 222 22 22", position: "İlaçlama Teknisyeni", salary: 18000, supervised: true },
    { email: "personel3@nilufer.com", fullName: "Hasan Şahin", phone: "0533 333 33 33", position: "İlaçlama Teknisyeni", salary: 19000, supervised: true },
    { email: "personel4@nilufer.com", fullName: "Emre Kurt", phone: "0533 444 44 44", position: "Kıdemli Teknisyen", salary: 21000, supervised: false },
    { email: "personel5@nilufer.com", fullName: "Burak Aydın", phone: "0533 555 55 55", position: "İlaçlama Teknisyeni", salary: 18500, supervised: false },
  ];

  const staffList = [];
  for (const def of staffDefs) {
    const user = await upsertUser(def.email, def.fullName, Role.STAFF, def.phone, passwordHash);
    const staff = await prisma.staff.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        position: def.position,
        salaryBase: def.salary,
        supervisorId: def.supervised ? teamLeadStaff.id : undefined,
      },
    });
    staffList.push(staff);
  }
  const allFieldStaff = [teamLeadStaff, ...staffList];
  console.log(`1 müdür, 1 ekip lideri, ${staffList.length} personel hazır.`);

  // ── Customers ──
  const customerDefs: { fullName: string; phone: string; email?: string; hasBalance: boolean }[] = [
    { fullName: "Ahmet Yıldız", phone: "0541 100 10 01", email: "ahmet.yildiz@example.com", hasBalance: true },
    { fullName: "Fatma Kara", phone: "0541 100 10 02", hasBalance: false },
    { fullName: "Mustafa Öztürk", phone: "0541 100 10 03", email: "mustafa.ozturk@example.com", hasBalance: true },
    { fullName: "Zeynep Aydın", phone: "0541 100 10 04", hasBalance: false },
    { fullName: "İbrahim Çetin", phone: "0541 100 10 05", email: "ibrahim.cetin@example.com", hasBalance: true },
    { fullName: "Hüseyin Arslan", phone: "0541 100 10 06", hasBalance: false },
    { fullName: "Elif Doğan", phone: "0541 100 10 07", email: "elif.dogan@example.com", hasBalance: false },
    { fullName: "Hatice Koç", phone: "0541 100 10 08", hasBalance: true },
    { fullName: "Yusuf Şen", phone: "0541 100 10 09", hasBalance: false },
    { fullName: "Emine Aksoy", phone: "0541 100 10 10", email: "emine.aksoy@example.com", hasBalance: true },
    { fullName: "Osman Yılmaz", phone: "0541 100 10 11", hasBalance: false },
    { fullName: "Sultan Kılıç", phone: "0541 100 10 12", hasBalance: true },
    { fullName: "Ramazan Güneş", phone: "0541 100 10 13", hasBalance: false },
    { fullName: "Meryem Polat", phone: "0541 100 10 14", email: "meryem.polat@example.com", hasBalance: false },
    { fullName: "Kemal Bulut", phone: "0541 100 10 15", hasBalance: true },
    { fullName: "Bahar Pastanesi", phone: "0224 200 20 01", email: "iletisim@baharpastanesi.com", hasBalance: true },
    { fullName: "Yeşim Tekstil San. Tic. Ltd. Şti.", phone: "0224 200 20 02", email: "info@yesimtekstil.com", hasBalance: false },
    { fullName: "Bursa Cafe & Restoran", phone: "0224 200 20 03", email: "info@bursacaferestoran.com", hasBalance: true },
  ];

  const customers = [];
  for (const [i, def] of customerDefs.entries()) {
    const district = DISTRICTS[i % DISTRICTS.length];
    const customer = await prisma.customer.create({
      data: {
        fullName: def.fullName,
        phone: def.phone,
        email: def.email,
        address: `${district} Mah. ${randomInt(1, 40)}. Sokak No: ${randomInt(1, 90)}`,
        district,
      },
    });
    customers.push({ ...customer, hasBalance: def.hasBalance });
  }

  // Two customers get a login account for demo messaging.
  const demoCustomerUser1 = await upsertUser("musteri1@nilufer.com", customers[0].fullName, Role.CUSTOMER, customers[0].phone, passwordHash);
  await prisma.customer.update({ where: { id: customers[0].id }, data: { userId: demoCustomerUser1.id } });
  const demoCustomerUser2 = await upsertUser("musteri2@nilufer.com", customers[1].fullName, Role.CUSTOMER, customers[1].phone, passwordHash);
  await prisma.customer.update({ where: { id: customers[1].id }, data: { userId: demoCustomerUser2.id } });

  console.log(`${customers.length} müşteri hazır.`);

  // ── Products ──
  const productDefs = [
    { name: "K-Othrine SC 25", unit: "Litre", currentStock: 18, criticalThreshold: 5 },
    { name: "Solfac EW 050", unit: "Litre", currentStock: 12, criticalThreshold: 5 },
    { name: "Fendona 6SC", unit: "Litre", currentStock: 3, criticalThreshold: 5 }, // kritik seviyenin altında
    { name: "Rat-a-way Kemirgen Yemi", unit: "Kg", currentStock: 25, criticalThreshold: 8 },
    { name: "Maxforce Karınca Jeli", unit: "Adet", currentStock: 40, criticalThreshold: 10 },
    { name: "Biyosidal Sis Jeneratörü Solüsyonu", unit: "Litre", currentStock: 9, criticalThreshold: 4 },
  ];
  const products = [];
  for (const def of productDefs) {
    const existing = await prisma.product.findFirst({ where: { name: def.name } });
    const product = existing ?? (await prisma.product.create({ data: def }));
    products.push(product);
  }
  console.log(`${products.length} ürün hazır (1 tanesi kritik seviyenin altında).`);

  // ── Jobs (past completed + future planned) ──
  const jobs = [];
  const totalJobs = 36;
  for (let i = 0; i < totalJobs; i++) {
    const customer = randomItem(customers);
    const staff = randomItem(allFieldStaff);
    const serviceType = randomItem(SERVICE_TYPES);
    const isPast = i < 22; // ~22 geçmiş, ~14 gelecek

    if (isPast) {
      const completedAt = daysFromNow(-randomInt(1, 180));
      const job = await prisma.job.create({
        data: {
          customerId: customer.id,
          assignedStaffId: staff.id,
          serviceType,
          status: JobStatus.COMPLETED,
          scheduledAt: completedAt,
          completedAt,
          price: randomInt(300, 2500),
          rating: Math.random() > 0.35 ? randomInt(3, 5) : null,
          ratingComment: Math.random() > 0.6 ? randomItem([
            "Çok memnun kaldık, teşekkürler.",
            "Zamanında geldiler, işlerini titizlikle yaptılar.",
            "Fiyat performans açısından gayet iyi.",
            "Tekrar hizmet almak isteriz.",
          ]) : null,
        },
      });
      jobs.push(job);

      // Bazı tamamlanmış işlere JobReport ekle
      if (Math.random() > 0.4) {
        const product = randomItem(products);
        const quantity = randomInt(1, 5);
        const jobReport = await prisma.jobReport.create({
          data: {
            jobId: job.id,
            staffId: staff.id,
            productId: product.id,
            quantity,
            dosage: `${randomInt(10, 50)} ml/m²`,
            notes: "Uygulama sorunsuz tamamlandı.",
          },
        });
        await prisma.$transaction([
          prisma.product.update({ where: { id: product.id }, data: { currentStock: { decrement: quantity } } }),
          prisma.stockMovement.create({
            data: {
              productId: product.id,
              type: StockMovementType.OUT,
              quantity,
              relatedJobReportId: jobReport.id,
              note: `${job.serviceType} için kullanıldı`,
            },
          }),
        ]);
      }
    } else {
      const scheduledAt = daysFromNow(randomInt(1, 45));
      const job = await prisma.job.create({
        data: {
          customerId: customer.id,
          assignedStaffId: Math.random() > 0.2 ? staff.id : undefined,
          serviceType,
          status: JobStatus.PENDING,
          scheduledAt,
          price: randomInt(300, 2500),
        },
      });
      jobs.push(job);
    }
  }
  console.log(`${jobs.length} iş hazır.`);

  // ── Contracts ──
  const contractDefs = [
    { customer: customers[0], startOffset: -300, months: 12, recurrence: RecurrenceType.MONTHLY },
    { customer: customers[1], startOffset: -350, months: 12, recurrence: null }, // 15 gün içinde bitecek
    { customer: customers[2], startOffset: -180, months: 6, recurrence: RecurrenceType.QUARTERLY },
    { customer: customers[3], startOffset: -358, months: 12, recurrence: null }, // 7 gün içinde bitecek
    { customer: customers[4], startOffset: -60, months: 12, recurrence: RecurrenceType.MONTHLY },
    { customer: customers[5], startOffset: -200, months: 12, recurrence: null },
    { customer: customers[6], startOffset: -364, months: 12, recurrence: null }, // 1 gün içinde bitecek
    { customer: customers[15], startOffset: -90, months: 24, recurrence: RecurrenceType.QUARTERLY },
    { customer: customers[16], startOffset: -400, months: 12, recurrence: null }, // süresi dolmuş
  ];

  const contracts = [];
  for (const def of contractDefs) {
    const startDate = daysFromNow(def.startOffset);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + def.months);
    const status = endDate < new Date() ? "EXPIRED" : "ACTIVE";
    const nextGenerationDate =
      def.recurrence && status === "ACTIVE"
        ? daysFromNow(def.recurrence === RecurrenceType.MONTHLY ? randomInt(1, 30) : randomInt(1, 90))
        : null;

    const contract = await prisma.contract.create({
      data: {
        customerId: def.customer.id,
        startDate,
        endDate,
        durationMonths: def.months,
        status,
        serviceType: randomItem(SERVICE_TYPES),
        recurrenceType: def.recurrence,
        nextGenerationDate,
      },
    });
    contracts.push(contract);
  }
  console.log(`${contracts.length} sözleşme hazır.`);

  // ── Payments ──
  const paymentTypes = ["Nakit", "Havale/EFT", "Kredi Kartı"];
  let paymentCount = 0;
  for (const customer of customers.filter((c) => c.hasBalance || Math.random() > 0.4)) {
    const count = randomInt(1, 2);
    for (let i = 0; i < count; i++) {
      await prisma.payment.create({
        data: {
          customerId: customer.id,
          amount: randomInt(250, 3000),
          paymentType: randomItem(paymentTypes),
          createdAt: daysFromNow(-randomInt(1, 300)),
        },
      });
      paymentCount++;
    }
  }
  console.log(`${paymentCount} ödeme hazır.`);

  // ── Quote requests ──
  const quoteDefs = [
    { fullName: "Cengiz Aktaş", phone: "0542 300 10 01", propertyType: "Konut", serviceType: "Genel Haşere İlaçlama", district: "Osmangazi", status: "NEW" },
    { fullName: "Derya Ersoy", phone: "0542 300 10 02", propertyType: "İş Yeri", serviceType: "Hamamböceği İlaçlama", district: "Nilüfer", status: "NEW" },
    { fullName: "Onur Kaplan", phone: "0542 300 10 03", propertyType: "Restoran", serviceType: "Fare ve Kemirgen Kontrolü", district: "Yıldırım", status: "CONTACTED" },
    { fullName: "Selin Yavuz", phone: "0542 300 10 04", propertyType: "Konut", serviceType: "Karınca İlaçlama", district: "Mudanya", status: "CONTACTED" },
    { fullName: "Gökhan Demirtaş", phone: "0542 300 10 05", propertyType: "Depo", serviceType: "Fare ve Kemirgen Kontrolü", district: "Gemlik", status: "CONVERTED" },
    { fullName: "Pınar Uysal", phone: "0542 300 10 06", propertyType: "Konut", serviceType: "Sivrisinek ve Karasinek İlaçlama", district: "Karacabey", status: "NEW" },
  ];
  for (const def of quoteDefs) {
    await prisma.quoteRequest.create({ data: def });
  }
  console.log(`${quoteDefs.length} teklif talebi hazır.`);

  // ── Advance requests ──
  const advanceDefs = [
    { staff: staffList[0], amount: 1500, reason: "Ailevi acil ihtiyaç", status: AdvanceStatus.PENDING },
    { staff: staffList[1], amount: 2000, reason: "Kira ödemesi", status: AdvanceStatus.APPROVED },
    { staff: staffList[2], amount: 1000, reason: "Sağlık gideri", status: AdvanceStatus.REJECTED },
    { staff: teamLeadStaff, amount: 2500, reason: "Araç bakımı", status: AdvanceStatus.PENDING },
  ];
  for (const def of advanceDefs) {
    await prisma.advanceRequest.create({
      data: { staffId: def.staff.id, amount: def.amount, reason: def.reason, status: def.status },
    });
  }
  console.log(`${advanceDefs.length} avans talebi hazır.`);

  // ── Conversations & messages ──
  const ownerUser = await prisma.user.findUnique({ where: { email: "owner@nilufer.com" } });
  if (ownerUser) {
    const conv1 = await prisma.conversation.upsert({
      where: { participantAId_participantBId: { participantAId: ownerUser.id, participantBId: manager.id } },
      update: {},
      create: { participantAId: ownerUser.id, participantBId: manager.id },
    });
    await prisma.message.createMany({
      data: [
        { conversationId: conv1.id, senderId: ownerUser.id, content: "Bu hafta tamamlanan iş sayısını bir raporlayabilir misin?" },
        { conversationId: conv1.id, senderId: manager.id, content: "Tabii, akşama kadar hazırlayıp iletirim." },
      ],
    });
  }

  const conv2 = await prisma.conversation.upsert({
    where: { participantAId_participantBId: { participantAId: demoCustomerUser1.id, participantBId: teamLead.id } },
    update: {},
    create: { participantAId: demoCustomerUser1.id, participantBId: teamLead.id },
  });
  await prisma.message.createMany({
    data: [
      { conversationId: conv2.id, senderId: demoCustomerUser1.id, content: "Merhaba, önümüzdeki hafta için randevu alabilir miyim?" },
      { conversationId: conv2.id, senderId: teamLead.id, content: "Merhaba, salı günü saat 10:00 uygun olur mu?" },
      { conversationId: conv2.id, senderId: demoCustomerUser1.id, content: "Evet, uygun. Teşekkürler." },
    ],
  });
  console.log("Örnek konuşmalar hazır.");

  console.log("Seed tamamlandı.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

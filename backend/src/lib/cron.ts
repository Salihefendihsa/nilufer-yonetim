import cron from "node-cron";
import { JobStatus, StaffStatus } from "@prisma/client";
import { prisma } from "./prisma";
import { withCronLock } from "./distributedLock";
import { sendWeeklyDigest } from "./weeklyDigest";
import { addRecurrencePeriod } from "./recurrence";
import {
  sendUpcomingJobReminders,
  sendOverduePaymentDigest,
  sendPendingApprovalReminders,
  sendContractExpiryReminders,
  sendCertificationExpiryReminders,
  sendDailyDigest,
  sweepLowStockAlerts,
  sweepContractRenewalAlerts,
  sweepExpiringBatchAlerts,
  sweepVehicleMaintenanceAlerts,
} from "./reminders";

/**
 * Süresi dolmuş personel durumlarını (mola/izin bitişi) AVAILABLE'a döndürür.
 * Yalnızca cron'a değil — okuma anında da (bkz. staffController.healExpiredStatuses)
 * aynı mantık çağrılır, böylece iki tetik arasındaki pencerede bile bayat
 * "Molada" durumu görünmez.
 */
export async function resetExpiredStaffStatuses(): Promise<number> {
  const result = await prisma.staff.updateMany({
    where: { statusUntil: { lte: new Date() }, status: { not: StaffStatus.AVAILABLE } },
    data: { status: StaffStatus.AVAILABLE, statusUntil: null },
  });
  return result.count;
}

/**
 * @param onlyContractIds Testlerde yalnızca belirli sözleşmeleri işlemek için
 *   (gerçek dev verisine dokunmamak adına); üretimde verilmez → tüm vadesi
 *   gelmiş sözleşmeler.
 */
/**
 * Bitiş tarihi geçmiş ama hâlâ ACTIVE görünen sözleşmeleri EXPIRED'a çeker.
 * Eskiden otomatik geçiş yoktu: süresi dolan sözleşme "aktif" sayılıyor ve
 * periyodik iş üretmeye devam ediyordu (bkz. docs/HEALTH_AUDIT.md V-4).
 * generateRecurringJobs'tan önce aynı gece kilidi içinde çalışır.
 */
export async function expireEndedContracts(onlyContractIds?: string[]): Promise<number> {
  const result = await prisma.contract.updateMany({
    where: {
      status: "ACTIVE",
      endDate: { lt: new Date() },
      ...(onlyContractIds ? { id: { in: onlyContractIds } } : {}),
    },
    data: { status: "EXPIRED" },
  });
  return result.count;
}

export async function generateRecurringJobs(onlyContractIds?: string[]) {
  const now = new Date();

  const dueContracts = await prisma.contract.findMany({
    where: {
      recurrenceType: { not: null },
      nextGenerationDate: { lte: now },
      // Yalnızca yürürlükteki sözleşmeler: süresi dolmuş / iptal edilmiş
      // sözleşme için periyodik iş üretilmez.
      status: "ACTIVE",
      endDate: { gt: now },
      // Bölüm Q: müşterinin duraklattığı sözleşme için iş üretilmez.
      isPaused: false,
      ...(onlyContractIds ? { id: { in: onlyContractIds } } : {}),
    },
  });

  for (const contract of dueContracts) {
    await prisma.job.create({
      data: {
        customerId: contract.customerId,
        serviceType: contract.serviceType ?? "Periyodik Bakım",
        status: JobStatus.PENDING,
      },
    });

    await prisma.contract.update({
      where: { id: contract.id },
      data: { nextGenerationDate: addRecurrencePeriod(contract.nextGenerationDate!, contract.recurrenceType!) },
    });
  }

  return dueContracts.length;
}

/**
 * Her cron callback'i `withCronLock` ile sarılır (bkz. lib/distributedLock.ts).
 * Tek instance çalışırken davranış aynen korunur (kilit her zaman boş); API
 * yatay ölçeklenip 2+ instance çalıştığında ise aynı işin/e-postanın her
 * instance'ta ayrı ayrı üretilmesini engeller.
 */
export function startRecurringJobsCron() {
  cron.schedule("0 2 * * *", () => {
    withCronLock("recurring-jobs", async () => {
      await expireEndedContracts();
      await generateRecurringJobs();
    }).catch((err) => {
      console.error("Recurring job generation failed:", err);
    });
  });
}

export function startReminderCrons() {
  // Yaklaşan iş hatırlatması — her 15 dakikada bir, ~1 saat kala.
  cron.schedule("*/15 * * * *", () => {
    withCronLock("upcoming-job-reminders", sendUpcomingJobReminders).catch((err) =>
      console.error("Yaklaşan iş hatırlatması başarısız:", err)
    );
  });

  // Süresi dolan personel mola/izin durumlarını temizle — her 5 dakikada bir.
  cron.schedule("*/5 * * * *", () => {
    withCronLock("reset-expired-staff-statuses", async () => {
      await resetExpiredStaffStatuses();
    }).catch((err) => console.error("Personel durumu sıfırlama başarısız:", err));
  });

  // Kritik stok uyarısı güvenlik ağı — her saat başı. checkLowStockAndNotify
  // yalnızca iş raporu stok düşüşünde tetiklenir; bu tarama sayım/mal kabul
  // gibi diğer yollardan düşen stokları da yakalar (bkz. lib/reminders.ts).
  cron.schedule("0 * * * *", () => {
    withCronLock("sweep-low-stock-alerts", sweepLowStockAlerts).catch((err) =>
      console.error("Kritik stok taraması başarısız:", err)
    );
  });

  // Günlük hatırlatıcılar — 08:00. Her biri kendi kilidiyle — biri diğerini
  // engellemez, ama her biri kendi içinde tekilleşir.
  cron.schedule("0 8 * * *", () => {
    withCronLock("overdue-payment-digest", sendOverduePaymentDigest).catch((err) =>
      console.error("Gecikmiş ödeme özeti başarısız:", err)
    );
    withCronLock("pending-approval-reminders", sendPendingApprovalReminders).catch((err) =>
      console.error("Bekleyen onay hatırlatması başarısız:", err)
    );
    withCronLock("contract-expiry-reminders", sendContractExpiryReminders).catch((err) =>
      console.error("Sözleşme bitiş hatırlatması başarısız:", err)
    );
    withCronLock("certification-expiry-reminders", sendCertificationExpiryReminders).catch((err) =>
      console.error("Sertifika bitiş hatırlatması başarısız:", err)
    );
    // Bölüm B (2. tur): 7 gün veya daha az kalan sözleşmeler için sözleşme
    // bazlı, daha aciliyetli ikinci bir hatırlatma — 30 günlük özetin YERİNE değil, yanına.
    withCronLock("contract-renewal-alerts", sweepContractRenewalAlerts).catch((err) =>
      console.error("Sözleşme yenileme taraması başarısız:", err)
    );
    // Bölüm AM (9. tur): SKT'si 7 gün içinde dolacak/dolmuş partiler (günlük dedup).
    withCronLock("expiring-batch-alerts", sweepExpiringBatchAlerts).catch((err) =>
      console.error("Parti SKT taraması başarısız:", err)
    );
    // Bölüm AQ (9. tur): 14 gün içinde vadesi gelen araç bakımları (günlük dedup).
    withCronLock("vehicle-maintenance-alerts", sweepVehicleMaintenanceAlerts).catch((err) =>
      console.error("Araç bakım taraması başarısız:", err)
    );
  });

  // Günlük özet emaili — 07:00.
  cron.schedule("0 7 * * *", () => {
    withCronLock("daily-digest-email", sendDailyDigest).catch((err) =>
      console.error("Günlük özet emaili başarısız:", err)
    );
  });

  // Bölüm AF (7. tur): haftalık yönetici özeti — Pazartesi 08:00 (OWNER,
  // weeklyDigestEnabled). SMTP yoksa sessizce atlar.
  cron.schedule("0 8 * * 1", () => {
    withCronLock("weekly-digest-email", sendWeeklyDigest).catch((err) =>
      console.error("Haftalık özet emaili başarısız:", err)
    );
  });
}

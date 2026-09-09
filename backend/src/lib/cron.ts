import cron from "node-cron";
import { JobStatus, StaffStatus } from "@prisma/client";
import { prisma } from "./prisma";
import { addRecurrencePeriod } from "./recurrence";
import {
  sendUpcomingJobReminders,
  sendOverduePaymentDigest,
  sendPendingApprovalReminders,
  sendContractExpiryReminders,
  sendCertificationExpiryReminders,
  sendDailyDigest,
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

export async function generateRecurringJobs() {
  const now = new Date();

  const dueContracts = await prisma.contract.findMany({
    where: {
      recurrenceType: { not: null },
      nextGenerationDate: { lte: now },
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

export function startRecurringJobsCron() {
  cron.schedule("0 2 * * *", () => {
    generateRecurringJobs().catch((err) => {
      console.error("Recurring job generation failed:", err);
    });
  });
}

export function startReminderCrons() {
  // Yaklaşan iş hatırlatması — her 15 dakikada bir, ~1 saat kala.
  cron.schedule("*/15 * * * *", () => {
    sendUpcomingJobReminders().catch((err) => console.error("Yaklaşan iş hatırlatması başarısız:", err));
  });

  // Süresi dolan personel mola/izin durumlarını temizle — her 5 dakikada bir.
  cron.schedule("*/5 * * * *", () => {
    resetExpiredStaffStatuses().catch((err) => console.error("Personel durumu sıfırlama başarısız:", err));
  });

  // Günlük hatırlatıcılar — 08:00.
  cron.schedule("0 8 * * *", () => {
    sendOverduePaymentDigest().catch((err) => console.error("Gecikmiş ödeme özeti başarısız:", err));
    sendPendingApprovalReminders().catch((err) => console.error("Bekleyen onay hatırlatması başarısız:", err));
    sendContractExpiryReminders().catch((err) => console.error("Sözleşme bitiş hatırlatması başarısız:", err));
    sendCertificationExpiryReminders().catch((err) => console.error("Sertifika bitiş hatırlatması başarısız:", err));
  });

  // Günlük özet emaili — 07:00.
  cron.schedule("0 7 * * *", () => {
    sendDailyDigest().catch((err) => console.error("Günlük özet emaili başarısız:", err));
  });
}

import cron from "node-cron";
import { JobStatus } from "@prisma/client";
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

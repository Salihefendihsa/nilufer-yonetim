import { Role, AdvanceStatus, JobStatus } from "@prisma/client";
import { prisma } from "./prisma";
import { notifyUser, notifyUsers } from "./notify";
import { sendEmail } from "./email";

const UPCOMING_JOB_WINDOW_START_MIN = 55;
const UPCOMING_JOB_WINDOW_END_MIN = 70;
const OVERDUE_PAYMENT_DAYS = 30;
const PENDING_APPROVAL_HOURS = 48;
const CONTRACT_EXPIRY_DAYS = 30;

interface UserForEmail {
  id: string;
  email: string;
}

async function shouldEmail(userId: string, field: "emailEnabled" | "dailyDigestEnabled"): Promise<boolean> {
  const preference = await prisma.notificationPreference.findUnique({ where: { userId } });
  if (!preference) return true; // no row yet — schema default is enabled
  return preference[field];
}

async function getOwners(): Promise<UserForEmail[]> {
  return prisma.user.findMany({ where: { role: Role.OWNER }, select: { id: true, email: true } });
}

async function notifyOwners(title: string, body: string): Promise<void> {
  const owners = await getOwners();
  await notifyUsers(owners.map((o) => o.id), title, body);

  for (const owner of owners) {
    if (await shouldEmail(owner.id, "emailEnabled")) {
      await sendEmail(owner.email, title, `<p>${body}</p>`);
    }
  }
}

/**
 * Checked right after a stock decrement (not on a cron tick) so the OWNER hears about a
 * critical shortage the moment it happens, not up to a day later.
 */
export async function checkLowStockAndNotify(productId: string): Promise<void> {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return;
  if (Number(product.currentStock) > Number(product.criticalThreshold)) return;

  await notifyOwners(
    "Kritik stok uyarısı",
    `${product.name} stoğu kritik seviyenin altına düştü (${Number(product.currentStock)} ${product.unit} kaldı).`
  );
}

/** Every ~15 minutes: nudge staff whose job starts in about an hour. */
export async function sendUpcomingJobReminders(): Promise<number> {
  const now = new Date();
  const windowStart = new Date(now.getTime() + UPCOMING_JOB_WINDOW_START_MIN * 60 * 1000);
  const windowEnd = new Date(now.getTime() + UPCOMING_JOB_WINDOW_END_MIN * 60 * 1000);

  const jobs = await prisma.job.findMany({
    where: {
      scheduledAt: { gte: windowStart, lte: windowEnd },
      status: { in: [JobStatus.PENDING, JobStatus.SCHEDULED] },
      assignedStaffId: { not: null },
    },
    include: {
      customer: { select: { fullName: true } },
      assignedStaff: { include: { user: { select: { id: true, email: true } } } },
    },
  });

  for (const job of jobs) {
    const staffUser = job.assignedStaff?.user;
    if (!staffUser) continue;

    const timeLabel = job.scheduledAt!.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
    const title = "Yaklaşan işiniz var";
    const body = `${job.serviceType} - ${job.customer.fullName} - ${timeLabel}`;

    await notifyUser(staffUser.id, title, body);
    if (await shouldEmail(staffUser.id, "emailEnabled")) {
      await sendEmail(staffUser.email, title, `<p>${body}</p>`);
    }
  }

  return jobs.length;
}

/** Daily: OWNER gets a summary of customers who owe money and haven't paid in a while. */
export async function sendOverduePaymentDigest(): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - OVERDUE_PAYMENT_DAYS);

  const customers = await prisma.customer.findMany({
    include: {
      jobs: { select: { price: true } },
      payments: { select: { amount: true, createdAt: true }, orderBy: { createdAt: "desc" } },
    },
  });

  const overdue = customers
    .map((customer) => {
      const totalPriced = customer.jobs.reduce((sum, job) => sum + Number(job.price ?? 0), 0);
      const totalPaid = customer.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
      const outstandingBalance = totalPriced - totalPaid;
      const lastPaymentAt = customer.payments[0]?.createdAt ?? null;
      const isOverdue = lastPaymentAt ? lastPaymentAt < cutoff : true;
      return { customer, outstandingBalance, isOverdue };
    })
    .filter((row) => row.outstandingBalance > 0 && row.isOverdue);

  if (overdue.length === 0) return 0;

  const listHtml = overdue
    .map((row) => `<li>${row.customer.fullName} — ${row.outstandingBalance.toFixed(2)} TL</li>`)
    .join("");

  await notifyOwnersHtml(
    "Gecikmiş ödeme özeti",
    `${overdue.length} müşterinin 30 günden uzun süredir bekleyen bakiyesi var.`,
    `<p>${overdue.length} müşterinin 30 günden uzun süredir bekleyen bakiyesi var:</p><ul>${listHtml}</ul>`
  );

  return overdue.length;
}

/** Daily: OWNER gets nudged about advance/quote requests sitting unactioned for 48h+. */
export async function sendPendingApprovalReminders(): Promise<number> {
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - PENDING_APPROVAL_HOURS);

  const [pendingAdvances, pendingQuotes] = await Promise.all([
    prisma.advanceRequest.count({ where: { status: AdvanceStatus.PENDING, createdAt: { lte: cutoff } } }),
    prisma.quoteRequest.count({ where: { status: "NEW", createdAt: { lte: cutoff } } }),
  ]);

  const total = pendingAdvances + pendingQuotes;
  if (total === 0) return 0;

  await notifyOwners(
    "Bekleyen onaylar var",
    `${pendingAdvances} avans talebi ve ${pendingQuotes} teklif talebi 48 saatten uzun süredir yanıt bekliyor.`
  );

  return total;
}

/** Daily: OWNER + MANAGER get notified about contracts expiring within 30 days. */
export async function sendContractExpiryReminders(): Promise<number> {
  const now = new Date();
  const in30Days = new Date();
  in30Days.setDate(now.getDate() + CONTRACT_EXPIRY_DAYS);

  const contracts = await prisma.contract.findMany({
    where: { endDate: { gte: now, lte: in30Days } },
    include: { customer: { select: { fullName: true } } },
  });

  if (contracts.length === 0) return 0;

  const managers = await prisma.user.findMany({
    where: { role: { in: [Role.OWNER, Role.MANAGER] } },
    select: { id: true, email: true },
  });

  const title = "Yaklaşan sözleşme bitişleri";
  const body = `${contracts.length} sözleşme önümüzdeki 30 gün içinde sona eriyor.`;

  await notifyUsers(managers.map((m) => m.id), title, body);
  for (const manager of managers) {
    if (await shouldEmail(manager.id, "emailEnabled")) {
      await sendEmail(manager.email, title, `<p>${body}</p>`);
    }
  }

  return contracts.length;
}

/** Daily: OWNER gets notified about staff certifications expiring within 30 days. */
export async function sendCertificationExpiryReminders(): Promise<number> {
  const now = new Date();
  const in30Days = new Date();
  in30Days.setDate(now.getDate() + CONTRACT_EXPIRY_DAYS);

  const certifications = await prisma.staffCertification.findMany({
    where: { expiryDate: { gte: now, lte: in30Days } },
  });

  if (certifications.length === 0) return 0;

  await notifyOwners(
    "Yaklaşan sertifika bitişleri",
    `${certifications.length} personel sertifikası önümüzdeki 30 gün içinde sona eriyor.`
  );

  return certifications.length;
}

async function notifyOwnersHtml(title: string, plainBody: string, html: string): Promise<void> {
  const owners = await getOwners();
  await notifyUsers(owners.map((o) => o.id), title, plainBody);

  for (const owner of owners) {
    if (await shouldEmail(owner.id, "emailEnabled")) {
      await sendEmail(owner.email, title, html);
    }
  }
}

/** 07:00 daily digest email for OWNER(s) with dailyDigestEnabled. */
export async function sendDailyDigest(): Promise<number> {
  const owners = await getOwners();
  const eligibleOwners: UserForEmail[] = [];
  for (const owner of owners) {
    if (await shouldEmail(owner.id, "dailyDigestEnabled")) {
      eligibleOwners.push(owner);
    }
  }
  if (eligibleOwners.length === 0) return 0;

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - PENDING_APPROVAL_HOURS);

  const [todaysJobsCount, newQuotesCount, pendingAdvances, pendingQuotes, products] = await Promise.all([
    prisma.job.count({ where: { scheduledAt: { gte: startOfDay, lte: endOfDay } } }),
    prisma.quoteRequest.count({ where: { status: "NEW" } }),
    prisma.advanceRequest.count({ where: { status: AdvanceStatus.PENDING } }),
    prisma.quoteRequest.count({ where: { status: "NEW", createdAt: { lte: cutoff } } }),
    prisma.product.findMany(),
  ]);

  const criticalProducts = products.filter((p) => Number(p.currentStock) <= Number(p.criticalThreshold));

  const dateLabel = now.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px;">
      <h2 style="color: #1F5C3D;">Nilüfer İlaçlama - Bugünün Özeti</h2>
      <p style="color: #555;">${dateLabel}</p>
      <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;">Bugünkü iş sayısı</td><td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">${todaysJobsCount}</td></tr>
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;">Yeni teklif talebi</td><td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">${newQuotesCount}</td></tr>
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;">Bekleyen avans talebi</td><td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">${pendingAdvances}</td></tr>
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;">48 saatten eski bekleyen teklif</td><td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">${pendingQuotes}</td></tr>
      </table>
      ${
        criticalProducts.length > 0
          ? `<h3 style="color: #B3261E; margin-top: 20px;">Kritik stok uyarıları</h3>
             <ul>${criticalProducts.map((p) => `<li>${p.name} — ${Number(p.currentStock)} ${p.unit}</li>`).join("")}</ul>`
          : `<p style="margin-top: 20px; color: #1F5C3D;">Kritik stok uyarısı yok.</p>`
      }
    </div>
  `;

  for (const owner of eligibleOwners) {
    await sendEmail(owner.email, `Bugünün Özeti - ${dateLabel}`, html);
  }

  return eligibleOwners.length;
}

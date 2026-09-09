import type { Request, Response } from "express";
import { JobStatus, StaffStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";

function dayBounds(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export async function getDashboardSummary(_req: Request, res: Response) {
  const now = new Date();
  const { start: startOfDay, end: endOfDay } = dayBounds(now);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [
    todaysJobsCount,
    paymentsAgg,
    newQuoteRequestsCount,
    activeStaffCount,
    completedJobsThisMonth,
    // Müdür paneli ek verileri:
    todaysJobsGrouped,
    todaysJobsForServices,
    staffStatusGrouped,
    completedJobsLastMonth,
    cancelledJobsThisMonth,
    pendingReportApprovals,
  ] = await Promise.all([
    prisma.job.count({ where: { scheduledAt: { gte: startOfDay, lte: endOfDay } } }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { createdAt: { gte: startOfMonth, lt: startOfNextMonth } },
    }),
    prisma.quoteRequest.count({ where: { status: "NEW" } }),
    prisma.staff.count(),
    prisma.job.count({
      where: { status: JobStatus.COMPLETED, completedAt: { gte: startOfMonth, lt: startOfNextMonth } },
    }),
    // Bugünkü işlerin durum kırılımı — Stitch "Bugünün Durum Dağılımı" donut'u.
    prisma.job.groupBy({
      by: ["status"],
      _count: { _all: true },
      where: { scheduledAt: { gte: startOfDay, lte: endOfDay } },
    }),
    // Bugünkü işlerin hizmet türü kırılımı — Stitch "Hizmet Türü Kırılımı".
    prisma.job.groupBy({
      by: ["serviceType"],
      _count: { _all: true },
      where: { scheduledAt: { gte: startOfDay, lte: endOfDay } },
    }),
    // Personel durum kırılımı — Stitch "Aktif Personel 7/8 Sahada".
    prisma.staff.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.job.count({
      where: { status: JobStatus.COMPLETED, completedAt: { gte: startOfLastMonth, lt: startOfMonth } },
    }),
    prisma.job.count({
      where: { status: JobStatus.CANCELLED, cancelledAt: { gte: startOfMonth, lt: startOfNextMonth } },
    }),
    // Onay bekleyen saha raporu sayısı — Stitch "Saha Raporu Onay Bekliyor".
    prisma.jobReport.count({ where: { approvedAt: null } }),
  ]);

  const jobsByStatus = Object.fromEntries(
    Object.values(JobStatus).map((status) => [
      status,
      todaysJobsGrouped.find((g) => g.status === status)?._count._all ?? 0,
    ])
  ) as Record<JobStatus, number>;

  const staffByStatus = Object.fromEntries(
    Object.values(StaffStatus).map((status) => [
      status,
      staffStatusGrouped.find((g) => g.status === status)?._count._all ?? 0,
    ])
  ) as Record<StaffStatus, number>;

  const todaysServiceBreakdown = todaysJobsForServices
    .map((g) => ({ serviceType: g.serviceType, count: g._count._all }))
    .sort((a, b) => b.count - a.count);

  return res.json({
    todaysJobsCount,
    thisMonthPaymentsTotal: Number(paymentsAgg._sum.amount ?? 0),
    newQuoteRequestsCount,
    activeStaffCount,
    completedJobsThisMonth,
    // --- Müdür paneli alanları (mevcut alanlar korunarak eklendi) ---
    todaysJobsByStatus: jobsByStatus,
    todaysServiceBreakdown,
    staffByStatus,
    staffOnJobCount: staffByStatus[StaffStatus.ON_JOB] ?? 0,
    completedJobsLastMonth,
    cancelledJobsThisMonth,
    /**
     * Tamamlama oranı = bu ay tamamlanan / (tamamlanan + iptal edilen).
     * Formül burada AÇIKÇA tanımlıdır; Stitch'teki "%94 Başarı" rozetinin
     * hangi formülle hesaplandığı belirtilmediği için varsayılan olarak bu
     * (tamamlanan/toplam sonuçlanan) tanım kullanılmıştır — bkz.
     * docs/STITCH_FEATURE_MATRIX.md açık sorular.
     */
    completionRateThisMonth:
      completedJobsThisMonth + cancelledJobsThisMonth > 0
        ? (completedJobsThisMonth / (completedJobsThisMonth + cancelledJobsThisMonth)) * 100
        : null,
    pendingReportApprovals,
  });
}

interface ActivityEvent {
  timestamp: Date;
  text: string;
}

export async function getActivityFeed(_req: Request, res: Response) {
  const [completedJobs, payments, newCustomers, newMessages] = await Promise.all([
    prisma.job.findMany({
      where: { status: JobStatus.COMPLETED, completedAt: { not: null } },
      orderBy: { completedAt: "desc" },
      take: 20,
      include: {
        customer: { select: { fullName: true } },
        assignedStaff: { include: { user: { select: { fullName: true } } } },
      },
    }),
    prisma.payment.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { customer: { select: { fullName: true } } },
    }),
    prisma.customer.findMany({ orderBy: { createdAt: "desc" }, take: 20, select: { fullName: true, createdAt: true } }),
    prisma.message.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { sender: { select: { fullName: true } } },
    }),
  ]);

  const events: ActivityEvent[] = [
    ...completedJobs.map((job) => ({
      timestamp: job.completedAt as Date,
      text: `${job.assignedStaff?.user.fullName ?? "Personel"} "${job.customer.fullName}" işini tamamladı`,
    })),
    ...payments.map((payment) => ({
      timestamp: payment.createdAt,
      text: `${payment.customer.fullName} müşterisinden ${Number(payment.amount)}₺ tahsilat alındı`,
    })),
    ...newCustomers.map((customer) => ({
      timestamp: customer.createdAt,
      text: `Yeni müşteri eklendi: ${customer.fullName}`,
    })),
    ...newMessages.map((message) => ({
      timestamp: message.createdAt,
      text: `${message.sender.fullName} yeni bir mesaj gönderdi`,
    })),
  ];

  events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return res.json({ data: events.slice(0, 20) });
}

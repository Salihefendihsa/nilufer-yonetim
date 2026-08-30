import type { Request, Response } from "express";
import { JobStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";

export async function getDashboardSummary(_req: Request, res: Response) {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [todaysJobsCount, paymentsAgg, newQuoteRequestsCount, activeStaffCount, completedJobsThisMonth] = await Promise.all([
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
  ]);

  return res.json({
    todaysJobsCount,
    thisMonthPaymentsTotal: Number(paymentsAgg._sum.amount ?? 0),
    newQuoteRequestsCount,
    activeStaffCount,
    completedJobsThisMonth,
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

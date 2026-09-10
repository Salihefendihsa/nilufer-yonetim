import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";

const MONTH_LABELS = [
  "Oca", "Şub", "Mar", "Nis", "May", "Haz",
  "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara",
];

function monthsParam(req: Request, fallback: number): number {
  const raw = Number(req.query.months);
  return Number.isFinite(raw) && raw > 0 ? Math.min(24, raw) : fallback;
}

export async function getRevenueTrend(req: Request, res: Response) {
  const now = new Date();
  const monthCount = monthsParam(req, 6);
  const months: { year: number; month: number }[] = [];
  for (let i = monthCount - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() });
  }

  const rangeStart = new Date(months[0].year, months[0].month, 1);
  const payments = await prisma.payment.findMany({
    where: { createdAt: { gte: rangeStart } },
    select: { amount: true, createdAt: true },
  });

  const data = months.map(({ year, month }) => {
    const total = payments
      .filter((p) => p.createdAt.getFullYear() === year && p.createdAt.getMonth() === month)
      .reduce((sum, p) => sum + Number(p.amount), 0);
    return { label: `${MONTH_LABELS[month]} ${year}`, total };
  });

  return res.json({ data });
}

export async function getServiceBreakdown(req: Request, res: Response) {
  const monthCount = monthsParam(req, 3);
  const rangeStart = new Date();
  rangeStart.setMonth(rangeStart.getMonth() - monthCount);

  const jobs = await prisma.job.findMany({
    where: { createdAt: { gte: rangeStart } },
    select: { serviceType: true },
  });

  const counts = new Map<string, number>();
  for (const job of jobs) {
    counts.set(job.serviceType, (counts.get(job.serviceType) ?? 0) + 1);
  }

  const total = jobs.length;
  const data = Array.from(counts.entries())
    .map(([serviceType, count]) => ({
      serviceType,
      count,
      percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return res.json({ data, total });
}

export async function getTopDistricts(_req: Request, res: Response) {
  // customer ilişkisini her iş satırı için tekrar tekrar çekmek yerine
  // müşteri bazında iş sayısını DB'de gruplayıp yalnızca ilgili
  // müşterilerin district'ini tek seferde çözüyoruz.
  const jobCountsByCustomer = await prisma.job.groupBy({
    by: ["customerId"],
    _count: { _all: true },
  });

  const customers = await prisma.customer.findMany({
    where: { id: { in: jobCountsByCustomer.map((j) => j.customerId) } },
    select: { id: true, district: true },
  });
  const districtByCustomerId = new Map(customers.map((c) => [c.id, c.district]));

  const counts = new Map<string, number>();
  for (const { customerId, _count } of jobCountsByCustomer) {
    const district = districtByCustomerId.get(customerId)?.trim();
    if (!district) continue;
    counts.set(district, (counts.get(district) ?? 0) + _count._all);
  }

  const data = Array.from(counts.entries())
    .map(([district, count]) => ({ district, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return res.json({ data });
}

export async function getCustomerRetention(_req: Request, res: Response) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const jobsThisMonth = await prisma.job.findMany({
    where: { createdAt: { gte: monthStart } },
    select: { customerId: true },
  });

  const customerIds = Array.from(new Set(jobsThisMonth.map((j) => j.customerId)));

  const earlierJobs = await prisma.job.findMany({
    where: { customerId: { in: customerIds }, createdAt: { lt: monthStart } },
    select: { customerId: true },
    distinct: ["customerId"],
  });
  const returningCustomerIds = new Set(earlierJobs.map((j) => j.customerId));

  const returningCustomers = returningCustomerIds.size;
  const newCustomers = customerIds.length - returningCustomers;

  return res.json({ newCustomers, returningCustomers });
}

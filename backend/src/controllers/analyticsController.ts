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

/**
 * Aşağıdaki `compute*` fonksiyonları saf veri hesaplama katmanı — hem bu
 * dosyadaki route handler'lar hem de exportController.ts'teki PDF rapor
 * üretimi AYNI hesaplamayı kullanır (tek doğruluk kaynağı, kopya mantık yok).
 */

/**
 * @param anchor Bölüm AA (6. tur): pencerenin bittiği ay (varsayılan: bugün).
 *   Yıldan yıla karşılaştırma aynı fonksiyonu `anchor = bugün - 12 ay` ile
 *   çağırır — hesap tek yerde kalır. Ödemeler [pencere başı, pencere sonu]
 *   aralığıyla çekilir; iki yılın verisi birbirine karışmaz.
 */
export async function computeRevenueTrend(monthCount: number, anchor: Date = new Date()) {
  const months: { year: number; month: number }[] = [];
  for (let i = monthCount - 1; i >= 0; i--) {
    const d = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() });
  }

  const rangeStart = new Date(months[0].year, months[0].month, 1);
  const last = months[months.length - 1];
  const rangeEnd = new Date(last.year, last.month + 1, 1); // sonraki ayın ilk günü (hariç)
  const payments = await prisma.payment.findMany({
    where: { createdAt: { gte: rangeStart, lt: rangeEnd } },
    select: { amount: true, createdAt: true },
  });

  return months.map(({ year, month }) => {
    const total = payments
      .filter((p) => p.createdAt.getFullYear() === year && p.createdAt.getMonth() === month)
      .reduce((sum, p) => sum + Number(p.amount), 0);
    return { label: `${MONTH_LABELS[month]} ${year}`, month, year, total };
  });
}

/**
 * Bölüm AA (6. tur): Yıldan yıla karşılaştırma — aynı ay penceresi bu yıl ve
 * 12 ay öncesi için `computeRevenueTrend` ile hesaplanır, indeks bazında
 * eşlenir. Geçen yıl ödeme yoksa `lastYear: 0` (gerçek toplam), uydurma yok.
 */
export async function computeYearOverYear(monthCount: number, anchor: Date = new Date()) {
  const lastYearAnchor = new Date(anchor.getFullYear() - 1, anchor.getMonth(), 1);
  const [thisYear, lastYear] = await Promise.all([
    computeRevenueTrend(monthCount, anchor),
    computeRevenueTrend(monthCount, lastYearAnchor),
  ]);
  return thisYear.map((row, i) => ({
    month: MONTH_LABELS[row.month],
    thisYearLabel: row.label,
    lastYearLabel: lastYear[i].label,
    thisYear: row.total,
    lastYear: lastYear[i].total,
    /** Geçen yıl 0 ise oran anlamsız → null. */
    changePercent: lastYear[i].total > 0 ? Math.round(((row.total - lastYear[i].total) / lastYear[i].total) * 1000) / 10 : null,
  }));
}

export async function getYearOverYear(req: Request, res: Response) {
  const data = await computeYearOverYear(monthsParam(req, 6));
  return res.json({ data });
}

export async function getRevenueTrend(req: Request, res: Response) {
  const data = await computeRevenueTrend(monthsParam(req, 6));
  return res.json({ data });
}

export async function computeServiceBreakdown(monthCount: number) {
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

  return { data, total };
}

export async function getServiceBreakdown(req: Request, res: Response) {
  const result = await computeServiceBreakdown(monthsParam(req, 3));
  return res.json(result);
}

export async function computeTopDistricts() {
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

  return Array.from(counts.entries())
    .map(([district, count]) => ({ district, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

export async function getTopDistricts(_req: Request, res: Response) {
  const data = await computeTopDistricts();
  return res.json({ data });
}

export async function computeCustomerRetention() {
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

  return { newCustomers, returningCustomers };
}

export async function getCustomerRetention(_req: Request, res: Response) {
  const result = await computeCustomerRetention();
  return res.json(result);
}

/**
 * Bölüm S (5. tur): Yapılandırılmış müşteri geri bildirimi özeti — 3 kriterin
 * ortalaması (1–5), öneri oranı ve toplam yanıt sayısı. Geri bildirim yoksa
 * ortalamalar null döner (uydurma sayı yok).
 */
export async function computeFeedbackSummary() {
  const agg = await prisma.job.aggregate({
    where: { feedbackSubmittedAt: { not: null } },
    _avg: { serviceQualityScore: true, punctualityScore: true, staffProfessionalismScore: true },
    _count: { _all: true },
  });
  const recommendCounts = await prisma.job.groupBy({
    by: ["wouldRecommend"],
    where: { feedbackSubmittedAt: { not: null }, wouldRecommend: { not: null } },
    _count: { _all: true },
  });
  const yes = recommendCounts.find((r) => r.wouldRecommend === true)?._count._all ?? 0;
  const no = recommendCounts.find((r) => r.wouldRecommend === false)?._count._all ?? 0;
  const answered = yes + no;

  return {
    responseCount: agg._count._all,
    serviceQualityAvg: agg._avg.serviceQualityScore,
    punctualityAvg: agg._avg.punctualityScore,
    staffProfessionalismAvg: agg._avg.staffProfessionalismScore,
    recommendRate: answered > 0 ? (yes / answered) * 100 : null,
    recommendAnswered: answered,
  };
}

export async function getFeedbackSummary(_req: Request, res: Response) {
  return res.json(await computeFeedbackSummary());
}

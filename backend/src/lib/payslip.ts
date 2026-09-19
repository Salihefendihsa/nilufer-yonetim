import { AdvanceStatus, StaffBonusStatus } from "@prisma/client";
import { prisma } from "./prisma";

/**
 * Bölüm AN (9. tur): personelin aylık maaş+prim ÖZETİ — YALNIZCA GÖRÜNTÜLEME,
 * hiçbir ödeme/muhasebe kaydı tetiklemez. Mevcut verilerden hesaplanır:
 *  - salaryBase: Staff kaydındaki güncel taban maaş (tarihçe tutulmaz)
 *  - bonusTotal: o ay içinde `approvedAt` düşen APPROVED StaffBonus toplamı
 *  - advanceTotal: o ay içinde açılan (createdAt) ve APPROVED olan
 *    AdvanceRequest toplamı — AdvanceRequest'te karar zamanı alanı yok,
 *    bu yüzden ay eşlemesi talep tarihine göre yapılır (bkz. docs)
 *  - net = salaryBase + bonusTotal − advanceTotal
 */
export interface Payslip {
  month: string; // YYYY-MM
  salaryBase: number;
  bonusTotal: number;
  bonusCount: number;
  advanceTotal: number;
  advanceCount: number;
  net: number;
  bonuses: { id: string; amount: number; approvedAt: Date | null; periodName: string }[];
  advances: { id: string; amount: number; reason: string; createdAt: Date }[];
}

export function parseMonth(raw: unknown): { year: number; month: number } | null {
  if (typeof raw !== "string") return null;
  const m = /^(\d{4})-(\d{2})$/.exec(raw);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (year < 2000 || year > 2100 || month < 1 || month > 12) return null;
  return { year, month };
}

export function monthRange(year: number, month: number): { start: Date; end: Date } {
  return { start: new Date(year, month - 1, 1), end: new Date(year, month, 1) };
}

export async function computePayslip(staffId: string, year: number, month: number): Promise<Payslip | null> {
  const staff = await prisma.staff.findUnique({ where: { id: staffId }, select: { salaryBase: true } });
  if (!staff) return null;

  const { start, end } = monthRange(year, month);

  const [bonuses, advances] = await Promise.all([
    prisma.staffBonus.findMany({
      where: { staffId, status: StaffBonusStatus.APPROVED, approvedAt: { gte: start, lt: end } },
      orderBy: { approvedAt: "asc" },
      include: { evaluationPeriod: { select: { label: true } } },
    }),
    prisma.advanceRequest.findMany({
      where: { staffId, status: AdvanceStatus.APPROVED, createdAt: { gte: start, lt: end } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const salaryBase = Number(staff.salaryBase);
  const bonusTotal = round2(bonuses.reduce((s, b) => s + Number(b.amount), 0));
  const advanceTotal = round2(advances.reduce((s, a) => s + Number(a.amount), 0));

  return {
    month: `${year}-${String(month).padStart(2, "0")}`,
    salaryBase,
    bonusTotal,
    bonusCount: bonuses.length,
    advanceTotal,
    advanceCount: advances.length,
    net: round2(salaryBase + bonusTotal - advanceTotal),
    bonuses: bonuses.map((b) => ({ id: b.id, amount: Number(b.amount), approvedAt: b.approvedAt, periodName: b.evaluationPeriod.label })),
    advances: advances.map((a) => ({ id: a.id, amount: Number(a.amount), reason: a.reason, createdAt: a.createdAt })),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

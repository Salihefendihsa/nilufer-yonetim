import { LeaveRequestStatus } from "@prisma/client";
import { prisma } from "./prisma";

/**
 * Bölüm AH (7. tur): Yıllık izin bakiyesi — TAKVİM YILI (1 Ocak–31 Aralık),
 * kıstelyevm bilinçli olarak yok (basit tutuldu). Kullanılan gün = o yıl
 * APPROVED LeaveRequest'lerin gün toplamı (başlangıç–bitiş dahil, yıl sınırında
 * kırpılır). Mevcut LeaveRequest verisi yeniden kullanılır, ayrı sayaç yok.
 */
const DAY = 24 * 3600 * 1000;

/** İki tarih arasındaki takvim günü sayısı (her iki uç dahil), [yearStart, yearEnd] ile kırpılmış. */
export function leaveDaysInYear(start: Date, end: Date, year: number): number {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  const s = new Date(Math.max(start.getTime(), yearStart.getTime()));
  const e = new Date(Math.min(end.getTime(), yearEnd.getTime()));
  s.setHours(0, 0, 0, 0);
  e.setHours(0, 0, 0, 0);
  if (e < s) return 0;
  return Math.round((e.getTime() - s.getTime()) / DAY) + 1;
}

export interface LeaveBalance {
  year: number;
  quotaDays: number;
  usedDays: number;
  remainingDays: number;
  approvedRequestCount: number;
}

export async function computeLeaveBalance(staffId: string, year = new Date().getFullYear()): Promise<LeaveBalance | null> {
  const staff = await prisma.staff.findUnique({ where: { id: staffId }, select: { annualLeaveQuotaDays: true } });
  if (!staff) return null;
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);
  const approved = await prisma.leaveRequest.findMany({
    where: { staffId, status: LeaveRequestStatus.APPROVED, startDate: { lte: yearEnd }, endDate: { gte: yearStart } },
    select: { startDate: true, endDate: true },
  });
  const usedDays = approved.reduce((sum, l) => sum + leaveDaysInYear(l.startDate, l.endDate, year), 0);
  return {
    year,
    quotaDays: staff.annualLeaveQuotaDays,
    usedDays,
    remainingDays: staff.annualLeaveQuotaDays - usedDays,
    approvedRequestCount: approved.length,
  };
}

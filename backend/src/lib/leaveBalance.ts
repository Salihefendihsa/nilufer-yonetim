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

/** [start, end] aralığındaki, `year` içine düşen takvim günleri (yerel gün anahtarı "YYYY-M-D"). */
function leaveDayKeysInYear(start: Date, end: Date, year: number): string[] {
  const s = new Date(Math.max(start.getTime(), new Date(year, 0, 1).getTime()));
  const e = new Date(Math.min(end.getTime(), new Date(year, 11, 31).getTime()));
  s.setHours(0, 0, 0, 0);
  e.setHours(0, 0, 0, 0);
  const keys: string[] = [];
  for (const d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) keys.push(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
  return keys;
}

/**
 * Aynı personelin [start, end] ile gün bazında çakışan ONAYLI izni (varsa).
 * Çakışan onaylı izin oluşturulamaz/onaylanamaz — eskiden aynı tarihli iki
 * onaylı izin bakiyeden iki kez düşüyordu (bkz. docs/HEALTH_AUDIT.md V-6).
 */
export async function findOverlappingApprovedLeave(staffId: string, start: Date, end: Date, excludeId?: string) {
  const dayStart = new Date(start);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(end);
  dayEnd.setHours(23, 59, 59, 999);
  return prisma.leaveRequest.findFirst({
    where: {
      staffId,
      status: LeaveRequestStatus.APPROVED,
      startDate: { lte: dayEnd },
      endDate: { gte: dayStart },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, startDate: true, endDate: true },
  });
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
  // Gün kümesi: çakışan onaylı izinler (eski veri) aynı günü iki kez düşmesin.
  const usedDays = new Set(approved.flatMap((l) => leaveDayKeysInYear(l.startDate, l.endDate, year))).size;
  return {
    year,
    quotaDays: staff.annualLeaveQuotaDays,
    usedDays,
    remainingDays: staff.annualLeaveQuotaDays - usedDays,
    approvedRequestCount: approved.length,
  };
}

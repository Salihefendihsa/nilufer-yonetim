import type { Request, Response } from "express";
import { Role, StaffStatus, type Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getTeamStaffIds } from "../lib/access";

/**
 * Bölüm Z (6. tur): Akıllı personel atama ÖNERİSİ — otomatik atama değil.
 * GET /jobs/suggest-staff?date=YYYY-MM-DD[&time=HH:mm][&serviceType=]
 *
 * Mevcut verileri yeniden kullanır (yeni hesap yok):
 *  - Staff (archivedAt null; TEAM_LEAD → getTeamStaffIds kapsamı)
 *  - StaffUnavailability (Bölüm K): o gün tüm gün veya verilen saati kapsayan
 *    aralık → `isUnavailable: true`, listenin SONUNA atılır (UI rozet gösterir)
 *  - Job.assignedStaffId + scheduledAt o gün → `todayJobCount`
 *  - Staff.status ON_LEAVE → müsait değil sayılır
 * Sıralama: müsaitler önce, sonra o güne atanmış iş sayısı ARTAN, sonra ad.
 * `serviceType` şimdilik yalnızca yanıtta yankılanır (ileride yetkinlik
 * eşlemesi için yer tutucu) — uydurma bir uygunluk puanı üretilmez.
 */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface StaffSuggestion {
  staffId: string;
  fullName: string;
  position: string;
  status: StaffStatus;
  todayJobCount: number;
  isUnavailable: boolean;
  unavailableReason: string | null;
  isRecommended: boolean;
}

export async function suggestStaff(req: Request, res: Response) {
  const user = req.user!;
  const date = typeof req.query.date === "string" ? req.query.date : "";
  const time = typeof req.query.time === "string" ? req.query.time : "";
  const serviceType = typeof req.query.serviceType === "string" ? req.query.serviceType : null;
  if (!DATE_RE.test(date)) {
    return res.status(400).json({ error: "date parametresi YYYY-MM-DD biçiminde zorunludur" });
  }
  if (time && !TIME_RE.test(time)) {
    return res.status(400).json({ error: "time parametresi HH:mm biçiminde olmalıdır" });
  }

  const where: Prisma.StaffWhereInput = { archivedAt: null };
  if (user.role === Role.TEAM_LEAD) {
    const teamIds = await getTeamStaffIds(user.sub);
    if (teamIds.length === 0) return res.json({ date, serviceType, data: [] });
    where.id = { in: teamIds };
  }

  const [y, m, d] = date.split("-").map(Number);
  const dayStart = new Date(y, m - 1, d, 0, 0, 0, 0);
  const dayEnd = new Date(y, m - 1, d, 23, 59, 59, 999);
  const dateOnly = new Date(`${date}T00:00:00.000Z`);

  const staffList = await prisma.staff.findMany({
    where,
    select: { id: true, position: true, status: true, user: { select: { fullName: true } } },
  });
  const staffIds = staffList.map((s) => s.id);
  if (staffIds.length === 0) return res.json({ date, serviceType, data: [] });

  const [jobCounts, unavailabilities] = await Promise.all([
    prisma.job.groupBy({
      by: ["assignedStaffId"],
      _count: { _all: true },
      where: { assignedStaffId: { in: staffIds }, scheduledAt: { gte: dayStart, lte: dayEnd }, status: { not: "CANCELLED" } },
    }),
    prisma.staffUnavailability.findMany({
      where: { staffId: { in: staffIds }, date: dateOnly },
      select: { staffId: true, startTime: true, endTime: true, reason: true },
    }),
  ]);

  const blocks = (staffId: string) => {
    const rows = unavailabilities.filter((u) => u.staffId === staffId);
    if (rows.length === 0) return null;
    const allDay = rows.find((u) => !u.startTime || !u.endTime);
    if (allDay) return allDay.reason ?? "Tüm gün müsait değil";
    if (!time) {
      // Saat verilmemişse gün içinde herhangi bir aralık → uyarı (ama sıralamada sona atılmaz).
      return null;
    }
    const hit = rows.find((u) => u.startTime! <= time && time < u.endTime!);
    return hit ? (hit.reason ?? `${hit.startTime}–${hit.endTime} müsait değil`) : null;
  };

  const data: StaffSuggestion[] = staffList.map((s) => {
    const partialRanges = unavailabilities.filter((u) => u.staffId === s.id && u.startTime && u.endTime);
    const blockReason = blocks(s.id);
    const onLeave = s.status === StaffStatus.ON_LEAVE;
    const isUnavailable = onLeave || blockReason !== null;
    return {
      staffId: s.id,
      fullName: s.user.fullName,
      position: s.position,
      status: s.status,
      todayJobCount: jobCounts.find((j) => j.assignedStaffId === s.id)?._count._all ?? 0,
      isUnavailable,
      unavailableReason: onLeave
        ? "İzinli"
        : blockReason ?? (partialRanges.length > 0 && !time ? `Kısmen müsait değil: ${partialRanges.map((r) => `${r.startTime}–${r.endTime}`).join(", ")}` : null),
      isRecommended: false,
    };
  });

  data.sort((a, b) => {
    if (a.isUnavailable !== b.isUnavailable) return a.isUnavailable ? 1 : -1;
    if (a.todayJobCount !== b.todayJobCount) return a.todayJobCount - b.todayJobCount;
    return a.fullName.localeCompare(b.fullName, "tr");
  });
  const first = data.find((s) => !s.isUnavailable);
  if (first) first.isRecommended = true;

  return res.json({ date, time: time || null, serviceType, data });
}

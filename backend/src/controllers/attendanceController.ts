import type { Request, Response } from "express";
import { z } from "zod";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getStaffIdForUser } from "../lib/access";
import { idParam } from "../lib/params";
import { parseMonth, monthRange } from "../lib/payslip";

/**
 * Bölüm AR (9. tur): personel puantajı (giriş/çıkış saati).
 *
 * Tasarım kararları (docs/NEW_FEATURES_TOUR_2.md Bölüm AR):
 *  - Gün başına TEK kayıt (unique staffId+date). "Gün" sunucunun yerel
 *    takvim günüdür (@db.Date, UTC gece yarısı olarak saklanır).
 *  - clock-in: bugün kayıt varsa 409 — çıkış yapılmış olsa da (öğle arası
 *    sonrası "yeniden giriş" desteklenmez; molalar için StaffStatus var).
 *    Mevcut kaydı GÜNCELLEMEZ: giriş saati ilk basışta sabitlenir.
 *  - clock-out: bugün giriş yoksa 400; zaten çıkış yapılmışsa 409.
 *  - Aylık toplam: clockIn+clockOut ikisi de dolu kayıtların saat toplamı
 *    (açık kayıtlar toplama girmez, `openCount` ile ayrıca bildirilir).
 */

const noteSchema = z.object({ note: z.string().trim().max(300).optional() });

function todayDateOnly(now = new Date()): Date {
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

function hoursBetween(a: Date, b: Date): number {
  return Math.round(((b.getTime() - a.getTime()) / 36e5) * 100) / 100;
}

export function decorateAttendance<T extends { clockInAt: Date | null; clockOutAt: Date | null }>(row: T) {
  const workedHours = row.clockInAt && row.clockOutAt ? hoursBetween(row.clockInAt, row.clockOutAt) : null;
  return { ...row, workedHours };
}

async function requireOwnStaffId(req: Request, res: Response): Promise<string | null> {
  const staffId = await getStaffIdForUser(req.user!.sub);
  if (!staffId) {
    res.status(404).json({ error: "Personel kaydı bulunamadı" });
    return null;
  }
  return staffId;
}

/** POST /staff/me/clock-in */
export async function clockIn(req: Request, res: Response) {
  const staffId = await requireOwnStaffId(req, res);
  if (!staffId) return;
  const { note } = noteSchema.parse(req.body ?? {});
  const now = new Date();
  const date = todayDateOnly(now);

  try {
    // unique(staffId,date) — eşzamanlı çift tıklamada bile tek kayıt.
    const row = await prisma.attendanceRecord.create({
      data: { staffId, date, clockInAt: now, note: note || null },
    });
    return res.status(201).json(decorateAttendance(row));
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const existing = await prisma.attendanceRecord.findUnique({ where: { staffId_date: { staffId, date } } });
      return res.status(409).json({
        error: existing?.clockOutAt ? "Bugün için giriş ve çıkış zaten kaydedildi" : "Bugün zaten giriş yaptınız",
        record: existing ? decorateAttendance(existing) : null,
      });
    }
    throw err;
  }
}

/** POST /staff/me/clock-out */
export async function clockOut(req: Request, res: Response) {
  const staffId = await requireOwnStaffId(req, res);
  if (!staffId) return;
  const { note } = noteSchema.parse(req.body ?? {});
  const now = new Date();
  const date = todayDateOnly(now);

  const existing = await prisma.attendanceRecord.findUnique({ where: { staffId_date: { staffId, date } } });
  if (!existing || !existing.clockInAt) {
    return res.status(400).json({ error: "Önce giriş yapmalısınız" });
  }
  if (existing.clockOutAt) {
    return res.status(409).json({ error: "Bugün zaten çıkış yaptınız", record: decorateAttendance(existing) });
  }

  const row = await prisma.attendanceRecord.update({
    where: { id: existing.id },
    data: { clockOutAt: now, ...(note ? { note } : {}) },
  });
  return res.json(decorateAttendance(row));
}

/** GET /staff/me/attendance/today — Ana Sayfa butonunun durumu. */
export async function getMyAttendanceToday(req: Request, res: Response) {
  const staffId = await requireOwnStaffId(req, res);
  if (!staffId) return;
  const row = await prisma.attendanceRecord.findUnique({ where: { staffId_date: { staffId, date: todayDateOnly() } } });
  return res.json({ record: row ? decorateAttendance(row) : null });
}

/**
 * GET /staff/:id/attendance?month=YYYY-MM — OWNER/MANAGER herkes;
 * STAFF/TEAM_LEAD yalnızca kendi kaydı (aksi 403).
 */
export async function getStaffAttendance(req: Request, res: Response) {
  const user = req.user!;
  const staffId = idParam(req);
  if (user.role === Role.STAFF || user.role === Role.TEAM_LEAD) {
    const ownId = await getStaffIdForUser(user.sub);
    if (ownId !== staffId) {
      return res.status(403).json({ error: "Yalnızca kendi puantajınızı görebilirsiniz" });
    }
  }

  const staff = await prisma.staff.findUnique({ where: { id: staffId }, select: { id: true } });
  if (!staff) {
    return res.status(404).json({ error: "Personel bulunamadı" });
  }

  let period = parseMonth(req.query.month);
  if (req.query.month !== undefined && !period) {
    return res.status(400).json({ error: "month YYYY-AA biçiminde olmalı" });
  }
  if (!period) {
    const now = new Date();
    period = { year: now.getFullYear(), month: now.getMonth() + 1 };
  }
  const { start, end } = monthRange(period.year, period.month);
  // @db.Date UTC gece yarısı — ay sınırlarını da UTC gün olarak ver.
  const startDate = new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()));
  const endDate = new Date(Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()));

  const rows = await prisma.attendanceRecord.findMany({
    where: { staffId, date: { gte: startDate, lt: endDate } },
    orderBy: { date: "asc" },
  });
  const decorated = rows.map(decorateAttendance);
  const totalHours = Math.round(decorated.reduce((s, r) => s + (r.workedHours ?? 0), 0) * 100) / 100;

  return res.json({
    staffId,
    month: `${period.year}-${String(period.month).padStart(2, "0")}`,
    totalHours,
    completedDays: decorated.filter((r) => r.workedHours !== null).length,
    openCount: decorated.filter((r) => r.clockInAt && !r.clockOutAt).length,
    data: decorated,
  });
}

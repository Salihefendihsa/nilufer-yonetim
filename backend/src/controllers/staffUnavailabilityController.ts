import type { Request, Response } from "express";
import { z } from "zod";
import { Role, type Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getStaffIdForUser, getTeamStaffIds } from "../lib/access";
import { idParam } from "../lib/params";

/**
 * Bölüm K (3. tur): Personel müsait-olmama işaretleri.
 *
 * - POST   /staff/me/unavailability          STAFF/TEAM_LEAD kendi adına (geçmiş tarih olamaz)
 * - DELETE /staff/me/unavailability/:id      yalnızca kendi kaydı
 * - GET    /staff/me/unavailability?month=   kendi kayıtları
 * - GET    /staff/:id/unavailability?month=  OWNER/MANAGER herkes; TEAM_LEAD ekibi; STAFF kendisi
 * - GET    /staff/unavailability?date=       OWNER/MANAGER/TEAM_LEAD — o gün müsait olmayan personel
 *                                            (iş atama formundaki uyarı için tek çağrı)
 *
 * Kayıtlar atamayı ENGELLEMEZ; yönetici acil durumda yine atayabilir.
 */

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

const createSchema = z
  .object({
    /** "YYYY-MM-DD" — saat dilimi kaymasını önlemek için ISO yerine düz tarih. */
    date: z.string().regex(DATE_RE, "Tarih YYYY-MM-DD biçiminde olmalıdır"),
    startTime: z.string().regex(TIME_RE, "Saat HH:mm biçiminde olmalıdır").optional().nullable(),
    endTime: z.string().regex(TIME_RE, "Saat HH:mm biçiminde olmalıdır").optional().nullable(),
    reason: z.string().trim().max(300).optional().nullable(),
  })
  .refine((d) => (d.startTime == null) === (d.endTime == null), {
    message: "Saat aralığı için başlangıç ve bitiş birlikte verilmelidir",
    path: ["endTime"],
  })
  .refine((d) => d.startTime == null || d.endTime == null || d.startTime < d.endTime, {
    message: "Başlangıç saati bitişten önce olmalıdır",
    path: ["endTime"],
  });

/** "YYYY-MM-DD" → UTC gece yarısı Date (Postgres DATE sütunuyla birebir). */
function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function todayDateOnly(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

function monthRange(month: string): { gte: Date; lt: Date } {
  const [y, m] = month.split("-").map(Number);
  return { gte: new Date(Date.UTC(y, m - 1, 1)), lt: new Date(Date.UTC(y, m, 1)) };
}

function serialize<T extends { date: Date }>(row: T) {
  return { ...row, date: row.date.toISOString().slice(0, 10) };
}

async function requireOwnStaffId(req: Request, res: Response): Promise<string | null> {
  const staffId = await getStaffIdForUser(req.user!.sub);
  if (!staffId) {
    res.status(400).json({ error: "Bu hesaba bağlı bir personel kaydı yok" });
    return null;
  }
  return staffId;
}

export async function createMyUnavailability(req: Request, res: Response) {
  const staffId = await requireOwnStaffId(req, res);
  if (!staffId) return;

  const data = createSchema.parse(req.body);
  const date = parseDateOnly(data.date);
  if (date < todayDateOnly()) {
    return res.status(400).json({ error: "Geçmiş bir tarih için müsaitlik işaretlenemez" });
  }

  const row = await prisma.staffUnavailability.create({
    data: {
      staffId,
      date,
      startTime: data.startTime ?? null,
      endTime: data.endTime ?? null,
      reason: data.reason || null,
    },
  });
  return res.status(201).json(serialize(row));
}

export async function deleteMyUnavailability(req: Request, res: Response) {
  const staffId = await requireOwnStaffId(req, res);
  if (!staffId) return;

  // Başkasının kaydı için de 404 — varlığı sızdırılmaz.
  const result = await prisma.staffUnavailability.deleteMany({ where: { id: idParam(req), staffId } });
  if (result.count === 0) {
    return res.status(404).json({ error: "Kayıt bulunamadı" });
  }
  return res.status(204).send();
}

async function listForStaff(staffId: string, monthParam: unknown) {
  const where: Prisma.StaffUnavailabilityWhereInput = { staffId };
  if (typeof monthParam === "string" && MONTH_RE.test(monthParam)) {
    where.date = monthRange(monthParam);
  } else {
    // Ay verilmediyse bugünden itibaren (geçmiş işaretler listeyi şişirmesin).
    where.date = { gte: todayDateOnly() };
  }
  const rows = await prisma.staffUnavailability.findMany({
    where,
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });
  return rows.map(serialize);
}

export async function listMyUnavailability(req: Request, res: Response) {
  const staffId = await requireOwnStaffId(req, res);
  if (!staffId) return;
  return res.json({ data: await listForStaff(staffId, req.query.month) });
}

export async function listStaffUnavailability(req: Request, res: Response) {
  const user = req.user!;
  const targetStaffId = idParam(req);

  if (user.role === Role.TEAM_LEAD) {
    const teamIds = await getTeamStaffIds(user.sub);
    if (!teamIds.includes(targetStaffId)) {
      return res.status(403).json({ error: "Bu personel sizin ekibinizde değil" });
    }
  } else if (user.role === Role.STAFF) {
    const ownId = await getStaffIdForUser(user.sub);
    if (ownId !== targetStaffId) {
      return res.status(403).json({ error: "Yalnızca kendi müsaitlik kayıtlarınızı görebilirsiniz" });
    }
  }

  const staff = await prisma.staff.findUnique({ where: { id: targetStaffId }, select: { id: true } });
  if (!staff) {
    return res.status(404).json({ error: "Personel bulunamadı" });
  }

  return res.json({ data: await listForStaff(targetStaffId, req.query.month) });
}

/**
 * Belirli bir günde müsait olmayan personel — iş atama formu, seçilen tarih
 * için tek çağrıyla uyarı ikonlarını çizer. TEAM_LEAD yalnızca ekibini görür.
 */
export async function listUnavailableStaffOnDate(req: Request, res: Response) {
  const user = req.user!;
  const dateParam = typeof req.query.date === "string" ? req.query.date : "";
  if (!DATE_RE.test(dateParam)) {
    return res.status(400).json({ error: "date parametresi YYYY-MM-DD biçiminde zorunludur" });
  }

  const where: Prisma.StaffUnavailabilityWhereInput = { date: parseDateOnly(dateParam) };
  if (user.role === Role.TEAM_LEAD) {
    where.staffId = { in: await getTeamStaffIds(user.sub) };
  }

  const rows = await prisma.staffUnavailability.findMany({
    where,
    select: { id: true, staffId: true, startTime: true, endTime: true, reason: true },
    orderBy: [{ staffId: "asc" }, { startTime: "asc" }],
  });
  return res.json({ date: dateParam, data: rows });
}

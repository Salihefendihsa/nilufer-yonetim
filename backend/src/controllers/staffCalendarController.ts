import { randomUUID } from "crypto";
import type { Request, Response } from "express";
import { JobStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getStaffIdForUser } from "../lib/access";
import { buildIcsCalendar, type IcsEvent } from "../lib/ics";
import { recordAuditLog } from "../lib/auditLog";

/**
 * Bölüm AP (9. tur): personelin kendi iş programını telefon takvimine
 * aktarması (ICS).
 *
 * İki erişim yolu, tek üretici:
 *  - GET /staff/me/calendar.ics — requireAuth (STAFF/TEAM_LEAD), tek seferlik indirme.
 *  - GET /calendar/:token.ics — requireAuth YOK; takvim uygulamaları header
 *    gönderemediği için Staff.calendarToken kimlik doğrulama görevi görür
 *    (tahmin edilemez UUID v4, personel istediğinde yenilenir → eski link ölür).
 * Kapsam: gelecek CALENDAR_WINDOW_DAYS gün, PENDING/SCHEDULED, scheduledAt dolu.
 */
export const CALENDAR_WINDOW_DAYS = 30;

function apiPublicUrl(): string {
  return (process.env.API_PUBLIC_URL ?? "http://localhost:4000").replace(/\/$/, "");
}

export function calendarUrlsFor(token: string): { url: string; webcalUrl: string } {
  const url = `${apiPublicUrl()}/calendar/${encodeURIComponent(token)}.ics`;
  return { url, webcalUrl: url.replace(/^https?:\/\//, "webcal://") };
}

/** Personelin atanmış işlerinden ICS metni üretir (tek kaynak — iki uç da bunu kullanır). */
export async function buildStaffCalendar(staffId: string, now = new Date()): Promise<string> {
  const windowEnd = new Date(now.getTime() + CALENDAR_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const jobs = await prisma.job.findMany({
    where: {
      assignedStaffId: staffId,
      status: { in: [JobStatus.PENDING, JobStatus.SCHEDULED] },
      scheduledAt: { gte: now, lte: windowEnd },
    },
    orderBy: { scheduledAt: "asc" },
    include: { customer: { select: { fullName: true, address: true, district: true, phone: true } } },
  });

  const events: IcsEvent[] = jobs.map((job) => {
    const start = job.scheduledAt!;
    const end = job.scheduledEndAt && job.scheduledEndAt > start ? job.scheduledEndAt : new Date(start.getTime() + 60 * 60 * 1000);
    const location = [job.customer.address, job.customer.district].filter((x) => x && x.trim()).join(", ");
    const description = [`İş #NLF-${job.sequenceNo}`, `Müşteri: ${job.customer.fullName} · ${job.customer.phone}`, job.notes ?? ""]
      .filter(Boolean)
      .join("\n");
    return {
      uid: `job-${job.id}@nilufer-ilaclama`,
      start,
      end,
      summary: `${job.customer.fullName} — ${job.serviceType}`,
      location: location || null,
      description,
      lastModified: job.createdAt,
    };
  });

  return buildIcsCalendar(events, { name: "Nilüfer İlaçlama — İş Programım", now });
}

function sendIcs(res: Response, ics: string, filename = "is-programim.ics") {
  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Cache-Control", "no-store");
  return res.send(ics);
}

/** GET /staff/me/calendar.ics — oturumlu indirme. */
export async function getMyCalendarIcs(req: Request, res: Response) {
  const staffId = await getStaffIdForUser(req.user!.sub);
  if (!staffId) {
    return res.status(404).json({ error: "Personel kaydı bulunamadı" });
  }
  return sendIcs(res, await buildStaffCalendar(staffId));
}

async function ensureToken(staffId: string): Promise<string> {
  const staff = await prisma.staff.findUniqueOrThrow({ where: { id: staffId }, select: { calendarToken: true } });
  if (staff.calendarToken) return staff.calendarToken;
  const updated = await prisma.staff.update({ where: { id: staffId }, data: { calendarToken: randomUUID() } });
  return updated.calendarToken!;
}

/** GET /staff/me/calendar-token — abonelik linki (yoksa üretir). */
export async function getMyCalendarToken(req: Request, res: Response) {
  const staffId = await getStaffIdForUser(req.user!.sub);
  if (!staffId) {
    return res.status(404).json({ error: "Personel kaydı bulunamadı" });
  }
  const token = await ensureToken(staffId);
  return res.json({ token, ...calendarUrlsFor(token), windowDays: CALENDAR_WINDOW_DAYS });
}

/** POST /staff/me/calendar-token/rotate — eski link geçersiz olur. */
export async function rotateMyCalendarToken(req: Request, res: Response) {
  const staffId = await getStaffIdForUser(req.user!.sub);
  if (!staffId) {
    return res.status(404).json({ error: "Personel kaydı bulunamadı" });
  }
  const updated = await prisma.staff.update({ where: { id: staffId }, data: { calendarToken: randomUUID() } });
  await recordAuditLog({
    actorUserId: req.user!.sub,
    action: "staff.calendar_token.rotate",
    targetUserId: req.user!.sub,
    targetType: "Staff",
    targetId: staffId,
  });
  const token = updated.calendarToken!;
  return res.json({ token, ...calendarUrlsFor(token), windowDays: CALENDAR_WINDOW_DAYS });
}

/**
 * GET /calendar/:token.ics — kimlik doğrulama header'ı YOK; token kendisi
 * kimliktir. Bilinmeyen/yenilenmiş token → 404 (varlık sızdırılmaz).
 * Arşivlenmiş/işten çıkarılmış personelin token'ı da çalışmaz.
 */
export async function getCalendarByToken(req: Request, res: Response) {
  const raw = String(req.params.token ?? "");
  const token = raw.endsWith(".ics") ? raw.slice(0, -4) : raw;
  if (!/^[0-9a-f-]{36}$/i.test(token)) {
    return res.status(404).json({ error: "Takvim bulunamadı" });
  }
  const staff = await prisma.staff.findUnique({
    where: { calendarToken: token },
    select: { id: true, archivedAt: true, user: { select: { isActive: true } } },
  });
  if (!staff || staff.archivedAt || !staff.user.isActive) {
    return res.status(404).json({ error: "Takvim bulunamadı" });
  }
  return sendIcs(res, await buildStaffCalendar(staff.id));
}

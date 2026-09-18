import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { idParam } from "../lib/params";
import { recordAuditLog } from "../lib/auditLog";

/**
 * Bölüm AK (8. tur): Sistem geneli duyuru şeridi.
 * - POST /announcements (OWNER): yeni duyuru; aynı işlemde önceki aktifleri pasifleştirir (tek aktif).
 * - GET /announcements/active (tüm oturumlar): süresi dolmamış aktif duyuru veya null.
 * - DELETE /announcements/:id (OWNER): isActive=false (fiziksel silme yok — denetim izi).
 */
const createSchema = z.object({
  message: z.string().trim().min(1, "Mesaj boş olamaz").max(500),
  expiresAt: z.string().datetime().optional().nullable(),
});

export async function createAnnouncement(req: Request, res: Response) {
  const { message, expiresAt } = createSchema.parse(req.body);
  const expires = expiresAt ? new Date(expiresAt) : null;
  if (expires && expires.getTime() <= Date.now()) {
    return res.status(400).json({ error: "Bitiş tarihi gelecekte olmalı" });
  }

  const created = await prisma.$transaction(async (tx) => {
    await tx.announcement.updateMany({ where: { isActive: true }, data: { isActive: false } });
    return tx.announcement.create({
      data: { message, expiresAt: expires, createdByUserId: req.user!.sub },
      include: { createdBy: { select: { fullName: true } } },
    });
  });

  await recordAuditLog({
    actorUserId: req.user!.sub,
    action: "announcement.create",
    targetUserId: req.user!.sub,
    targetType: "Announcement",
    targetId: created.id,
    detail: message.slice(0, 120),
  });

  return res.status(201).json(created);
}

export async function getActiveAnnouncement(_req: Request, res: Response) {
  const row = await prisma.announcement.findFirst({
    where: { isActive: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    orderBy: { createdAt: "desc" },
    select: { id: true, message: true, createdAt: true, expiresAt: true },
  });
  return res.json({ data: row ?? null });
}

export async function listAnnouncements(_req: Request, res: Response) {
  const rows = await prisma.announcement.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { createdBy: { select: { fullName: true } } },
  });
  return res.json({ data: rows });
}

export async function deactivateAnnouncement(req: Request, res: Response) {
  const id = idParam(req);
  const existing = await prisma.announcement.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Duyuru bulunamadı" });

  const updated = await prisma.announcement.update({ where: { id }, data: { isActive: false } });
  await recordAuditLog({
    actorUserId: req.user!.sub,
    action: "announcement.deactivate",
    targetUserId: req.user!.sub,
    targetType: "Announcement",
    targetId: id,
  });
  return res.json(updated);
}

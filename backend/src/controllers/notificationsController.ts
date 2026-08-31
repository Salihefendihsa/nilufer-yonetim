import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { idParam } from "../lib/params";
import { getPagination, paginatedResponse } from "../lib/pagination";

export async function listNotifications(req: Request, res: Response) {
  const { skip, take, page, limit } = getPagination(req);

  const where: { userId: string; readAt?: null | { not: null } } = { userId: req.user!.sub };
  if (req.query.status === "unread") {
    where.readAt = null;
  } else if (req.query.status === "read") {
    where.readAt = { not: null };
  }

  const [data, total] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
    prisma.notification.count({ where }),
  ]);

  return res.json(paginatedResponse(data, total, page, limit));
}

export async function getUnreadCount(req: Request, res: Response) {
  const count = await prisma.notification.count({
    where: { userId: req.user!.sub, readAt: null },
  });

  return res.json({ count });
}

export async function markNotificationRead(req: Request, res: Response) {
  const notification = await prisma.notification.findUnique({ where: { id: idParam(req) } });
  if (!notification || notification.userId !== req.user!.sub) {
    return res.status(404).json({ error: "Bildirim bulunamadı" });
  }

  await prisma.notification.update({ where: { id: notification.id }, data: { readAt: new Date() } });
  return res.json({ ok: true });
}

export async function markAllNotificationsRead(req: Request, res: Response) {
  await prisma.notification.updateMany({
    where: { userId: req.user!.sub, readAt: null },
    data: { readAt: new Date() },
  });

  return res.json({ ok: true });
}

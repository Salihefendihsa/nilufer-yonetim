import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { idParam } from "../lib/params";

export async function listNotifications(req: Request, res: Response) {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user!.sub },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return res.json({ data: notifications });
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
    return res.status(404).json({ error: "Notification not found" });
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

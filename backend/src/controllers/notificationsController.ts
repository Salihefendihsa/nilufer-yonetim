import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { idParam } from "../lib/params";
import { getPagination, paginatedResponse } from "../lib/pagination";
import { NOTIFICATION_CATEGORIES, typesForCategory, type NotificationCategory } from "../lib/notificationCategories";

export async function listNotifications(req: Request, res: Response) {
  const { skip, take, page, limit } = getPagination(req);

  const where: {
    userId: string;
    readAt?: null | { not: null };
    type?: { in: string[] };
  } = { userId: req.user!.sub };
  if (req.query.status === "unread") {
    where.readAt = null;
  } else if (req.query.status === "read") {
    where.readAt = { not: null };
  }

  // Stitch Şef → Bildirimler: Tümü / İş / Ödeme / Mesaj / Uyarı sekmeleri.
  const category = typeof req.query.category === "string" ? req.query.category : undefined;
  if (category && category !== "all" && NOTIFICATION_CATEGORIES.includes(category as NotificationCategory)) {
    where.type = { in: typesForCategory(category as NotificationCategory) };
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

/**
 * Bildirim özeti — Stitch Şef → Bildirimler ekranındaki üst kartlar
 * (Toplam / Okunmamış / Bugün) ve "Kategori Dağılımı" bloğu.
 *
 * Yalnızca çağıran kullanıcının kendi bildirimlerini sayar; başka bir
 * kullanıcının bildirimine erişim yoktur.
 */
export async function getNotificationSummary(req: Request, res: Response) {
  const userId = req.user!.sub;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [total, unread, today, byType] = await Promise.all([
    prisma.notification.count({ where: { userId } }),
    prisma.notification.count({ where: { userId, readAt: null } }),
    prisma.notification.count({ where: { userId, createdAt: { gte: startOfDay } } }),
    prisma.notification.groupBy({
      by: ["type"],
      _count: { _all: true },
      where: { userId },
    }),
  ]);

  const byCategory = Object.fromEntries(
    NOTIFICATION_CATEGORIES.map((category) => {
      const types = typesForCategory(category);
      const count = byType
        .filter((g) => g.type !== null && types.includes(g.type))
        .reduce((sum, g) => sum + g._count._all, 0);
      return [category, count];
    })
  ) as Record<NotificationCategory, number>;

  // Bilinen hiçbir kategoriye girmeyenler ("other") toplamdan düşülerek bulunur;
  // böylece kategori toplamı her zaman `total` ile tutarlıdır.
  const categorised = Object.values(byCategory).reduce((a, b) => a + b, 0);

  return res.json({
    total,
    unread,
    today,
    byCategory: { ...byCategory, other: total - categorised },
  });
}

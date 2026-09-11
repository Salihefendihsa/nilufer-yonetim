import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { recordAuditLog } from "../lib/auditLog";

const DURATION_MS: Record<string, number> = {
  "1h": 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
  "1w": 7 * 24 * 60 * 60 * 1000,
};

/**
 * `expiresAt` doğrudan bir tarih olarak verilebilir, veya web/mobile'ın sunduğu
 * kısayollardan biri (`duration`) ile hesaplanabilir. isEmergency=false ise
 * ikisinden biri zorunludur ve sonuç gelecekte bir tarih olmalıdır.
 */
const requestSchema = z
  .object({
    reason: z.string().min(1, "Gerekçe zorunludur"),
    isEmergency: z.boolean().optional().default(false),
    expiresAt: z.coerce.date().optional(),
    duration: z.enum(["1h", "1d", "1w"]).optional(),
  })
  .refine(
    (data) => data.isEmergency || data.expiresAt || data.duration,
    { message: "Acil durum erişimi değilse bir süre belirtmelisiniz", path: ["expiresAt"] }
  )
  .refine(
    (data) => data.isEmergency || !data.expiresAt || data.expiresAt.getTime() > Date.now(),
    { message: "Süre gelecekte bir tarih olmalıdır", path: ["expiresAt"] }
  );

export async function requestObserverAccess(req: Request, res: Response) {
  const data = requestSchema.parse(req.body);
  const userId = req.user!.sub;

  const expiresAt = data.isEmergency
    ? data.expiresAt ?? null
    : data.expiresAt ?? new Date(Date.now() + DURATION_MS[data.duration!]);

  const grant = await prisma.observerAccessGrant.create({
    data: {
      requestedByUserId: userId,
      reason: data.reason,
      expiresAt,
      isEmergency: data.isEmergency,
    },
  });

  await recordAuditLog({
    actorUserId: userId,
    action: data.isEmergency ? "observer.emergency_access_granted" : "observer.access_granted",
    targetUserId: userId,
    targetType: "ObserverAccessGrant",
    targetId: grant.id,
    detail: data.isEmergency
      ? `Acil durum erişimi (sınırsız) — gerekçe: ${data.reason}`
      : `Gerekçe: ${data.reason} — bitiş: ${expiresAt?.toISOString()}`,
  });

  return res.status(201).json(grant);
}

export async function getCurrentObserverAccess(req: Request, res: Response) {
  const userId = req.user!.sub;
  const grant = await findActiveGrant(userId);
  return res.json({ data: grant });
}

export async function findActiveGrant(userId: string) {
  return prisma.observerAccessGrant.findFirst({
    where: {
      requestedByUserId: userId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { createdAt: "desc" },
  });
}

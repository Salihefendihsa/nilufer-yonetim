import type { Request, Response } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getStaffIdForUser } from "../lib/access";
import { recordAuditLog } from "../lib/auditLog";
import { onboardingProgress } from "../lib/onboarding";

/**
 * Bölüm U (5. tur): İşe alım kontrol listesi.
 * - GET   /staff/:id/onboarding            OWNER/MANAGER herkes; STAFF/TEAM_LEAD kendi kaydı (salt-okunur)
 * - PATCH /staff/:id/onboarding/:itemId    OWNER/MANAGER — isCompleted; completedAt/By damgalanır; audit log
 */
const onboardingInclude = {
  completedBy: { select: { id: true, fullName: true } },
} as const;

export async function getOnboarding(req: Request, res: Response) {
  const user = req.user!;
  const staffId = req.params.id as string;

  if (user.role === Role.STAFF || user.role === Role.TEAM_LEAD) {
    const ownId = await getStaffIdForUser(user.sub);
    if (ownId !== staffId) {
      return res.status(403).json({ error: "Yalnızca kendi işe alım listenizi görebilirsiniz" });
    }
  }

  const staff = await prisma.staff.findUnique({ where: { id: staffId }, select: { id: true } });
  if (!staff) {
    return res.status(404).json({ error: "Personel bulunamadı" });
  }

  const items = await prisma.onboardingChecklistItem.findMany({
    where: { staffId },
    orderBy: { sortOrder: "asc" },
    include: onboardingInclude,
  });

  return res.json({ staffId, items, progress: onboardingProgress(items) });
}

const updateSchema = z.object({ isCompleted: z.boolean() });

export async function updateOnboardingItem(req: Request, res: Response) {
  const user = req.user!;
  const staffId = req.params.id as string;
  const itemId = req.params.itemId as string;
  const { isCompleted } = updateSchema.parse(req.body);

  const item = await prisma.onboardingChecklistItem.findFirst({
    where: { id: itemId, staffId },
    include: { staff: { select: { userId: true } } },
  });
  if (!item) {
    return res.status(404).json({ error: "Kontrol maddesi bulunamadı" });
  }

  const updated = await prisma.onboardingChecklistItem.update({
    where: { id: item.id },
    data: isCompleted
      ? { isCompleted: true, completedAt: item.isCompleted ? item.completedAt : new Date(), completedByUserId: item.isCompleted ? item.completedByUserId : user.sub }
      : { isCompleted: false, completedAt: null, completedByUserId: null },
    include: onboardingInclude,
  });

  await recordAuditLog({
    actorUserId: user.sub,
    action: isCompleted ? "onboarding.item_completed" : "onboarding.item_reopened",
    targetUserId: item.staff.userId,
    targetType: "OnboardingChecklistItem",
    targetId: item.id,
    detail: item.item,
  });

  const items = await prisma.onboardingChecklistItem.findMany({ where: { staffId }, select: { isCompleted: true } });
  return res.json({ item: updated, progress: onboardingProgress(items) });
}

import type { Request, Response } from "express";
import { StaffBonusStatus, ExpenseCategory } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { idParam } from "../lib/params";
import { recordAuditLog } from "../lib/auditLog";
import { notifyUser } from "../lib/notify";

const bonusInclude = {
  staff: { include: { user: { select: { id: true, fullName: true } } } },
  evaluationPeriod: { select: { id: true, label: true } },
} as const;

export async function listStaffBonuses(req: Request, res: Response) {
  const statusParam = req.query.status;
  const status =
    typeof statusParam === "string" && Object.values(StaffBonusStatus).includes(statusParam as StaffBonusStatus)
      ? (statusParam as StaffBonusStatus)
      : undefined;

  const data = await prisma.staffBonus.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: "desc" },
    include: bonusInclude,
  });

  return res.json({ data });
}

/**
 * Onaylanınca (a) StaffBonus.status = APPROVED VE (b) otomatik bir
 * Expense(category: BONUS) kaydı oluşturulur — böylece net kâr hesabına
 * (paymentsController.ts:getPaymentsSummary) gerçekten yansır. İkisi tek
 * transaction içinde: biri başarısız olursa diğeri de geri alınır.
 */
export async function approveStaffBonus(req: Request, res: Response) {
  const bonus = await prisma.staffBonus.findUnique({ where: { id: idParam(req) }, include: bonusInclude });
  if (!bonus) {
    return res.status(404).json({ error: "Prim önerisi bulunamadı" });
  }
  if (bonus.status !== StaffBonusStatus.PENDING) {
    return res.status(409).json({ error: "Bu prim önerisi zaten sonuçlandırılmış" });
  }

  const description = `${bonus.staff.user.fullName} — ${bonus.evaluationPeriod.label} prim onayı`;

  const [updated] = await prisma.$transaction([
    prisma.staffBonus.update({
      where: { id: bonus.id },
      data: { status: StaffBonusStatus.APPROVED, approvedByUserId: req.user!.sub, approvedAt: new Date() },
      include: bonusInclude,
    }),
    prisma.expense.create({
      data: {
        category: ExpenseCategory.BONUS,
        amount: bonus.amount,
        description,
        date: new Date(),
        recordedByUserId: req.user!.sub,
      },
    }),
  ]);

  await recordAuditLog({
    actorUserId: req.user!.sub,
    action: "staff_bonus.approved",
    targetUserId: bonus.staff.user.id,
    targetType: "StaffBonus",
    targetId: bonus.id,
    detail: `${description} — ${Number(bonus.amount).toFixed(2)} ₺`,
  });

  await notifyUser(
    bonus.staff.user.id,
    "Prim onaylandı",
    `${bonus.evaluationPeriod.label} dönemi için ${Number(bonus.amount).toFixed(2)} ₺ prim onaylandı.`,
    { type: "staff_bonus_approved", relatedType: "StaffBonus", relatedId: bonus.id }
  );

  return res.json(updated);
}

export async function rejectStaffBonus(req: Request, res: Response) {
  const bonus = await prisma.staffBonus.findUnique({ where: { id: idParam(req) }, include: bonusInclude });
  if (!bonus) {
    return res.status(404).json({ error: "Prim önerisi bulunamadı" });
  }
  if (bonus.status !== StaffBonusStatus.PENDING) {
    return res.status(409).json({ error: "Bu prim önerisi zaten sonuçlandırılmış" });
  }

  const updated = await prisma.staffBonus.update({
    where: { id: bonus.id },
    data: { status: StaffBonusStatus.REJECTED, approvedByUserId: req.user!.sub, approvedAt: new Date() },
    include: bonusInclude,
  });

  await recordAuditLog({
    actorUserId: req.user!.sub,
    action: "staff_bonus.rejected",
    targetUserId: bonus.staff.user.id,
    targetType: "StaffBonus",
    targetId: bonus.id,
    detail: `${bonus.staff.user.fullName} — ${bonus.evaluationPeriod.label}`,
  });

  return res.json(updated);
}

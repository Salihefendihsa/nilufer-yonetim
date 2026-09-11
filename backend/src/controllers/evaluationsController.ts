import type { Request, Response } from "express";
import { z } from "zod";
import { Role, EvaluationStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { idParam } from "../lib/params";
import { recordAuditLog } from "../lib/auditLog";

const MANAGEMENT_ROLES: Role[] = [Role.OWNER, Role.MANAGER];

// ---------------------------------------------------------------------------
// Kriter CRUD — Hizmet Türleri/Semtler ile aynı stil (bkz. settingsController.ts).
// ---------------------------------------------------------------------------

const criterionCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1).nullable().optional(),
  sortOrder: z.number().int().optional(),
});

const criterionUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().min(1).nullable().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export async function listEvaluationCriteria(_req: Request, res: Response) {
  const data = await prisma.evaluationCriterion.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  return res.json({ data });
}

export async function createEvaluationCriterion(req: Request, res: Response) {
  const data = criterionCreateSchema.parse(req.body);
  const criterion = await prisma.evaluationCriterion.create({ data });
  return res.status(201).json(criterion);
}

export async function updateEvaluationCriterion(req: Request, res: Response) {
  const data = criterionUpdateSchema.parse(req.body);
  const existing = await prisma.evaluationCriterion.findUnique({ where: { id: idParam(req) } });
  if (!existing) {
    return res.status(404).json({ error: "Kriter bulunamadı" });
  }
  const criterion = await prisma.evaluationCriterion.update({ where: { id: idParam(req) }, data });
  return res.json(criterion);
}

export async function deleteEvaluationCriterion(req: Request, res: Response) {
  const existing = await prisma.evaluationCriterion.findUnique({ where: { id: idParam(req) } });
  if (!existing) {
    return res.status(404).json({ error: "Kriter bulunamadı" });
  }
  await prisma.evaluationCriterion.update({ where: { id: idParam(req) }, data: { isActive: false } });
  return res.status(204).send();
}

// ---------------------------------------------------------------------------
// Dönem CRUD
// ---------------------------------------------------------------------------

// Bölüm C (2. tur): ikisi de opsiyonel — yalnızca ikisi de doluysa dönem
// kilitlenirken otomatik prim önerisi üretimi devreye girer (bkz.
// updateEvaluationPeriod).
const bonusFields = {
  bonusThreshold: z.number().int().min(1).max(20).nullable().optional(),
  bonusAmount: z.number().positive().nullable().optional(),
};

const periodCreateSchema = z.object({
  label: z.string().min(1),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  ...bonusFields,
});

const periodUpdateSchema = z.object({
  label: z.string().min(1).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  isLocked: z.boolean().optional(),
  ...bonusFields,
});

export async function listEvaluationPeriods(_req: Request, res: Response) {
  const data = await prisma.evaluationPeriod.findMany({ orderBy: { startDate: "desc" } });
  return res.json({ data });
}

export async function createEvaluationPeriod(req: Request, res: Response) {
  const data = periodCreateSchema.parse(req.body);
  const period = await prisma.evaluationPeriod.create({ data });
  return res.status(201).json(period);
}

/**
 * isLocked=true'ya çekilince o döneme ait TÜM Evaluation kayıtları da
 * otomatik LOCKED'a geçer (transaction içinde, her biri lockedAt damgalı) —
 * dönem kilitliyken tek tek kaydın kilitsiz kalması tutarsızlık yaratır.
 */
export async function updateEvaluationPeriod(req: Request, res: Response) {
  const data = periodUpdateSchema.parse(req.body);
  const existing = await prisma.evaluationPeriod.findUnique({ where: { id: idParam(req) } });
  if (!existing) {
    return res.status(404).json({ error: "Dönem bulunamadı" });
  }

  const period = await prisma.$transaction(async (tx) => {
    const updated = await tx.evaluationPeriod.update({ where: { id: idParam(req) }, data });
    if (data.isLocked === true && !existing.isLocked) {
      await tx.evaluation.updateMany({
        where: { periodId: idParam(req), status: { not: EvaluationStatus.LOCKED } },
        data: { status: EvaluationStatus.LOCKED, lockedAt: new Date() },
      });

      // Bölüm C (2. tur): eşik + tutar tanımlıysa, kilitlenen dönemdeki
      // averageScore >= bonusThreshold olan HER Evaluation için otomatik bir
      // PENDING prim önerisi üretilir. Para OTOMATİK ödenmez — yalnızca
      // öneri; gerçek ödeme (Expense) ancak /staff-bonuses/:id/approve ile.
      if (updated.bonusThreshold != null && updated.bonusAmount != null) {
        const evaluations = await tx.evaluation.findMany({
          where: { periodId: idParam(req) },
          include: { scores: true },
        });
        const qualifying = evaluations.filter((e) => {
          const avg = computeAverage(e.scores);
          return avg !== null && avg >= updated.bonusThreshold!;
        });
        if (qualifying.length > 0) {
          await tx.staffBonus.createMany({
            data: qualifying.map((e) => ({
              staffId: e.targetStaffId,
              evaluationPeriodId: idParam(req),
              evaluationId: e.id,
              amount: updated.bonusAmount!,
            })),
            skipDuplicates: true,
          });
        }
      }
    }
    return updated;
  });

  return res.json(period);
}

// ---------------------------------------------------------------------------
// Değerlendirmeler
// ---------------------------------------------------------------------------

const scoreSchema = z.object({
  criterionId: z.string().uuid(),
  score: z.number().int().min(1).max(20),
});

const createEvaluationSchema = z.object({
  targetStaffId: z.string().uuid(),
  periodId: z.string().uuid(),
  scores: z.array(scoreSchema).min(1),
  comment: z.string().min(1).nullable().optional(),
  managerScore: z.number().int().min(1).max(20).nullable().optional(),
});

const updateEvaluationSchema = z.object({
  scores: z.array(scoreSchema).min(1).optional(),
  comment: z.string().min(1).nullable().optional(),
  managerScore: z.number().int().min(1).max(20).nullable().optional(),
});

const evaluationWithScores = {
  scores: { include: { criterion: true } },
  evaluator: { select: { id: true, fullName: true } },
} as const;

function computeAverage(scores: { score: number }[]): number | null {
  if (scores.length === 0) return null;
  const sum = scores.reduce((s, x) => s + x.score, 0);
  return Math.round((sum / scores.length) * 100) / 100;
}

/**
 * STAFF/TEAM_LEAD kendi değerlendirmesini görebilir ama DEĞERLENDİRENİN
 * KİMLİĞİ asla dönmez — redactSalaryForRole (staffController.ts) ile aynı
 * desen.
 */
function redactEvaluatorForRole<T extends { evaluatorUserId: string; evaluator: unknown }>(
  evaluation: T,
  role: Role
): Omit<T, "evaluatorUserId" | "evaluator"> | T {
  if (MANAGEMENT_ROLES.includes(role)) {
    return evaluation;
  }
  const { evaluatorUserId: _evaluatorUserId, evaluator: _evaluator, ...rest } = evaluation;
  return rest;
}

function serializeEvaluation(
  evaluation: {
    scores: { score: number; criterion: unknown }[];
    [key: string]: unknown;
  },
  role: Role
) {
  const { scores, ...rest } = evaluation;
  return {
    ...redactEvaluatorForRole(rest as { evaluatorUserId: string; evaluator: unknown } & typeof rest, role),
    scores,
    averageScore: computeAverage(scores),
  };
}

export async function createEvaluation(req: Request, res: Response) {
  const data = createEvaluationSchema.parse(req.body);
  const evaluatorUserId = req.user!.sub;

  const evaluation = await prisma.$transaction(async (tx) => {
    const created = await tx.evaluation.create({
      data: {
        evaluatorUserId,
        targetStaffId: data.targetStaffId,
        periodId: data.periodId,
        comment: data.comment ?? null,
        managerScore: data.managerScore ?? null,
      },
    });
    await tx.evaluationScore.createMany({
      data: data.scores.map((s) => ({ evaluationId: created.id, criterionId: s.criterionId, score: s.score })),
    });
    return tx.evaluation.findUniqueOrThrow({ where: { id: created.id }, include: evaluationWithScores });
  });

  await recordAuditLog({
    actorUserId: evaluatorUserId,
    action: "evaluation.created",
    targetUserId: await targetUserIdFor(evaluation.targetStaffId),
    targetType: "Evaluation",
    targetId: evaluation.id,
    detail: `Dönem: ${data.periodId}`,
  });

  return res.status(201).json(serializeEvaluation(evaluation, req.user!.role));
}

async function targetUserIdFor(staffId: string): Promise<string | undefined> {
  const staff = await prisma.staff.findUnique({ where: { id: staffId }, select: { userId: true } });
  return staff?.userId;
}

export async function updateEvaluation(req: Request, res: Response) {
  const data = updateEvaluationSchema.parse(req.body);
  const userId = req.user!.sub;

  const existing = await prisma.evaluation.findUnique({ where: { id: idParam(req) } });
  if (!existing) {
    return res.status(404).json({ error: "Değerlendirme bulunamadı" });
  }
  if (existing.evaluatorUserId !== userId) {
    return res.status(403).json({ error: "Bu işlem için yetkiniz yok" });
  }
  if (existing.status !== EvaluationStatus.DRAFT) {
    return res.status(409).json({ error: "Yalnızca taslak değerlendirmeler düzenlenebilir" });
  }

  const evaluation = await prisma.$transaction(async (tx) => {
    await tx.evaluation.update({
      where: { id: existing.id },
      data: { comment: data.comment, managerScore: data.managerScore },
    });
    if (data.scores) {
      await tx.evaluationScore.deleteMany({ where: { evaluationId: existing.id } });
      await tx.evaluationScore.createMany({
        data: data.scores.map((s) => ({ evaluationId: existing.id, criterionId: s.criterionId, score: s.score })),
      });
    }
    return tx.evaluation.findUniqueOrThrow({ where: { id: existing.id }, include: evaluationWithScores });
  });

  await recordAuditLog({
    actorUserId: userId,
    action: "evaluation.updated",
    targetUserId: await targetUserIdFor(existing.targetStaffId),
    targetType: "Evaluation",
    targetId: existing.id,
  });

  return res.json(serializeEvaluation(evaluation, req.user!.role));
}

export async function submitEvaluation(req: Request, res: Response) {
  const userId = req.user!.sub;
  const existing = await prisma.evaluation.findUnique({ where: { id: idParam(req) } });
  if (!existing) {
    return res.status(404).json({ error: "Değerlendirme bulunamadı" });
  }
  if (existing.evaluatorUserId !== userId) {
    return res.status(403).json({ error: "Bu işlem için yetkiniz yok" });
  }
  if (existing.status !== EvaluationStatus.DRAFT) {
    return res.status(409).json({ error: "Değerlendirme zaten gönderilmiş" });
  }

  const evaluation = await prisma.evaluation.update({
    where: { id: existing.id },
    data: { status: EvaluationStatus.SUBMITTED, submittedAt: new Date() },
    include: evaluationWithScores,
  });

  await recordAuditLog({
    actorUserId: userId,
    action: "evaluation.submitted",
    targetUserId: await targetUserIdFor(existing.targetStaffId),
    targetType: "Evaluation",
    targetId: existing.id,
  });

  return res.json(serializeEvaluation(evaluation, req.user!.role));
}

/** STAFF/TEAM_LEAD yalnızca kendi (targetStaffId = kendi Staff kaydı) değerlendirmelerini görebilir. */
async function resolveViewScope(req: Request): Promise<{ targetStaffId?: string } | null> {
  const user = req.user!;
  if (MANAGEMENT_ROLES.includes(user.role)) return {};

  const staff = await prisma.staff.findUnique({ where: { userId: user.sub }, select: { id: true } });
  if (!staff) return null;
  return { targetStaffId: staff.id };
}

export async function listEvaluations(req: Request, res: Response) {
  const scope = await resolveViewScope(req);
  if (scope === null) {
    return res.json({ data: [] });
  }

  const periodId = typeof req.query.periodId === "string" ? req.query.periodId : undefined;
  const evaluatorUserId = typeof req.query.evaluatorUserId === "string" ? req.query.evaluatorUserId : undefined;
  const queryTargetStaffId = typeof req.query.targetStaffId === "string" ? req.query.targetStaffId : undefined;

  if (scope.targetStaffId && queryTargetStaffId && queryTargetStaffId !== scope.targetStaffId) {
    return res.status(403).json({ error: "Bu işlem için yetkiniz yok" });
  }

  const evaluations = await prisma.evaluation.findMany({
    where: {
      periodId,
      evaluatorUserId,
      targetStaffId: scope.targetStaffId ?? queryTargetStaffId,
    },
    include: evaluationWithScores,
    orderBy: { createdAt: "desc" },
  });

  return res.json({ data: evaluations.map((e) => serializeEvaluation(e, req.user!.role)) });
}

export async function getEvaluation(req: Request, res: Response) {
  const scope = await resolveViewScope(req);
  const evaluation = await prisma.evaluation.findUnique({
    where: { id: idParam(req) },
    include: evaluationWithScores,
  });
  if (!evaluation) {
    return res.status(404).json({ error: "Değerlendirme bulunamadı" });
  }
  if (scope !== null && scope.targetStaffId && evaluation.targetStaffId !== scope.targetStaffId) {
    return res.status(403).json({ error: "Bu işlem için yetkiniz yok" });
  }
  if (scope === null) {
    return res.status(403).json({ error: "Bu işlem için yetkiniz yok" });
  }

  return res.json(serializeEvaluation(evaluation, req.user!.role));
}

import type { Request, Response } from "express";
import { z } from "zod";
import { Role, RecurrenceType, type Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getPagination, paginatedResponse } from "../lib/pagination";
import { getCustomerIdForUser } from "../lib/access";
import { idParam } from "../lib/params";
import { addRecurrencePeriod, monthlyRecurringAmount } from "../lib/recurrence";
import { recordAuditLog } from "../lib/auditLog";

const createSchema = z.object({
  customerId: z.string().uuid(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  durationMonths: z.number().int().positive(),
  status: z.string().min(1),
  serviceType: z.string().optional(),
  amount: z.number().nonnegative().optional(),
  pdfUrl: z.string().optional(),
  recurrenceType: z.enum(RecurrenceType).nullable().optional(),
});

const updateSchema = createSchema.partial();

function computeNextGenerationDate(
  recurrenceType: RecurrenceType | null | undefined,
  effectiveStartDate: Date
): Date | null | undefined {
  if (recurrenceType === undefined) return undefined;
  if (recurrenceType === null) return null;
  return addRecurrencePeriod(effectiveStartDate, recurrenceType);
}

export async function listContracts(req: Request, res: Response) {
  const { skip, take, page, limit } = getPagination(req);
  const user = req.user!;

  const where: Prisma.ContractWhereInput = {};

  if (user.role === Role.CUSTOMER) {
    const customerId = await getCustomerIdForUser(user.sub);
    if (!customerId) {
      return res.json(paginatedResponse([], 0, page, limit));
    }
    where.customerId = customerId;
  } else if (typeof req.query.customerId === "string") {
    where.customerId = req.query.customerId;
  }

  if (typeof req.query.status === "string") {
    where.status = req.query.status;
  }

  const [data, total] = await Promise.all([
    prisma.contract.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: { customer: { select: { id: true, fullName: true, district: true } } },
    }),
    prisma.contract.count({ where }),
  ]);

  return res.json(paginatedResponse(data, total, page, limit));
}

/**
 * Sözleşme portföyü özeti — Stitch Müdür → Sözleşmeler üst kartları.
 * `monthlyRecurringRevenue`, periyodu aylığa normalize edilmiş (yıllık/12,
 * 3 aylık/3 …) tekrarlayan gelirdir; periyodu veya tutarı olmayan sözleşme
 * 0 sayılır (bkz. lib/recurrence.ts:monthlyRecurringAmount).
 */
export async function getContractsSummary(_req: Request, res: Response) {
  const now = new Date();
  const in30Days = new Date(now);
  in30Days.setDate(now.getDate() + 30);

  const [statusGrouped, activeContracts, expiringCount] = await Promise.all([
    prisma.contract.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.contract.findMany({
      where: { status: "ACTIVE" },
      select: { amount: true, recurrenceType: true },
    }),
    prisma.contract.count({ where: { status: "ACTIVE", endDate: { gte: now, lte: in30Days } } }),
  ]);

  const monthlyRecurringRevenue = activeContracts.reduce(
    (sum, c) => sum + monthlyRecurringAmount(c.amount === null ? null : Number(c.amount), c.recurrenceType),
    0
  );

  return res.json({
    byStatus: Object.fromEntries(statusGrouped.map((g) => [g.status, g._count._all])),
    totalCount: statusGrouped.reduce((sum, g) => sum + g._count._all, 0),
    activeCount: activeContracts.length,
    expiringIn30DaysCount: expiringCount,
    monthlyRecurringRevenue,
    activeContractValueTotal: activeContracts.reduce((sum, c) => sum + Number(c.amount ?? 0), 0),
  });
}

/**
 * Bölüm E (2. tur): sözleşme otomasyon sağlık kontrolü. `nextGenerationDate`
 * ZATEN "bir sonraki beklenen iş tarihi"nin ta kendisi — `lib/cron.ts:
 * generateRecurringJobs` her gece 02:00'de bu tarihi geçmiş (`<= now`) her
 * tekrarlayan sözleşme için bir iş üretip tarihi bir periyot ileri alıyor.
 * Yani normal koşullarda aktif bir tekrarlayan sözleşmenin
 * `nextGenerationDate`'i HİÇBİR ZAMAN bugünden eski kalmamalı — eskiyse
 * (`< now`), cron'un o sözleşme için çalışmadığının (sunucu kapalıydı, hata
 * oluştu, vb.) doğrudan kanıtıdır. Yeni bir "beklenen tarih" hesaplama
 * mantığı İCAT EDİLMEDİ — mevcut alan aynen kullanıldı.
 */
export async function getContractsHealthCheck(_req: Request, res: Response) {
  const now = new Date();

  const overdue = await prisma.contract.findMany({
    where: {
      status: "ACTIVE",
      recurrenceType: { not: null },
      nextGenerationDate: { lt: now },
    },
    orderBy: { nextGenerationDate: "asc" },
    include: { customer: { select: { id: true, fullName: true } } },
  });

  const data = overdue.map((c) => ({
    id: c.id,
    customerId: c.customerId,
    customerName: c.customer.fullName,
    serviceType: c.serviceType,
    recurrenceType: c.recurrenceType,
    nextGenerationDate: c.nextGenerationDate,
    daysOverdue: Math.max(1, Math.ceil((now.getTime() - c.nextGenerationDate!.getTime()) / (1000 * 60 * 60 * 24))),
  }));

  return res.json({ data, count: data.length });
}

export async function getExpiringContracts(_req: Request, res: Response) {
  const now = new Date();
  const in30Days = new Date();
  in30Days.setDate(now.getDate() + 30);

  const contracts = await prisma.contract.findMany({
    where: { endDate: { gte: now, lte: in30Days } },
    orderBy: { endDate: "asc" },
    include: { customer: true },
  });

  return res.json({ data: contracts });
}

export async function getContract(req: Request, res: Response) {
  const contract = await prisma.contract.findUnique({ where: { id: idParam(req) } });
  if (!contract) {
    return res.status(404).json({ error: "Sözleşme bulunamadı" });
  }

  const user = req.user!;
  if (user.role === Role.CUSTOMER) {
    const customerId = await getCustomerIdForUser(user.sub);
    if (customerId !== contract.customerId) {
      return res.status(403).json({ error: "Bu işlem için yetkiniz yok" });
    }
  }

  return res.json(contract);
}

export async function createContract(req: Request, res: Response) {
  const data = createSchema.parse(req.body);
  const nextGenerationDate = computeNextGenerationDate(data.recurrenceType, data.startDate);

  const contract = await prisma.contract.create({ data: { ...data, nextGenerationDate } });

  // Contract bir User'a değil Customer'a bağlı — hedef olarak aktörü kullanan
  // aynı desen (bkz. productsController.ts:deleteProduct).
  await recordAuditLog({
    actorUserId: req.user!.sub,
    action: "contract.create",
    targetUserId: req.user!.sub,
    targetType: "Contract",
    targetId: contract.id,
    detail: `customerId=${contract.customerId}, amount=${contract.amount ?? "—"}`,
  });

  return res.status(201).json(contract);
}

const renewSchema = z.object({
  durationMonths: z.number().int().positive().optional(),
  amount: z.number().nonnegative().optional(),
  recurrenceType: z.enum(RecurrenceType).nullable().optional(),
});

/**
 * Sözleşme yenileme (Stitch Müdür → Sözleşmeler → "Yenile").
 *
 * Yeni dönem, eski sözleşmenin bitiş tarihinden başlar; süre/tutar/periyot
 * verilmezse eskisinden devralınır. Eski kayıt EXPIRED'a çekilir — böylece
 * aynı müşteri için iki ACTIVE sözleşme oluşmaz.
 *
 * Mükerrer yenilemeye karşı iyimser kilit: `status: "ACTIVE"` koşulu WHERE'de
 * olduğundan iki eşzamanlı istekten yalnızca biri yeni sözleşmeyi oluşturur
 * (bkz. quotesController.ts:convertQuote ile aynı desen).
 */
export async function renewContract(req: Request, res: Response) {
  // Tüm alanlar opsiyonel: gövdesiz POST da geçerli bir "olduğu gibi yenile"
  // isteğidir (mobil istemci gövdesiz gönderir).
  const body = renewSchema.parse(req.body ?? {});

  const existing = await prisma.contract.findUnique({ where: { id: idParam(req) } });
  if (!existing) {
    return res.status(404).json({ error: "Sözleşme bulunamadı" });
  }
  if (existing.status !== "ACTIVE") {
    return res.status(409).json({ error: "Yalnızca aktif sözleşmeler yenilenebilir" });
  }

  const durationMonths = body.durationMonths ?? existing.durationMonths;
  const startDate = new Date(existing.endDate);
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + durationMonths);

  const recurrenceType =
    body.recurrenceType === undefined ? existing.recurrenceType : body.recurrenceType;
  const amount = body.amount ?? (existing.amount === null ? undefined : Number(existing.amount));

  const created = await prisma.$transaction(async (tx) => {
    const guarded = await tx.contract.updateMany({
      where: { id: existing.id, status: "ACTIVE" },
      data: { status: "EXPIRED" },
    });
    if (guarded.count === 0) return null;

    return tx.contract.create({
      data: {
        customerId: existing.customerId,
        startDate,
        endDate,
        durationMonths,
        status: "ACTIVE",
        serviceType: existing.serviceType,
        amount,
        recurrenceType,
        nextGenerationDate: computeNextGenerationDate(recurrenceType, startDate),
      },
    });
  });

  if (!created) {
    return res.status(409).json({ error: "Bu sözleşme başka bir istekle yenilendi" });
  }

  await recordAuditLog({
    actorUserId: req.user!.sub,
    action: "contract.renew",
    targetUserId: req.user!.sub,
    targetType: "Contract",
    targetId: created.id,
    detail: `${existing.id} -> ${created.id} (${durationMonths} ay)`,
  });

  return res.status(201).json(created);
}

export async function updateContract(req: Request, res: Response) {
  const data = updateSchema.parse(req.body);

  const existing = await prisma.contract.findUnique({ where: { id: idParam(req) } });
  if (!existing) {
    return res.status(404).json({ error: "Sözleşme bulunamadı" });
  }

  const effectiveStartDate = data.startDate ?? existing.startDate;
  const nextGenerationDate = computeNextGenerationDate(data.recurrenceType, effectiveStartDate);

  const contract = await prisma.contract.update({
    where: { id: idParam(req) },
    data: { ...data, ...(nextGenerationDate !== undefined && { nextGenerationDate }) },
  });

  await recordAuditLog({
    actorUserId: req.user!.sub,
    action: "contract.update",
    targetUserId: req.user!.sub,
    targetType: "Contract",
    targetId: contract.id,
    detail: JSON.stringify(data),
  });

  return res.json(contract);
}

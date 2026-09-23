import type { Request, Response } from "express";
import { z } from "zod";
import { ExpenseCategory, type Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getPagination, paginatedResponse } from "../lib/pagination";
import { idParam } from "../lib/params";
import { recordAuditLog } from "../lib/auditLog";

const createSchema = z.object({
  category: z.enum(ExpenseCategory),
  amount: z.number().positive(),
  description: z.string().min(1).nullable().optional(),
  date: z.coerce.date(),
  receiptUrl: z.string().min(1).nullable().optional(),
});

const updateSchema = z.object({
  category: z.enum(ExpenseCategory).optional(),
  amount: z.number().positive().optional(),
  description: z.string().min(1).nullable().optional(),
  date: z.coerce.date().optional(),
  receiptUrl: z.string().min(1).nullable().optional(),
});

export async function listExpenses(req: Request, res: Response) {
  const { skip, take, page, limit } = getPagination(req);
  const category = typeof req.query.category === "string" ? req.query.category : undefined;
  const month = typeof req.query.month === "string" ? req.query.month : undefined; // "YYYY-MM"

  const where: Prisma.ExpenseWhereInput = {};
  if (category && Object.values(ExpenseCategory).includes(category as ExpenseCategory)) {
    where.category = category as ExpenseCategory;
  }
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [year, monthIndex] = month.split("-").map(Number);
    where.date = {
      gte: new Date(year, monthIndex - 1, 1),
      lt: new Date(year, monthIndex, 1),
    };
  }

  const [data, total, byCategory] = await Promise.all([
    prisma.expense.findMany({
      where,
      skip,
      take,
      orderBy: { date: "desc" },
      include: { recordedByUser: { select: { fullName: true } } },
    }),
    prisma.expense.count({ where }),
    prisma.expense.groupBy({ by: ["category"], where, _sum: { amount: true } }),
  ]);

  // Filtreye uyan TÜM kayıtların toplamı — istemciler "Toplam Gider" ve
  // kategori kartlarını önceden yalnızca yüklenen sayfadan (20 kayıt)
  // topluyordu; 20'den fazla gider olunca kartlar eksik gösteriyordu.
  const categoryTotals = Object.fromEntries(byCategory.map((g) => [g.category, Number(g._sum.amount ?? 0)]));
  const totals = {
    amount: Object.values(categoryTotals).reduce((sum, v) => sum + v, 0),
    byCategory: categoryTotals,
  };

  return res.json({ ...paginatedResponse(data, total, page, limit), totals });
}

export async function createExpense(req: Request, res: Response) {
  const data = createSchema.parse(req.body);
  const expense = await prisma.expense.create({
    data: { ...data, recordedByUserId: req.user!.sub },
  });

  return res.status(201).json(expense);
}

export async function updateExpense(req: Request, res: Response) {
  const existing = await prisma.expense.findUnique({ where: { id: idParam(req) } });
  if (!existing) {
    return res.status(404).json({ error: "Gider bulunamadı" });
  }

  const data = updateSchema.parse(req.body);
  const expense = await prisma.expense.update({ where: { id: existing.id }, data });

  return res.json(expense);
}

export async function deleteExpense(req: Request, res: Response) {
  const existing = await prisma.expense.findUnique({ where: { id: idParam(req) } });
  if (!existing) {
    return res.status(404).json({ error: "Gider bulunamadı" });
  }

  await prisma.expense.delete({ where: { id: existing.id } });

  await recordAuditLog({
    actorUserId: req.user!.sub,
    action: "expense.deleted",
    targetUserId: req.user!.sub,
    targetType: "Expense",
    targetId: existing.id,
    detail: `${existing.category} — ${Number(existing.amount).toFixed(2)} ₺`,
  });

  return res.status(204).send();
}

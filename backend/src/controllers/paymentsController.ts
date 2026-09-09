import type { Request, Response } from "express";
import { z } from "zod";
import { Role, AdvanceStatus, type Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getPagination, paginatedResponse } from "../lib/pagination";
import { getCustomerIdForUser, hasPermission } from "../lib/access";
import { recordAuditLog } from "../lib/auditLog";
import { getMonthlyRevenueTarget } from "../lib/targets";

const createSchema = z.object({
  customerId: z.string().uuid(),
  amount: z.number().positive(),
  paymentType: z.string().min(1),
  receiptUrl: z.string().optional(),
  // Stitch Müdür → Para → "Tahsilat Ekle": dekont/işlem no ve tahsilatı
  // yapan saha personeli.
  referenceNo: z.string().min(1).optional(),
  collectedByStaffId: z.string().uuid().optional(),
});

export async function listPayments(req: Request, res: Response) {
  const { skip, take, page, limit } = getPagination(req);
  const user = req.user!;

  const where: Prisma.PaymentWhereInput = {};

  if (user.role === Role.CUSTOMER) {
    const customerId = await getCustomerIdForUser(user.sub);
    if (!customerId) {
      return res.json(paginatedResponse([], 0, page, limit));
    }
    where.customerId = customerId;
  } else if (typeof req.query.customerId === "string") {
    where.customerId = req.query.customerId;
  }

  if (typeof req.query.paymentType === "string") {
    where.paymentType = req.query.paymentType;
  }

  const [data, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { id: true, fullName: true } },
        collectedByStaff: { include: { user: { select: { fullName: true } } } },
      },
    }),
    prisma.payment.count({ where }),
  ]);

  return res.json(paginatedResponse(data, total, page, limit));
}

export async function createPayment(req: Request, res: Response) {
  const data = createSchema.parse(req.body);

  const customer = await prisma.customer.findUnique({ where: { id: data.customerId } });
  if (!customer) {
    return res.status(404).json({ error: "Müşteri bulunamadı" });
  }
  if (data.collectedByStaffId) {
    const staff = await prisma.staff.findUnique({ where: { id: data.collectedByStaffId } });
    if (!staff) {
      return res.status(404).json({ error: "Personel bulunamadı" });
    }
  }

  const payment = await prisma.payment.create({ data });

  await recordAuditLog({
    actorUserId: req.user!.sub,
    action: "payment.create",
    targetUserId: customer.userId ?? req.user!.sub,
    targetType: "Payment",
    targetId: payment.id,
    detail: `${customer.fullName} — ${data.amount}₺ (${data.paymentType})`,
  });

  return res.status(201).json(payment);
}

export async function getPaymentsSummary(req: Request, res: Response) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [
    thisMonthAgg,
    allTimeAgg,
    thisMonthCount,
    allJobsPriceAgg,
    staffSalaryAgg,
    pendingAdvancesAgg,
    lastMonthAgg,
    typeGrouped,
    monthlyRevenueTarget,
  ] = await Promise.all([
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { createdAt: { gte: startOfMonth, lt: startOfNextMonth } },
    }),
    prisma.payment.aggregate({ _sum: { amount: true } }),
    prisma.payment.count({ where: { createdAt: { gte: startOfMonth, lt: startOfNextMonth } } }),
    prisma.job.aggregate({ _sum: { price: true } }),
    prisma.staff.aggregate({ _sum: { salaryBase: true } }),
    prisma.advanceRequest.aggregate({ _sum: { amount: true }, _count: true, where: { status: AdvanceStatus.PENDING } }),
    // Stitch Müdür → Para: "geçen aya göre" trend rozeti.
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { createdAt: { gte: startOfLastMonth, lt: startOfMonth } },
    }),
    // Stitch Müdür → Para: tahsilat türü kırılımı (Nakit/Kredi Kartı/Havale…).
    prisma.payment.groupBy({
      by: ["paymentType"],
      _sum: { amount: true },
      _count: { _all: true },
      where: { createdAt: { gte: startOfMonth, lt: startOfNextMonth } },
    }),
    getMonthlyRevenueTarget(),
  ]);

  const totalPriced = Number(allJobsPriceAgg._sum.price ?? 0);
  const totalPaid = Number(allTimeAgg._sum.amount ?? 0);
  const thisMonthTotal = Number(thisMonthAgg._sum.amount ?? 0);
  const lastMonthTotal = Number(lastMonthAgg._sum.amount ?? 0);

  const summary: Record<string, unknown> = {
    thisMonthTotal,
    thisMonthPaymentCount: thisMonthCount,
    allTimeTotal: totalPaid,
    totalOutstandingBalance: totalPriced - totalPaid,
    pendingAdvancesTotal: Number(pendingAdvancesAgg._sum.amount ?? 0),
    pendingAdvancesCount: pendingAdvancesAgg._count,
    lastMonthTotal,
    // Geçen ay 0 ise yüzde değişim tanımsızdır — uydurma değer yerine null.
    monthOverMonthChangePercent:
      lastMonthTotal > 0 ? ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100 : null,
    paymentTypeBreakdown: typeGrouped
      .map((g) => ({
        paymentType: g.paymentType,
        total: Number(g._sum.amount ?? 0),
        count: g._count._all,
      }))
      .sort((a, b) => b.total - a.total),
    // Hedef OWNER tarafından /settings üzerinden yönetilir; tanımlı değilse
    // varsayılan uydurulmaz (null) ve arayüz ilerleme çubuğunu göstermez.
    monthlyRevenueTarget,
    revenueTargetCompletionPercent:
      monthlyRevenueTarget && monthlyRevenueTarget > 0
        ? (thisMonthTotal / monthlyRevenueTarget) * 100
        : null,
  };

  const canViewFinance = req.user!.role === Role.OWNER || (await hasPermission(req.user!.sub, "view_finance"));

  if (canViewFinance) {
    const totalStaffSalaryBase = Number(staffSalaryAgg._sum.salaryBase ?? 0);
    const netProfitThisMonth = thisMonthTotal - totalStaffSalaryBase;
    summary.netProfitThisMonth = netProfitThisMonth;
    summary.profitMargin = thisMonthTotal > 0 ? (netProfitThisMonth / thisMonthTotal) * 100 : null;
  }

  return res.json(summary);
}

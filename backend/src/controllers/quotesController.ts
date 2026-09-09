import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { getPagination, paginatedResponse } from "../lib/pagination";
import { idParam } from "../lib/params";
import { notifyManagement } from "../lib/notify";
import { verifyRecaptcha } from "../lib/recaptcha";
import { recordAuditLog } from "../lib/auditLog";

const createSchema = z.object({
  fullName: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().optional(),
  propertyType: z.string().min(1),
  serviceType: z.string().min(1),
  address: z.string().optional(),
  district: z.string().optional(),
  recaptchaToken: z.string().optional(),
});

const updateSchema = z.object({
  status: z.string().min(1).optional(),
  amount: z.number().nonnegative().nullable().optional(),
  // Stitch Müdür → Teklifler → detay: yönetim notu ve keşif randevusu.
  note: z.string().nullable().optional(),
  surveyAt: z.coerce.date().nullable().optional(),
});

export async function listQuotes(req: Request, res: Response) {
  const { skip, take, page, limit } = getPagination(req);

  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const where = {
    ...(typeof req.query.status === "string" ? { status: req.query.status } : {}),
    ...(search
      ? {
          OR: [
            { fullName: { contains: search, mode: "insensitive" as const } },
            { phone: { contains: search, mode: "insensitive" as const } },
            { district: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.quoteRequest.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
    prisma.quoteRequest.count({ where }),
  ]);

  return res.json(paginatedResponse(data, total, page, limit));
}

/**
 * Teklif hunisi özeti — Stitch Müdür → Teklifler ekranındaki üst kartlar
 * (durum sayıları, bekleyen teklif tutarı, dönüşüm oranı).
 * Dönüşüm oranı = CONVERTED / (sonuçlanmış: CONVERTED + REJECTED); henüz
 * sonuçlanmamış talepler paydaya dahil edilmez.
 */
export async function getQuotesSummary(_req: Request, res: Response) {
  const [statusGrouped, openAmountAgg, convertedAmountAgg] = await Promise.all([
    prisma.quoteRequest.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.quoteRequest.aggregate({
      _sum: { amount: true },
      where: { status: { notIn: ["CONVERTED", "REJECTED"] } },
    }),
    prisma.quoteRequest.aggregate({ _sum: { amount: true }, where: { status: "CONVERTED" } }),
  ]);

  const byStatus = Object.fromEntries(statusGrouped.map((g) => [g.status, g._count._all]));
  const converted = byStatus["CONVERTED"] ?? 0;
  const rejected = byStatus["REJECTED"] ?? 0;
  const decided = converted + rejected;

  return res.json({
    byStatus,
    totalCount: statusGrouped.reduce((sum, g) => sum + g._count._all, 0),
    openAmountTotal: Number(openAmountAgg._sum.amount ?? 0),
    convertedAmountTotal: Number(convertedAmountAgg._sum.amount ?? 0),
    conversionRate: decided > 0 ? (converted / decided) * 100 : null,
  });
}

export async function createQuote(req: Request, res: Response) {
  const { recaptchaToken, ...data } = createSchema.parse(req.body);

  if (!(await verifyRecaptcha(recaptchaToken, "quote_request"))) {
    return res.status(400).json({ error: "Doğrulama başarısız, lütfen tekrar deneyin" });
  }

  const quote = await prisma.quoteRequest.create({ data });

  await notifyManagement("Yeni teklif talebi alındı", `${quote.fullName} - ${quote.serviceType}`, {
    type: "quote_request",
    relatedType: "QuoteRequest",
    relatedId: quote.id,
  });

  return res.status(201).json(quote);
}

export async function updateQuote(req: Request, res: Response) {
  const data = updateSchema.parse(req.body);

  const existing = await prisma.quoteRequest.findUnique({ where: { id: idParam(req) } });
  if (!existing) {
    return res.status(404).json({ error: "Teklif talebi bulunamadı" });
  }

  const quote = await prisma.quoteRequest.update({ where: { id: idParam(req) }, data });

  // QuoteRequest bir kullanıcıya bağlı değil — hedef olarak eylemi yapan aktör
  // kullanılır, targetType="QuoteRequest" ile filtrelenebilir bir iz bırakır
  // (bkz. productsController.ts:deleteProduct'taki aynı desen).
  await recordAuditLog({
    actorUserId: req.user!.sub,
    action: "quote.update",
    targetUserId: req.user!.sub,
    targetType: "QuoteRequest",
    targetId: quote.id,
    detail: JSON.stringify(data),
  });

  return res.json(quote);
}

/**
 * Tek bir teklifin denetim geçmişi — Stitch Müdür → Teklifler → "Tarihçe".
 *
 * DAR KAPSAMLI yetki genişletmesidir: `/audit-logs` OWNER'a kısıtlı kalır,
 * burada sorgu `targetType="QuoteRequest" AND targetId=:id` ile SABİTLENİR;
 * istemci hiçbir filtre parametresi geçiremez, yani müdür bu uçtan başka bir
 * varlığın veya kullanıcının denetim kaydını göremez.
 */
export async function getQuoteHistory(req: Request, res: Response) {
  const quoteId = idParam(req);

  const quote = await prisma.quoteRequest.findUnique({ where: { id: quoteId } });
  if (!quote) {
    return res.status(404).json({ error: "Teklif talebi bulunamadı" });
  }

  const entries = await prisma.auditLog.findMany({
    where: { targetType: "QuoteRequest", targetId: quoteId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      action: true,
      detail: true,
      createdAt: true,
      actor: { select: { fullName: true } },
    },
  });

  return res.json({ data: entries });
}

export async function convertQuote(req: Request, res: Response) {
  const quote = await prisma.quoteRequest.findUnique({ where: { id: idParam(req) } });
  if (!quote) {
    return res.status(404).json({ error: "Teklif talebi bulunamadı" });
  }

  if (quote.status === "CONVERTED") {
    return res.status(409).json({ error: "Bu teklif zaten dönüştürülmüş" });
  }

  // İki eşzamanlı dönüştürme isteğinde yalnızca biri gerçekten uygulanır:
  // updateMany'nin WHERE koşulu status'u da içerdiği için (jobsController.ts:
  // applyJobUpdate ile aynı iyimser kilit deseni) mükerrer müşteri oluşumu
  // engellenir. Tek bir transaction içinde: guard başarısız olursa müşteri
  // hiç oluşturulmaz; müşteri oluşturma başarısız olursa durum bayrağı
  // (status=CONVERTED) geri alınır.
  const customer = await prisma.$transaction(async (tx) => {
    const guarded = await tx.quoteRequest.updateMany({
      where: { id: quote.id, status: { not: "CONVERTED" } },
      data: { status: "CONVERTED", convertedAt: new Date() },
    });
    if (guarded.count === 0) return null;

    return tx.customer.create({
      data: {
        fullName: quote.fullName,
        phone: quote.phone,
        email: quote.email,
        address: quote.address,
        district: quote.district,
      },
    });
  });

  if (!customer) {
    return res.status(409).json({ error: "Bu teklif başka bir istekle zaten dönüştürüldü" });
  }

  await recordAuditLog({
    actorUserId: req.user!.sub,
    action: "quote.convert",
    targetUserId: req.user!.sub,
    targetType: "QuoteRequest",
    targetId: quote.id,
    detail: `-> Customer ${customer.id} (${customer.fullName})`,
  });

  return res.status(201).json(customer);
}

import type { Request, Response } from "express";
import { z } from "zod";
import { StockMovementType, ProductCategory, PurchaseRequestStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getPagination, paginatedResponse } from "../lib/pagination";
import { idParam } from "../lib/params";
import { recordAuditLog } from "../lib/auditLog";
import { notifyManagement } from "../lib/notify";
import { computeForecast, sumOutUsageByProduct } from "../lib/stockForecast";
import { createBatchIfProvided, decorateBatch, findExpiringBatches } from "../lib/productBatches";

const createSchema = z.object({
  code: z.string().min(1).optional(),
  name: z.string().min(1),
  unit: z.string().min(1),
  description: z.string().optional(),
  category: z.enum(ProductCategory).optional(),
  currentStock: z.number().nonnegative().default(0),
  criticalThreshold: z.number().nonnegative(),
});

const updateSchema = z.object({
  code: z.string().nullable().optional(),
  name: z.string().min(1).optional(),
  unit: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  category: z.enum(ProductCategory).optional(),
  criticalThreshold: z.number().nonnegative().optional(),
});

/**
 * Bölüm AM (9. tur): stok girişinde OPSİYONEL parti no + SKT. İkisi birlikte
 * verilmeli (biri varsa diğeri zorunlu) — yarım parti kaydı olmaz.
 */
const batchFields = {
  batchNumber: z.string().trim().min(1).max(64).optional(),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "SKT YYYY-AA-GG biçiminde olmalı").optional(),
};
function validateBatchPair(data: { batchNumber?: string; expiryDate?: string }): string | null {
  if (!!data.batchNumber !== !!data.expiryDate) return "Parti numarası ve son kullanma tarihi birlikte girilmeli";
  if (data.expiryDate && Number.isNaN(new Date(data.expiryDate).getTime())) return "Geçersiz son kullanma tarihi";
  return null;
}

const restockSchema = z.object({
  quantity: z.number().positive(),
  note: z.string().optional(),
  ...batchFields,
  supplierId: z.string().uuid().optional(),
});

export async function listProducts(req: Request, res: Response) {
  const { skip, take, page, limit } = getPagination(req);
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const categoryParam = req.query.category;
  const category =
    typeof categoryParam === "string" && Object.values(ProductCategory).includes(categoryParam as ProductCategory)
      ? (categoryParam as ProductCategory)
      : undefined;

  const where = {
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" as const } },
        { code: { contains: search, mode: "insensitive" as const } },
        { description: { contains: search, mode: "insensitive" as const } },
      ],
    }),
    ...(category && { category }),
  };

  const [data, total] = await Promise.all([
    prisma.product.findMany({ where, skip, take, orderBy: { name: "asc" } }),
    prisma.product.count({ where }),
  ]);

  // Stitch Müdür → Stok: her satırda "Son Sarfiyat/Son Giriş" ve
  // "Sipariş Bekleyen" bilgisi görünüyor; tek seferde toplanır (N+1 yok).
  const productIds = data.map((p) => p.id);
  const [movements, pendingPurchases, usage] = await Promise.all([
    productIds.length
      ? prisma.stockMovement.findMany({
          where: { productId: { in: productIds } },
          orderBy: { createdAt: "desc" },
          take: productIds.length * 3,
          select: { productId: true, type: true, quantity: true, note: true, createdAt: true },
        })
      : Promise.resolve([]),
    productIds.length
      ? prisma.stockPurchaseRequest.groupBy({
          by: ["productId"],
          _sum: { quantity: true },
          where: { productId: { in: productIds }, status: PurchaseRequestStatus.PENDING },
        })
      : Promise.resolve([]),
    // Bölüm W: son 30 gün OUT toplamı → kart etiketi "Tahmini N gün sonra biter".
    sumOutUsageByProduct(productIds),
  ]);

  const enriched = data.map((product) => ({
    ...product,
    forecast: computeForecast(Number(product.currentStock), usage.get(product.id) ?? 0),
    lastMovement: movements.find((m) => m.productId === product.id) ?? null,
    pendingPurchaseQuantity: Number(
      pendingPurchases.find((p) => p.productId === product.id)?._sum.quantity ?? 0
    ),
  }));

  return res.json(paginatedResponse(enriched, total, page, limit));
}

/** Kritik eşiğin altındaki ürünler — /products/low-stock ve yönetici özeti ortak kullanır. */
export async function findLowStockProducts() {
  const products = await prisma.product.findMany({ orderBy: { name: "asc" } });
  return products.filter((p) => Number(p.currentStock) <= Number(p.criticalThreshold));
}

export async function getLowStockProducts(_req: Request, res: Response) {
  return res.json({ data: await findLowStockProducts() });
}

export async function createProduct(req: Request, res: Response) {
  const data = createSchema.parse(req.body);
  const product = await prisma.product.create({ data });
  return res.status(201).json(product);
}

export async function updateProduct(req: Request, res: Response) {
  const data = updateSchema.parse(req.body);

  const existing = await prisma.product.findUnique({ where: { id: idParam(req) } });
  if (!existing) {
    return res.status(404).json({ error: "Ürün bulunamadı" });
  }

  const product = await prisma.product.update({ where: { id: idParam(req) }, data });
  return res.json(product);
}

export async function deleteProduct(req: Request, res: Response) {
  const existing = await prisma.product.findUnique({ where: { id: idParam(req) } });
  if (!existing) {
    return res.status(404).json({ error: "Ürün bulunamadı" });
  }

  await prisma.product.delete({ where: { id: idParam(req) } });

  // Ürünün bir kullanıcıya bağlı olmadığı için (Product modeli userId taşımıyor)
  // hedef kullanıcı olarak eylemi yapan aktör kullanılır — customersController'daki
  // "hedefsiz eylem loglanmaz" kuralından farklı olarak burada targetType="Product"
  // ile filtrelenebilir bir iz bırakmak, hiç loglamamaktan daha değerlidir.
  await recordAuditLog({
    actorUserId: req.user!.sub,
    action: "product.delete",
    targetUserId: req.user!.sub,
    targetType: "Product",
    targetId: existing.id,
    detail: existing.name,
  });

  return res.status(204).send();
}

export async function restockProduct(req: Request, res: Response) {
  const existing = await prisma.product.findUnique({ where: { id: idParam(req) } });
  if (!existing) {
    return res.status(404).json({ error: "Ürün bulunamadı" });
  }

  const { quantity, note, batchNumber, expiryDate, supplierId } = restockSchema.parse(req.body);
  const batchError = validateBatchPair({ batchNumber, expiryDate });
  if (batchError) return res.status(400).json({ error: batchError });

  const product = await prisma.$transaction(async (tx) => {
    const updated = await tx.product.update({
      where: { id: existing.id },
      data: { currentStock: { increment: quantity } },
    });
    const batchId = await createBatchIfProvided(tx, existing.id, quantity, { batchNumber, expiryDate, supplierId });
    await tx.stockMovement.create({
      data: { productId: existing.id, type: StockMovementType.IN, quantity, note, batchId },
    });
    return updated;
  });

  await recordAuditLog({
    actorUserId: req.user!.sub,
    action: "product.restock",
    targetUserId: req.user!.sub,
    targetType: "Product",
    targetId: existing.id,
    detail: `+${quantity} ${existing.unit} (${existing.name})`,
  });

  return res.json(product);
}

const countSchema = z.object({
  countedQuantity: z.number().nonnegative(),
});

/**
 * Fiili sayım mutabakatı — depoda sayılan gerçek miktar sisteme girilir.
 *
 * Fark = sayılan - mevcut. Fark pozitifse IN, negatifse OUT yönünde tek bir
 * `StockMovement` üretilir ve `currentStock` sayılan değere EŞİTLENİR
 * (artırılmaz/azaltılmaz — mutabakatın anlamı budur). Fark sıfırsa hiçbir
 * hareket veya denetim kaydı yazılmaz; sayım sistemi doğruladığı için
 * değiştirilecek bir şey yoktur.
 *
 * Eşzamanlılık: `currentStock: existing.currentStock` koşullu `updateMany`
 * bir iyimser kilittir — sayım formu açıkken başka biri stok girişi yaparsa
 * bu istek 409 döner ve sayım o taze hareketi sessizce EZMEZ
 * (aynı desen: quotesController.ts:convertQuote).
 */
export async function adjustProductCount(req: Request, res: Response) {
  const productId = idParam(req);
  const existing = await prisma.product.findUnique({ where: { id: productId } });
  if (!existing) {
    return res.status(404).json({ error: "Ürün bulunamadı" });
  }

  const { countedQuantity } = countSchema.parse(req.body);
  const previous = Number(existing.currentStock);
  const difference = countedQuantity - previous;

  if (difference === 0) {
    return res.json({ product: existing, adjusted: false, difference: 0 });
  }

  const note = `Fiili sayım mutabakatı, önceki: ${previous}, sayılan: ${countedQuantity}`;

  const applied = await prisma.$transaction(async (tx) => {
    const guarded = await tx.product.updateMany({
      where: { id: productId, currentStock: existing.currentStock },
      data: { currentStock: countedQuantity },
    });
    if (guarded.count === 0) return false;

    await tx.stockMovement.create({
      data: {
        productId,
        type: difference > 0 ? StockMovementType.IN : StockMovementType.OUT,
        quantity: Math.abs(difference),
        note,
      },
    });
    return true;
  });

  if (!applied) {
    return res.status(409).json({
      error: "Stok bu sayım sırasında başka bir işlemle değişti, sayımı tekrarlayın",
    });
  }

  await recordAuditLog({
    actorUserId: req.user!.sub,
    action: "stock.count_adjustment",
    targetUserId: req.user!.sub,
    targetType: "Product",
    targetId: productId,
    detail: `${existing.name}: ${note} (${difference > 0 ? "+" : ""}${difference} ${existing.unit})`,
  });

  const product = await prisma.product.findUnique({ where: { id: productId } });
  return res.json({ product, adjusted: true, difference });
}

/** Bir ürünün stok hareket geçmişi — Stitch "Son Depo Hareketleri" listesi
 * (bkz. docs/STITCH_FEATURE_MATRIX.md §9). Sayfalı; en yeni önce. */
export async function listProductMovements(req: Request, res: Response) {
  const { skip, take, page, limit } = getPagination(req);
  const productId = idParam(req);

  const existing = await prisma.product.findUnique({ where: { id: productId } });
  if (!existing) {
    return res.status(404).json({ error: "Ürün bulunamadı" });
  }

  const [data, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where: { productId },
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        relatedJobReport: {
          include: {
            job: { include: { customer: { select: { fullName: true } } } },
            staff: { include: { user: { select: { fullName: true } } } },
          },
        },
      },
    }),
    prisma.stockMovement.count({ where: { productId } }),
  ]);

  return res.json(paginatedResponse(data, total, page, limit));
}

// ---------------------------------------------------------------------------
// Satın alma / ikmal talepleri (Stitch Müdür → Stok → "Satın Alma Talebi")
// ---------------------------------------------------------------------------

const purchaseRequestSchema = z.object({
  quantity: z.number().positive(),
  note: z.string().optional(),
  supplierId: z.string().uuid().optional(),
  orderTrackingNumber: z.string().min(1).optional(),
});

/**
 * Yeni ikmal talebi oluşturur. Stok HEMEN artmaz — talep PENDING olarak durur
 * ve ürün listesinde "Sipariş Bekleyen" miktarı olarak görünür. Stok ancak
 * mal kabulünde (receivePurchaseRequest) artar.
 */
export async function createPurchaseRequest(req: Request, res: Response) {
  const productId = idParam(req);
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    return res.status(404).json({ error: "Ürün bulunamadı" });
  }

  const { quantity, note, supplierId, orderTrackingNumber } = purchaseRequestSchema.parse(req.body);

  if (supplierId) {
    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) {
      return res.status(404).json({ error: "Tedarikçi bulunamadı" });
    }
  }

  const request = await prisma.stockPurchaseRequest.create({
    data: { productId, quantity, note, supplierId, orderTrackingNumber, requestedByUserId: req.user!.sub },
  });

  await recordAuditLog({
    actorUserId: req.user!.sub,
    action: "stock.purchase_request.create",
    targetUserId: req.user!.sub,
    targetType: "StockPurchaseRequest",
    targetId: request.id,
    detail: `${product.name} +${quantity} ${product.unit}`,
  });

  // Talebi artık ekip lideri de açabildiği için, onaylayacak olan yönetimin
  // talebi KİMİN açtığını görmesi gerekir.
  const requester = await prisma.user.findUnique({
    where: { id: req.user!.sub },
    select: { fullName: true },
  });

  await notifyManagement(
    "Yeni stok ikmal talebi",
    `${product.name} için ${quantity} ${product.unit} sipariş talebi oluşturuldu` +
      `${requester ? ` (${requester.fullName})` : ""}.`,
    { type: "stock_purchase_request", relatedType: "Product", relatedId: product.id }
  );

  return res.status(201).json(request);
}

export async function listPurchaseRequests(req: Request, res: Response) {
  const { skip, take, page, limit } = getPagination(req);
  const statusParam = req.query.status;
  const status =
    typeof statusParam === "string" &&
    Object.values(PurchaseRequestStatus).includes(statusParam as PurchaseRequestStatus)
      ? (statusParam as PurchaseRequestStatus)
      : undefined;

  const where = status ? { status } : {};

  const [data, total] = await Promise.all([
    prisma.stockPurchaseRequest.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        product: { select: { id: true, name: true, unit: true, code: true } },
        requestedBy: { select: { fullName: true } },
        supplier: { select: { id: true, name: true } },
      },
    }),
    prisma.stockPurchaseRequest.count({ where }),
  ]);

  return res.json(paginatedResponse(data, total, page, limit));
}

const purchaseStatusSchema = z.object({
  status: z.enum([PurchaseRequestStatus.RECEIVED, PurchaseRequestStatus.CANCELLED]),
  // Bölüm AM: mal kabulde opsiyonel parti bilgisi (talebin tedarikçisi partiye yazılır).
  ...batchFields,
});

/**
 * Talebi mal kabul (RECEIVED) veya iptal (CANCELLED) eder.
 *
 * Mükerrer mal kabulüne karşı iyimser kilit: `status: PENDING` koşulu
 * WHERE'de olduğu için iki eşzamanlı istekten yalnızca biri uygulanır ve
 * stok yalnızca bir kez artar. Stok artışı + hareket kaydı + talep güncellemesi
 * tek transaction içindedir.
 */
export async function updatePurchaseRequest(req: Request, res: Response) {
  const requestId = idParam(req);
  const { status, batchNumber, expiryDate } = purchaseStatusSchema.parse(req.body);
  const batchError = validateBatchPair({ batchNumber, expiryDate });
  if (batchError) return res.status(400).json({ error: batchError });

  const existing = await prisma.stockPurchaseRequest.findUnique({
    where: { id: requestId },
    include: { product: true },
  });
  if (!existing) {
    return res.status(404).json({ error: "Talep bulunamadı" });
  }
  if (existing.status !== PurchaseRequestStatus.PENDING) {
    return res.status(409).json({ error: "Bu talep zaten sonuçlandırılmış" });
  }

  const applied = await prisma.$transaction(async (tx) => {
    const guarded = await tx.stockPurchaseRequest.updateMany({
      where: { id: requestId, status: PurchaseRequestStatus.PENDING },
      data: {
        status,
        receivedAt: status === PurchaseRequestStatus.RECEIVED ? new Date() : null,
        receivedByUserId: status === PurchaseRequestStatus.RECEIVED ? req.user!.sub : null,
      },
    });
    if (guarded.count === 0) return false;

    if (status === PurchaseRequestStatus.RECEIVED) {
      await tx.product.update({
        where: { id: existing.productId },
        data: { currentStock: { increment: existing.quantity } },
      });
      const batchId = await createBatchIfProvided(tx, existing.productId, existing.quantity, {
        batchNumber,
        expiryDate,
        supplierId: existing.supplierId,
      });
      await tx.stockMovement.create({
        data: {
          productId: existing.productId,
          type: StockMovementType.IN,
          quantity: existing.quantity,
          note: `Satın alma talebi mal kabulü${existing.note ? ` — ${existing.note}` : ""}`,
          batchId,
        },
      });
    }
    return true;
  });

  if (!applied) {
    return res.status(409).json({ error: "Bu talep başka bir istekle sonuçlandırıldı" });
  }

  await recordAuditLog({
    actorUserId: req.user!.sub,
    action: `stock.purchase_request.${status.toLowerCase()}`,
    targetUserId: req.user!.sub,
    targetType: "StockPurchaseRequest",
    targetId: requestId,
    detail: `${existing.product.name} ${Number(existing.quantity)} ${existing.product.unit}`,
  });

  const updated = await prisma.stockPurchaseRequest.findUnique({
    where: { id: requestId },
    include: {
      product: { select: { id: true, name: true, unit: true, code: true } },
      supplier: { select: { id: true, name: true } },
    },
  });
  return res.json(updated);
}

/**
 * Bölüm W (5. tur): GET /products/:id/forecast — son 30 gün OUT hareketlerine
 * göre günlük ortalama tüketim ve tahmini tükenme. Veri yoksa alanlar null,
 * `note: "Tahmin için yeterli veri yok"`.
 */
export async function getProductForecast(req: Request, res: Response) {
  const product = await prisma.product.findUnique({ where: { id: idParam(req) }, select: { id: true, name: true, currentStock: true, unit: true } });
  if (!product) {
    return res.status(404).json({ error: "Ürün bulunamadı" });
  }
  const usage = await sumOutUsageByProduct([product.id]);
  return res.json({
    productId: product.id,
    name: product.name,
    unit: product.unit,
    currentStock: Number(product.currentStock),
    ...computeForecast(Number(product.currentStock), usage.get(product.id) ?? 0),
  });
}

// ---------------------------------------------------------------------------
// Bölüm AM (9. tur): parti / SKT
// ---------------------------------------------------------------------------

/** GET /products/:id/batches — ürünün partileri (bakiyesi 0 olanlar da; SKT sırasıyla). */
export async function listProductBatches(req: Request, res: Response) {
  const productId = idParam(req);
  const existing = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
  if (!existing) {
    return res.status(404).json({ error: "Ürün bulunamadı" });
  }
  const batches = await prisma.productBatch.findMany({
    where: { productId },
    orderBy: [{ expiryDate: "asc" }, { receivedAt: "asc" }],
    include: { supplier: { select: { id: true, name: true } } },
  });
  return res.json({ data: batches.map((b) => decorateBatch(b)) });
}

/**
 * GET /products/expiring-batches?days=30 — süresi `days` gün içinde dolacak
 * veya DOLMUŞ (isExpired=true) bakiyeli partiler, en yakın SKT önce.
 */
export async function getExpiringBatches(req: Request, res: Response) {
  const raw = Number(req.query.days);
  const days = Number.isFinite(raw) && raw >= 0 && raw <= 365 ? Math.floor(raw) : 30;
  const data = await findExpiringBatches(days);
  return res.json({ days, data });
}

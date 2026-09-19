import { StockMovementType, type Prisma } from "@prisma/client";
import { prisma } from "./prisma";

/**
 * Bölüm AM (9. tur): parti (lot) / son kullanma tarihi yardımcıları.
 *
 * Stok çıkışında (iş raporu) ürünün quantityRemaining > 0 partileri
 * EN ÖNCE SÜRESİ DOLACAK olandan başlayarak düşülür (FIFO by expiry) —
 * kullanıcıya seçtirilmez. Bir çıkış birden fazla partiye yayılırsa her
 * parti için ayrı StockMovement(OUT) yazılır; yalnızca İLK hareket
 * relatedJobReport(Product)Id bağını taşır (o alanlar @unique), devam
 * hareketleri yalnızca batchId + not taşır. Toplam hareket miktarı = çıkış
 * miktarı. Partiler çıkışı karşılamıyorsa (partisiz eski stok) kalan miktar
 * batchId'siz tek bir hareket olarak yazılır — geriye dönük uyumluluk.
 */

type Tx = Prisma.TransactionClient;

export interface BatchInput {
  batchNumber?: string;
  expiryDate?: string;
  supplierId?: string | null;
}

/** Restock / mal kabul: parti bilgisi verilmişse ProductBatch açar, id döner. */
export async function createBatchIfProvided(
  tx: Tx,
  productId: string,
  quantity: number | Prisma.Decimal,
  input: BatchInput
): Promise<string | null> {
  if (!input.batchNumber || !input.expiryDate) return null;
  const batch = await tx.productBatch.create({
    data: {
      productId,
      batchNumber: input.batchNumber,
      expiryDate: new Date(input.expiryDate),
      quantityReceived: quantity,
      quantityRemaining: quantity,
      supplierId: input.supplierId ?? null,
    },
  });
  return batch.id;
}

interface OutMovementBase {
  productId: string;
  quantity: number;
  note: string;
  relatedJobReportId?: string;
  relatedJobReportProductId?: string;
}

/**
 * FIFO-by-expiry stok çıkışı. Product.currentStock'u AZALTMAZ — çağıran
 * mevcut `decrement` mantığını korur; bu yalnızca parti bakiyeleri ve
 * hareket kayıtlarını üretir. Dönüş: yazılan hareketlerin parti dağılımı.
 */
export async function consumeFromBatches(
  tx: Tx,
  base: OutMovementBase
): Promise<{ batchId: string | null; quantity: number }[]> {
  const batches = await tx.productBatch.findMany({
    where: { productId: base.productId, quantityRemaining: { gt: 0 } },
    orderBy: [{ expiryDate: "asc" }, { receivedAt: "asc" }],
  });

  let remaining = round2(base.quantity);
  const allocations: { batchId: string | null; quantity: number }[] = [];

  for (const batch of batches) {
    if (remaining <= 0) break;
    const available = Number(batch.quantityRemaining);
    const take = round2(Math.min(available, remaining));
    if (take <= 0) continue;
    await tx.productBatch.update({
      where: { id: batch.id },
      data: { quantityRemaining: { decrement: take } },
    });
    allocations.push({ batchId: batch.id, quantity: take });
    remaining = round2(remaining - take);
  }

  if (remaining > 0) allocations.push({ batchId: null, quantity: remaining });

  for (let i = 0; i < allocations.length; i++) {
    const a = allocations[i];
    await tx.stockMovement.create({
      data: {
        productId: base.productId,
        type: StockMovementType.OUT,
        quantity: a.quantity,
        batchId: a.batchId,
        note: i === 0 ? base.note : `${base.note} (parti devamı)`,
        // @unique alanlar yalnızca ilk harekette.
        ...(i === 0 && base.relatedJobReportId ? { relatedJobReportId: base.relatedJobReportId } : {}),
        ...(i === 0 && base.relatedJobReportProductId ? { relatedJobReportProductId: base.relatedJobReportProductId } : {}),
      },
    });
  }

  return allocations;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export const EXPIRY_ALERT_WINDOW_DAYS = 7;

/**
 * SKT `@db.Date` — Prisma bunu UTC gece yarısı Date olarak döner; "bugün" ise
 * sunucunun yerel takvim günüdür. İkisi de gün sayısına indirgenerek
 * karşılaştırılır (zaman dilimi kayması yok).
 */
function utcDayOf(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}
function localTodayAsUtcDay(now = new Date()): number {
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
}

export function daysUntil(expiryDate: Date, now = new Date()): number {
  return Math.round((utcDayOf(expiryDate) - localTodayAsUtcDay(now)) / (1000 * 60 * 60 * 24));
}

/** Bugün + `days` gün — @db.Date sütunuyla karşılaştırılabilir UTC gece yarısı. */
export function windowEndDate(days: number, now = new Date()): Date {
  const d = new Date(localTodayAsUtcDay(now));
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/** Web/mobil için tek tip parti satırı — isExpired + daysLeft hesaplı. */
export function decorateBatch<T extends { expiryDate: Date; quantityRemaining: unknown }>(batch: T, now = new Date()) {
  const daysLeft = daysUntil(batch.expiryDate, now);
  return { ...batch, daysLeft, isExpired: daysLeft < 0 };
}

/**
 * Süresi `days` gün içinde dolacak VEYA dolmuş, bakiyesi > 0 partiler.
 * Süresi dolmuş partiler ayrı işaretlenir (isExpired) ama listeden düşmez —
 * imha/iade takibi için görünmeleri gerekir.
 */
export async function findExpiringBatches(days: number, onlyProductIds?: string[]) {
  const windowEnd = windowEndDate(days);
  const batches = await prisma.productBatch.findMany({
    where: {
      quantityRemaining: { gt: 0 },
      expiryDate: { lte: windowEnd },
      ...(onlyProductIds ? { productId: { in: onlyProductIds } } : {}),
    },
    orderBy: { expiryDate: "asc" },
    include: {
      product: { select: { id: true, name: true, unit: true, code: true } },
      supplier: { select: { id: true, name: true } },
    },
  });
  return batches.map((b) => decorateBatch(b));
}

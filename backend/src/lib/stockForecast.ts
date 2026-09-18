import { StockMovementType } from "@prisma/client";
import { prisma } from "./prisma";

/**
 * Bölüm W (5. tur): Kullanım bazlı stok tükenme tahmini.
 * Son FORECAST_WINDOW_DAYS gündeki OUT hareketlerinin toplamı / gün sayısı =
 * günlük ortalama tüketim; currentStock / günlük tüketim = kalan gün.
 * Hareket YOKSA tahmin üretilmez (null) — uydurma sayı yok.
 */
export const FORECAST_WINDOW_DAYS = 30;

export interface StockForecast {
  windowDays: number;
  /** Pencerede toplam OUT miktarı. */
  usedInWindow: number;
  dailyAverageUsage: number | null;
  estimatedDaysRemaining: number | null;
  estimatedDepletionDate: string | null;
  /** Kullanıcıya gösterilecek gerekçe (veri yoksa). */
  note: string | null;
}

export function computeForecast(currentStock: number, usedInWindow: number, now = new Date(), windowDays = FORECAST_WINDOW_DAYS): StockForecast {
  if (usedInWindow <= 0) {
    return {
      windowDays,
      usedInWindow: 0,
      dailyAverageUsage: null,
      estimatedDaysRemaining: null,
      estimatedDepletionDate: null,
      note: "Tahmin için yeterli veri yok",
    };
  }
  const dailyAverageUsage = usedInWindow / windowDays;
  if (currentStock <= 0) {
    return { windowDays, usedInWindow, dailyAverageUsage, estimatedDaysRemaining: 0, estimatedDepletionDate: now.toISOString(), note: null };
  }
  const days = currentStock / dailyAverageUsage;
  const depletion = new Date(now.getTime() + days * 24 * 3600 * 1000);
  return {
    windowDays,
    usedInWindow,
    dailyAverageUsage: Math.round(dailyAverageUsage * 100) / 100,
    estimatedDaysRemaining: Math.floor(days),
    estimatedDepletionDate: depletion.toISOString(),
    note: null,
  };
}

/** Birden fazla ürün için tek groupBy ile pencere içi OUT toplamları. */
export async function sumOutUsageByProduct(productIds: string[], now = new Date(), windowDays = FORECAST_WINDOW_DAYS): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (productIds.length === 0) return result;
  const since = new Date(now.getTime() - windowDays * 24 * 3600 * 1000);
  const grouped = await prisma.stockMovement.groupBy({
    by: ["productId"],
    _sum: { quantity: true },
    where: { productId: { in: productIds }, type: StockMovementType.OUT, createdAt: { gte: since } },
  });
  for (const g of grouped) result.set(g.productId, Number(g._sum.quantity ?? 0));
  return result;
}

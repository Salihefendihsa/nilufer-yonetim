import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Role, StockMovementType } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { computeForecast, FORECAST_WINDOW_DAYS } from "../src/lib/stockForecast";
import { api, TestContext, TEST_PREFIX, uid, type TestUser } from "./helpers/fixtures";

/**
 * Bölüm W (5. tur): Stok tükenme tahmini.
 * - saf hesap: bilinen tüketimle günlük ortalama ve kalan gün; veri yoksa null
 * - GET /products/:id/forecast: 30 gün içindeki OUT hareketleri sayılır, 31+ gün
 *   öncekiler ve IN hareketleri sayılmaz; /products listesinde forecast gömülü
 * - Temizlik: ürün ve hareketler ID ile silinir (track).
 */
describe("computeForecast (saf)", () => {
  it("60 birim/30 gün → günde 2; 40 stok → 20 gün", () => {
    const now = new Date("2026-09-18T12:00:00.000Z");
    const f = computeForecast(40, 60, now);
    expect(f.dailyAverageUsage).toBe(2);
    expect(f.estimatedDaysRemaining).toBe(20);
    expect(new Date(f.estimatedDepletionDate!).toISOString()).toBe("2026-10-08T12:00:00.000Z");
    expect(f.note).toBeNull();
  });

  it("kullanım yoksa null + açıklayıcı not; stok 0 ise 0 gün", () => {
    const none = computeForecast(100, 0);
    expect(none.dailyAverageUsage).toBeNull();
    expect(none.estimatedDaysRemaining).toBeNull();
    expect(none.estimatedDepletionDate).toBeNull();
    expect(none.note).toBe("Tahmin için yeterli veri yok");

    const empty = computeForecast(0, 30);
    expect(empty.estimatedDaysRemaining).toBe(0);
  });
});

describe("GET /products/:id/forecast", () => {
  const ctx = new TestContext();
  let owner: TestUser;
  let staff: TestUser;
  let productId: string;
  let idleProductId: string;
  const tokens: Record<string, string> = {};
  const movementIds: string[] = [];

  beforeAll(async () => {
    owner = await ctx.createUser(Role.OWNER);
    staff = await ctx.createStaffUser(Role.STAFF);
    tokens.owner = await ctx.tokenFor(owner);
    tokens.staff = await ctx.tokenFor(staff);

    const product = await prisma.product.create({
      data: { name: `${TEST_PREFIX}Ürün ${uid()}`, unit: "L", currentStock: 45, criticalThreshold: 5 },
    });
    productId = product.id;
    const idle = await prisma.product.create({
      data: { name: `${TEST_PREFIX}Hareketsiz ${uid()}`, unit: "L", currentStock: 10, criticalThreshold: 1 },
    });
    idleProductId = idle.id;

    const now = Date.now();
    const rows = [
      { type: StockMovementType.OUT, quantity: 30, daysAgo: 2 },
      { type: StockMovementType.OUT, quantity: 30, daysAgo: 20 },
      { type: StockMovementType.OUT, quantity: 500, daysAgo: FORECAST_WINDOW_DAYS + 5 }, // pencere dışı
      { type: StockMovementType.IN, quantity: 100, daysAgo: 1 }, // giriş sayılmaz
    ];
    for (const r of rows) {
      const m = await prisma.stockMovement.create({
        data: { productId, type: r.type, quantity: r.quantity, createdAt: new Date(now - r.daysAgo * 24 * 3600 * 1000), note: "vt_forecast" },
      });
      movementIds.push(m.id);
    }
  });

  afterAll(async () => {
    await prisma.stockMovement.deleteMany({ where: { id: { in: movementIds } } });
    await prisma.product.deleteMany({ where: { id: { in: [productId, idleProductId] } } });
    await ctx.cleanup();
  });

  it("yalnızca 30 gün içindeki OUT hareketleri: 60/30 = 2/gün, 45 stok → 22 gün", async () => {
    const res = await api().get(`/products/${productId}/forecast`).set("Authorization", `Bearer ${tokens.owner}`);
    expect(res.status).toBe(200);
    expect(res.body.usedInWindow).toBe(60);
    expect(res.body.dailyAverageUsage).toBe(2);
    expect(res.body.estimatedDaysRemaining).toBe(22);
    expect(res.body.note).toBeNull();
    expect(new Date(res.body.estimatedDepletionDate).getTime()).toBeGreaterThan(Date.now());
  });

  it("hareketsiz ürün: null alanlar + not; STAFF 403; olmayan ürün 404", async () => {
    const res = await api().get(`/products/${idleProductId}/forecast`).set("Authorization", `Bearer ${tokens.owner}`);
    expect(res.status).toBe(200);
    expect(res.body.dailyAverageUsage).toBeNull();
    expect(res.body.estimatedDaysRemaining).toBeNull();
    expect(res.body.note).toBe("Tahmin için yeterli veri yok");

    const forbidden = await api().get(`/products/${productId}/forecast`).set("Authorization", `Bearer ${tokens.staff}`);
    expect(forbidden.status).toBe(403);
    const missing = await api().get("/products/00000000-0000-4000-8000-000000000000/forecast").set("Authorization", `Bearer ${tokens.owner}`);
    expect(missing.status).toBe(404);
  });

  it("GET /products listesinde her satırda forecast gömülü gelir", async () => {
    const res = await api().get(`/products?search=${encodeURIComponent(TEST_PREFIX)}&limit=100`).set("Authorization", `Bearer ${tokens.owner}`);
    expect(res.status).toBe(200);
    const row = res.body.data.find((p: { id: string }) => p.id === productId);
    expect(row.forecast.estimatedDaysRemaining).toBe(22);
    const idle = res.body.data.find((p: { id: string }) => p.id === idleProductId);
    expect(idle.forecast.estimatedDaysRemaining).toBeNull();
  });
});

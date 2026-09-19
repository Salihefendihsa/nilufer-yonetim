import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { JobStatus, Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { sweepExpiringBatchAlerts } from "../src/lib/reminders";
import { api, localIsoDate, TestContext, TEST_PREFIX, uid, type TestUser } from "./helpers/fixtures";

/**
 * Bölüm AM (9. tur): kimyasal parti / SKT takibi.
 * - restock parti bilgisiyle → ProductBatch + StockMovement.batchId
 * - yarım parti bilgisi (yalnızca no) → 400
 * - iş raporu çıkışı: EN ÖNCE süresi dolacak partiden düşer, yetmezse sıradakine
 *   yayılır (FIFO by expiry); yalnızca ilk hareket rapor bağını taşır
 * - expiring-batches: süresi dolmuş parti isExpired=true ile ayrı işaretlenir
 * - sweepExpiringBatchAlerts: aynı gün ikinci tarama bildirim üretmez (dedup);
 *   yalnızca kapsamlı (onlyProductIds) çağrılır — asla global.
 * - Temizlik: ürün ID ile silinir (partiler cascade), hareketler önce productId ile.
 */
const isoDaysFromNow = (days: number) => localIsoDate(days);

describe("Kimyasal parti / SKT takibi", () => {
  const ctx = new TestContext();
  let owner: TestUser;
  let staff: TestUser;
  let ownerToken: string;
  let staffToken: string;
  let productId: string;
  let plainProductId: string;
  let lateBatchId: string; // SKT uzak (90 gün)
  let soonBatchId: string; // SKT yakın (20 gün) — önce bundan düşülmeli

  beforeAll(async () => {
    owner = await ctx.createUser(Role.OWNER);
    staff = await ctx.createStaffUser(Role.STAFF);
    ownerToken = await ctx.tokenFor(owner);
    staffToken = await ctx.tokenFor(staff);

    const product = await prisma.product.create({
      data: { name: `${TEST_PREFIX}Partili ${uid()}`, unit: "L", currentStock: 0, criticalThreshold: 0 },
    });
    productId = product.id;
    const plain = await prisma.product.create({
      data: { name: `${TEST_PREFIX}Partisiz ${uid()}`, unit: "L", currentStock: 50, criticalThreshold: 0 },
    });
    plainProductId = plain.id;
  });

  afterAll(async () => {
    // Önce rapor satırları/talepler (ürüne FK), sonra hareketler, sonra ürün (partiler cascade).
    await ctx.cleanup();
    await prisma.stockPurchaseRequest.deleteMany({ where: { productId: { in: [productId, plainProductId] } } });
    await prisma.stockMovement.deleteMany({ where: { productId: { in: [productId, plainProductId] } } });
    await prisma.product.deleteMany({ where: { id: { in: [productId, plainProductId] } } });
  });

  it("restock parti no + SKT ile → ProductBatch açılır, hareket batchId taşır", async () => {
    // Önce uzak SKT'li parti (kayıt sırası FIFO'yu ETKİLEMEMELİ — SKT belirleyici).
    const late = await api()
      .post(`/products/${productId}/restock`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ quantity: 10, batchNumber: "LOT-LATE", expiryDate: isoDaysFromNow(90) });
    expect(late.status).toBe(200);

    const soon = await api()
      .post(`/products/${productId}/restock`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ quantity: 4, batchNumber: "LOT-SOON", expiryDate: isoDaysFromNow(20) });
    expect(soon.status).toBe(200);
    expect(Number(soon.body.currentStock)).toBe(14);

    const batches = await prisma.productBatch.findMany({ where: { productId }, orderBy: { expiryDate: "asc" } });
    expect(batches).toHaveLength(2);
    expect(batches[0].batchNumber).toBe("LOT-SOON");
    soonBatchId = batches[0].id;
    lateBatchId = batches[1].id;
    expect(Number(batches[0].quantityRemaining)).toBe(4);

    const inMoves = await prisma.stockMovement.findMany({ where: { productId, type: "IN" } });
    expect(inMoves.map((m) => m.batchId).sort()).toEqual([lateBatchId, soonBatchId].sort());
  });

  it("yalnızca parti no (SKT yok) → 400; partisiz restock eskisi gibi çalışır", async () => {
    const half = await api()
      .post(`/products/${productId}/restock`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ quantity: 1, batchNumber: "LOT-X" });
    expect(half.status).toBe(400);

    const plain = await api()
      .post(`/products/${plainProductId}/restock`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ quantity: 5 });
    expect(plain.status).toBe(200);
    const batchCount = await prisma.productBatch.count({ where: { productId: plainProductId } });
    expect(batchCount).toBe(0);
  });

  it("iş raporu çıkışı FIFO by expiry: önce yakın SKT'li parti, taşan kısım sonrakine", async () => {
    const customer = await ctx.createCustomer();
    const job = await ctx.createJob({ customerId: customer.id, assignedStaffId: staff.staffId!, status: JobStatus.IN_PROGRESS });

    // 4 (yakın) + 2 (uzak) = 6 L çıkış
    const res = await api()
      .post(`/jobs/${job.id}/report`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ dosage: "6 L", products: [{ productId, quantity: 6 }] });
    expect(res.status).toBe(201);

    const soon = await prisma.productBatch.findUniqueOrThrow({ where: { id: soonBatchId } });
    const late = await prisma.productBatch.findUniqueOrThrow({ where: { id: lateBatchId } });
    expect(Number(soon.quantityRemaining)).toBe(0);
    expect(Number(late.quantityRemaining)).toBe(8);

    const outMoves = await prisma.stockMovement.findMany({ where: { productId, type: "OUT" }, orderBy: { quantity: "desc" } });
    expect(outMoves).toHaveLength(2);
    expect(outMoves.reduce((s, m) => s + Number(m.quantity), 0)).toBe(6);
    const linked = outMoves.filter((m) => m.relatedJobReportProductId);
    expect(linked).toHaveLength(1); // @unique alan yalnızca ilk harekette
    expect(linked[0].batchId).toBe(soonBatchId);
    expect(outMoves.find((m) => m.batchId === lateBatchId)?.relatedJobReportProductId).toBeNull();

    const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
    expect(Number(product.currentStock)).toBe(8);
  });

  it("partisiz üründe çıkış → tek, batchId'siz hareket (geriye dönük uyumluluk)", async () => {
    const customer = await ctx.createCustomer();
    const job = await ctx.createJob({ customerId: customer.id, assignedStaffId: staff.staffId!, status: JobStatus.IN_PROGRESS });
    const res = await api()
      .post(`/jobs/${job.id}/report`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ dosage: "3 L", products: [{ productId: plainProductId, quantity: 3 }] });
    expect(res.status).toBe(201);
    const outMoves = await prisma.stockMovement.findMany({ where: { productId: plainProductId, type: "OUT" } });
    expect(outMoves).toHaveLength(1);
    expect(outMoves[0].batchId).toBeNull();
    expect(outMoves[0].relatedJobReportProductId).toBeTruthy();
  });

  it("expiring-batches: süresi dolmuş parti isExpired=true, yakın olan false; pencere dışı görünmez", async () => {
    const expired = await prisma.productBatch.create({
      data: { productId, batchNumber: "LOT-OLD", expiryDate: new Date(isoDaysFromNow(-3)), quantityReceived: 2, quantityRemaining: 2 },
    });
    // Bakiyesi 0 (LOT-SOON) listede olmamalı; LOT-LATE (90 gün) 30 günlük pencere dışı.
    const res = await api().get("/products/expiring-batches?days=30").set("Authorization", `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    const mine = res.body.data.filter((b: { productId: string }) => b.productId === productId);
    expect(mine.map((b: { batchNumber: string }) => b.batchNumber)).toEqual(["LOT-OLD"]);
    expect(mine[0].isExpired).toBe(true);
    expect(mine[0].daysLeft).toBeLessThan(0);
    expect(mine[0].product.name).toContain(TEST_PREFIX);

    const wide = await api().get("/products/expiring-batches?days=120").set("Authorization", `Bearer ${ownerToken}`);
    const wideMine = wide.body.data.filter((b: { productId: string }) => b.productId === productId);
    expect(wideMine.map((b: { batchNumber: string }) => b.batchNumber)).toEqual(["LOT-OLD", "LOT-LATE"]);
    expect(wideMine[1].isExpired).toBe(false);

    const detail = await api().get(`/products/${productId}/batches`).set("Authorization", `Bearer ${ownerToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data).toHaveLength(3);
    expect(detail.body.data.find((b: { id: string }) => b.id === expired.id).isExpired).toBe(true);
  });

  it("SKT taraması: 7 gün penceresi, aynı gün ikinci tarama bildirim üretmez (dedup)", async () => {
    const before = await prisma.notification.count({ where: { userId: owner.id, type: "batch_expiry" } });
    // Kapsam: yalnızca test ürünü (LOT-OLD süresi dolmuş → 1 bildirim; LOT-LATE pencere dışı).
    const first = await sweepExpiringBatchAlerts([productId]);
    expect(first).toBe(1);
    const second = await sweepExpiringBatchAlerts([productId]);
    expect(second).toBe(0);
    const after = await prisma.notification.count({ where: { userId: owner.id, type: "batch_expiry" } });
    expect(after - before).toBe(1);
    const old = await prisma.productBatch.findFirst({ where: { productId, batchNumber: "LOT-OLD" } });
    expect(old?.lastExpiryAlertAt).toBeTruthy();
  });

  it("mal kabulde parti bilgisi → parti talebin tedarikçisini taşır", async () => {
    const supplier = await prisma.supplier.create({ data: { name: `${TEST_PREFIX}Ted ${uid()}` } });
    ctx.track("supplier", supplier.id);
    const created = await api()
      .post(`/products/${productId}/purchase-requests`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ quantity: 7, supplierId: supplier.id });
    expect(created.status).toBe(201);
    const received = await api()
      .patch(`/products/purchase-requests/${created.body.id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ status: "RECEIVED", batchNumber: "LOT-PR", expiryDate: isoDaysFromNow(200) });
    expect(received.status).toBe(200);
    const batch = await prisma.productBatch.findFirst({ where: { productId, batchNumber: "LOT-PR" } });
    expect(batch?.supplierId).toBe(supplier.id);
    expect(Number(batch?.quantityRemaining)).toBe(7);
  });
});

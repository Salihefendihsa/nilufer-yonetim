import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { JobStatus, Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { api, TEST_PREFIX, TestContext, uid, type TestUser } from "./helpers/fixtures";

/**
 * Saha raporu = işi tamamlayan tek, atomik adım. İş kuralı: bir işin tek raporu
 * vardır; yalnızca IN_PROGRESS işe gönderilir; rapor + stok çıkışı + COMPLETED
 * aynı transaction'da yazılır.
 */
describe("Saha raporu, stok ve iş tamamlama akışı", () => {
  const ctx = new TestContext();
  let staff: TestUser;
  let other: TestUser;
  let manager: TestUser;
  let staffToken: string;
  let customerId: string;
  const productIds: string[] = [];

  beforeAll(async () => {
    staff = await ctx.createStaffUser(Role.STAFF);
    other = await ctx.createStaffUser(Role.STAFF);
    manager = await ctx.createUser(Role.MANAGER);
    staffToken = await ctx.tokenFor(staff);
    customerId = (await ctx.createCustomer()).id;
  });

  afterAll(async () => {
    await ctx.cleanup();
    await prisma.stockMovement.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
  });

  async function newProduct(stock: number) {
    const p = await prisma.product.create({
      data: { name: `${TEST_PREFIX}Akış ${uid()}`, unit: "L", currentStock: stock, criticalThreshold: 0 },
    });
    productIds.push(p.id);
    return p.id;
  }
  const stockOf = async (id: string) => Number((await prisma.product.findUniqueOrThrow({ where: { id } })).currentStock);
  const newJob = (status: JobStatus) => ctx.createJob({ customerId, assignedStaffId: staff.staffId!, status });
  const send = (jobId: string, productId: string, quantity: number, token = staffToken) =>
    api().post(`/jobs/${jobId}/report`).set("Authorization", `Bearer ${token}`).send({ dosage: "1 L", products: [{ productId, quantity }] });
  const counts = async (jobId: string, productId: string) => ({
    reports: await prisma.jobReport.count({ where: { jobId } }),
    movements: await prisma.stockMovement.count({ where: { productId } }),
  });

  it.each([JobStatus.PENDING, JobStatus.SCHEDULED, JobStatus.CANCELLED])("%s işte rapor reddedilir; rapor/stok hareketi oluşmaz", async (status) => {
    const productId = await newProduct(10);
    const job = await newJob(status);
    const res = await send(job.id, productId, 2);
    expect(res.status).toBe(409);
    expect(await counts(job.id, productId)).toEqual({ reports: 0, movements: 0 });
    expect(await stockOf(productId)).toBe(10);
    expect((await prisma.job.findUniqueOrThrow({ where: { id: job.id } })).status).toBe(status);
  });

  it("IN_PROGRESS iş bir kez tamamlanır, miktar bir kez düşer, sonuç alanları dolar", async () => {
    const productId = await newProduct(10);
    const job = await newJob(JobStatus.IN_PROGRESS);
    const res = await send(job.id, productId, 2);
    expect(res.status).toBe(201);
    const after = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(after.status).toBe(JobStatus.COMPLETED);
    expect(after.completedAt).not.toBeNull();
    expect(await stockOf(productId)).toBe(8);
    expect(await counts(job.id, productId)).toEqual({ reports: 1, movements: 1 });
  });

  it("aynı isteğin tekrarı (Tamamla'ya tekrar basma) ikinci rapor/stok çıkışı üretmez", async () => {
    const productId = await newProduct(10);
    const job = await newJob(JobStatus.IN_PROGRESS);
    expect((await send(job.id, productId, 2)).status).toBe(201);
    const again = await send(job.id, productId, 2);
    expect(again.status).toBe(409);
    expect(await stockOf(productId)).toBe(8);
    expect(await counts(job.id, productId)).toEqual({ reports: 1, movements: 1 });
  });

  it("eşzamanlı iki istekten yalnızca biri uygulanır", async () => {
    const productId = await newProduct(10);
    const job = await newJob(JobStatus.IN_PROGRESS);
    const results = await Promise.all([send(job.id, productId, 2), send(job.id, productId, 2), send(job.id, productId, 2)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409]);
    expect(await stockOf(productId)).toBe(8);
    expect(await counts(job.id, productId)).toEqual({ reports: 1, movements: 1 });
    expect((await prisma.job.findUniqueOrThrow({ where: { id: job.id } })).status).toBe(JobStatus.COMPLETED);
  });

  it("stok adımı transaction içinde başarısız olursa iş tamamlanmış görünmez, rapor kalmaz", async () => {
    // 3 L stok, iki ayrı iş eşzamanlı 2'şer L ister: ön kontrol ikisini de geçirebilir,
    // ikinci düşüm transaction içinde başarısız olur ve iş kaydı da geri alınır.
    const productId = await newProduct(3);
    const a = await newJob(JobStatus.IN_PROGRESS);
    const b = await newJob(JobStatus.IN_PROGRESS);
    const [ra, rb] = await Promise.all([send(a.id, productId, 2), send(b.id, productId, 2)]);
    const statuses = [ra.status, rb.status].sort();
    expect(statuses[0]).toBe(201);
    expect([400, 409]).toContain(statuses[1]);
    expect(await stockOf(productId)).toBe(1);
    const loser = ra.status === 201 ? b : a;
    expect((await prisma.job.findUniqueOrThrow({ where: { id: loser.id } })).status).toBe(JobStatus.IN_PROGRESS);
    expect(await prisma.jobReport.count({ where: { jobId: loser.id } })).toBe(0);
  });

  it("eski veri: raporu olup IN_PROGRESS kalmış işe ikinci rapor açılmaz", async () => {
    const productId = await newProduct(10);
    const job = await newJob(JobStatus.IN_PROGRESS);
    await prisma.jobReport.create({ data: { jobId: job.id, staffId: staff.staffId!, dosage: "eski" } });
    const res = await send(job.id, productId, 2);
    expect(res.status).toBe(409);
    expect(await stockOf(productId)).toBe(10);
    expect((await prisma.job.findUniqueOrThrow({ where: { id: job.id } })).status).toBe(JobStatus.IN_PROGRESS);
  });

  it("rol yetkileri korunur: atanmamış personel 403, yönetim rapor gönderemez", async () => {
    const productId = await newProduct(10);
    const job = await newJob(JobStatus.IN_PROGRESS);
    expect((await send(job.id, productId, 1, await ctx.tokenFor(other))).status).toBe(403);
    expect((await send(job.id, productId, 1, await ctx.tokenFor(manager))).status).toBe(403);
    expect(await counts(job.id, productId)).toEqual({ reports: 0, movements: 0 });
    expect((await prisma.job.findUniqueOrThrow({ where: { id: job.id } })).status).toBe(JobStatus.IN_PROGRESS);
  });
  describe("PATCH ile raporsuz tamamlama kapalı", () => {
    const patch = (token: string, jobId: string, body: Record<string, unknown>) =>
      api().patch(`/jobs/${jobId}`).set("Authorization", `Bearer ${token}`).send(body);

    it("raporsuz atanmış iş: STAFF ve yönetim rollerinin PATCH COMPLETED isteği 409 ile reddedilir", async () => {
      const owner = await ctx.createUser(Role.OWNER);
      const tokens = [staffToken, await ctx.tokenFor(manager), await ctx.tokenFor(owner)];
      for (const token of tokens) {
        const job = await newJob(JobStatus.IN_PROGRESS);
        const res = await patch(token, job.id, { status: "COMPLETED" });
        expect(res.status).toBe(409);
        expect(res.body.error).toMatch(/rapor/);
        const fresh = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });
        expect(fresh.status).toBe(JobStatus.IN_PROGRESS);
        expect(fresh.completedAt).toBeNull();
      }
    });

    it("atanmamış iş için de arka kapı yok: yönetimin PATCH COMPLETED isteği reddedilir", async () => {
      const job = await ctx.createJob({ customerId, status: JobStatus.IN_PROGRESS });
      const res = await patch(await ctx.tokenFor(manager), job.id, { status: "COMPLETED" });
      expect(res.status).toBe(409);
      expect((await prisma.job.findUniqueOrThrow({ where: { id: job.id } })).status).toBe(JobStatus.IN_PROGRESS);
    });

    it("eski veri onarımı: raporu kayıtlı IN_PROGRESS işi yönetim PATCH ile tamamlar, stok hareketi üretmez", async () => {
      const productId = await newProduct(10);
      const job = await newJob(JobStatus.IN_PROGRESS);
      await prisma.jobReport.create({ data: { jobId: job.id, staffId: staff.staffId!, dosage: "eski" } });
      const res = await patch(await ctx.tokenFor(manager), job.id, { status: "COMPLETED" });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("COMPLETED");
      expect(await stockOf(productId)).toBe(10);
      expect(await counts(job.id, productId)).toEqual({ reports: 1, movements: 0 });
    });

    it("izinli geçişler bozulmaz: planlama, başlatma ve iptal çalışır", async () => {
      const job = await newJob(JobStatus.PENDING);
      const managerToken = await ctx.tokenFor(manager);
      expect((await patch(managerToken, job.id, { status: "SCHEDULED" })).status).toBe(200);
      expect((await patch(staffToken, job.id, { status: "IN_PROGRESS" })).status).toBe(200);
      const cancelled = await patch(managerToken, job.id, { status: "CANCELLED", cancellationReason: "vt_iptal" });
      expect(cancelled.status).toBe(200);
      expect(cancelled.body.status).toBe("CANCELLED");
      expect(cancelled.body.cancelledAt).not.toBeNull();
    });

    it("iş listesi/detayı rapor sayısını verir (istemcilerin Tamamla eylemi buna göre açılır)", async () => {
      const job = await newJob(JobStatus.IN_PROGRESS);
      const managerToken = await ctx.tokenFor(manager);
      const before = await api().get(`/jobs/${job.id}`).set("Authorization", `Bearer ${managerToken}`);
      expect(before.body._count.jobReports).toBe(0);
      await send(job.id, await newProduct(5), 1);
      const after = await api().get(`/jobs/${job.id}`).set("Authorization", `Bearer ${managerToken}`);
      expect(after.body._count.jobReports).toBe(1);
    });
  });
});

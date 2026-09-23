import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { JobStatus, Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { api, TestContext, TEST_PREFIX, uid, type TestUser } from "./helpers/fixtures";

/**
 * İş kuralı: saha raporu ürünün kayıtlı stoğundan fazlasını düşemez (önceden
 * çıkış koşulsuzdu, "-6 Litre" gibi imkânsız stoklar oluşuyordu).
 */
describe("Saha raporu — stok negatife düşemez", () => {
  const ctx = new TestContext();
  let staff: TestUser;
  let staffToken: string;
  let productId: string;
  let customerId: string;

  beforeAll(async () => {
    staff = await ctx.createStaffUser(Role.STAFF);
    staffToken = await ctx.tokenFor(staff);
    customerId = (await ctx.createCustomer()).id;
    const product = await prisma.product.create({
      data: { name: `${TEST_PREFIX}Az Stok ${uid()}`, unit: "L", currentStock: 3, criticalThreshold: 0 },
    });
    productId = product.id;
  });

  afterAll(async () => {
    await ctx.cleanup();
    await prisma.stockMovement.deleteMany({ where: { productId } });
    await prisma.product.deleteMany({ where: { id: productId } });
  });

  async function report(quantity: number) {
    const job = await ctx.createJob({ customerId, assignedStaffId: staff.staffId!, status: JobStatus.IN_PROGRESS });
    return api()
      .post(`/jobs/${job.id}/report`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ dosage: `${quantity} L`, products: [{ productId, quantity }] });
  }

  it("kayıtlı stoktan fazla çıkış 400 döner; stok, rapor ve hareket oluşmaz", async () => {
    const res = await report(5);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Stokta yeterli/);
    const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
    expect(Number(product.currentStock)).toBe(3);
    expect(await prisma.stockMovement.count({ where: { productId } })).toBe(0);
  });

  it("stoğun tamamı kullanılabilir (3/3 → 0), sonrası reddedilir", async () => {
    expect((await report(3)).status).toBe(201);
    const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
    expect(Number(product.currentStock)).toBe(0);
    expect((await report(0.5)).status).toBe(400);
  });
});

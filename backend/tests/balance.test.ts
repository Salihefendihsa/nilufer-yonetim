import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { JobStatus, PrismaClient, Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { billedTotal } from "../src/lib/balance";
import { backfillJobsForUncoveredPayments } from "../prisma/demoConsistency";
import { api, TestContext } from "./helpers/fixtures";

/**
 * HEALTH_AUDIT V-3: bakiye = borca yazılan işler (İPTAL HARİÇ) − ödemeler;
 * liste ve detay aynı rakamı verir. Demo tutarlılık adımı karşılanmayan
 * ödemeyi geçmiş işle karşılar, bakiye negatife düşmez ve adım idempotenttir.
 */
describe("Müşteri bakiyesi", () => {
  const ctx = new TestContext();
  let ownerToken: string;
  let customerId: string;
  const DAY = 24 * 3600 * 1000;

  beforeAll(async () => {
    const owner = await ctx.createUser(Role.OWNER);
    ownerToken = await ctx.tokenFor(owner);
    const cu = await ctx.createUser(Role.CUSTOMER);
    customerId = (await ctx.createCustomer({ userId: cu.id, fullName: "vt_Bakiye Müşterisi" })).id;
    await ctx.createJob({ customerId, status: JobStatus.COMPLETED, price: 1000, completedAt: new Date(Date.now() - 10 * DAY) });
    await ctx.createJob({ customerId, status: JobStatus.CANCELLED, price: 500 });
    await prisma.payment.create({ data: { customerId, amount: 800, paymentType: "CASH", createdAt: new Date(Date.now() - 5 * DAY) } });
  });

  afterAll(() => ctx.cleanup());

  it("iptal edilen iş borca yazılmaz; liste ve detay aynı bakiyeyi verir", async () => {
    const detail = await api().get(`/customers/${customerId}`).set("Authorization", `Bearer ${ownerToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.outstandingBalance).toBe(200);

    const list = await api().get(`/customers?search=vt_Bakiye&limit=100`).set("Authorization", `Bearer ${ownerToken}`);
    const row = list.body.data.find((c: { id: string }) => c.id === customerId);
    expect(row.outstandingBalance).toBe(200);
  });

  it("billedTotal iptalleri hariç tutar", () => {
    expect(
      billedTotal([
        { price: 1000, status: JobStatus.COMPLETED },
        { price: 500, status: JobStatus.CANCELLED },
        { price: null, status: JobStatus.PENDING },
        { price: 250, status: JobStatus.SCHEDULED },
      ])
    ).toBe(1250);
  });

  it("karşılanmayan ödeme geçmiş işle karşılanır, bakiye ≥ 0, ikinci çalıştırma boş", async () => {
    // 1000 ₺ işin 800 ₺si ödenmişti; 1500 ₺ daha ödeme → 200 ₺ işi kapatır, 1300 ₺ karşılanmamış kalır.
    await prisma.payment.create({ data: { customerId, amount: 1500, paymentType: "TRANSFER", createdAt: new Date(Date.now() - 2 * DAY) } });
    const before = await api().get(`/customers/${customerId}`).set("Authorization", `Bearer ${ownerToken}`);
    expect(before.body.outstandingBalance).toBe(-1300);

    const r = await backfillJobsForUncoveredPayments(prisma as unknown as PrismaClient, { apply: true, customerIds: [customerId] });
    expect(r.jobsCreated).toBe(1);
    expect(r.amountBackfilled).toBe(1300);

    const after = await api().get(`/customers/${customerId}`).set("Authorization", `Bearer ${ownerToken}`);
    expect(after.body.outstandingBalance).toBe(0);

    const again = await backfillJobsForUncoveredPayments(prisma as unknown as PrismaClient, { apply: false, customerIds: [customerId] });
    expect(again.jobsCreated).toBe(0);
  });
});

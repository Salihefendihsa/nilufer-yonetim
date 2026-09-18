import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { computeRevenueTrend, computeYearOverYear } from "../src/controllers/analyticsController";
import { api, TestContext, type TestUser } from "./helpers/fixtures";

/**
 * Bölüm AA (6. tur): Yıldan yıla karşılaştırma.
 * İki yılın ödemeleri karışmadan ayrıştırılır; geçen yılda veri yoksa 0 ve
 * changePercent null (uydurma yok). Gerçek dev ödemeleriyle çakışmamak için
 * ölçüm, test ödemeleri eklenmeden ÖNCEKİ değerlere göre DELTA olarak yapılır;
 * ödemeler ID ile silinir.
 */
describe("Yıldan yıla ciro (/analytics/year-over-year)", () => {
  const ctx = new TestContext();
  let owner: TestUser;
  let staff: TestUser;
  let customerId: string;
  const paymentIds: string[] = [];
  const tokens: Record<string, string> = {};

  // Pencere: bu ay dahil son 3 ay; test ödemeleri pencerenin ORTA ayına.
  const now = new Date();
  const mid = new Date(now.getFullYear(), now.getMonth() - 1, 15, 12);
  const midLastYear = new Date(now.getFullYear() - 1, now.getMonth() - 1, 15, 12);

  let baseline: { thisYear: number; lastYear: number }[];

  beforeAll(async () => {
    owner = await ctx.createUser(Role.OWNER);
    staff = await ctx.createStaffUser(Role.STAFF);
    customerId = (await ctx.createCustomer()).id;
    tokens.owner = await ctx.tokenFor(owner);
    tokens.staff = await ctx.tokenFor(staff);

    baseline = (await computeYearOverYear(3)).map((r) => ({ thisYear: r.thisYear, lastYear: r.lastYear }));

    for (const [amount, at] of [
      [1000, mid],
      [250, mid],
      [400, midLastYear],
    ] as const) {
      const p = await prisma.payment.create({ data: { customerId, amount, createdAt: at, paymentType: "vt_test" } });
      paymentIds.push(p.id);
    }
  });

  afterAll(async () => {
    await prisma.payment.deleteMany({ where: { id: { in: paymentIds } } });
    await ctx.cleanup();
  });

  it("orta ay: bu yıl +1250, geçen yıl +400; diğer aylar değişmez; etiketler farklı yılları taşır", async () => {
    const res = await api().get("/analytics/year-over-year?months=3").set("Authorization", `Bearer ${tokens.owner}`);
    expect(res.status).toBe(200);
    const data = res.body.data as { month: string; thisYear: number; lastYear: number; thisYearLabel: string; lastYearLabel: string; changePercent: number | null }[];
    expect(data).toHaveLength(3);

    expect(data[1].thisYear - baseline[1].thisYear).toBeCloseTo(1250, 2);
    expect(data[1].lastYear - baseline[1].lastYear).toBeCloseTo(400, 2);
    expect(data[0].thisYear - baseline[0].thisYear).toBeCloseTo(0, 2);
    expect(data[2].lastYear - baseline[2].lastYear).toBeCloseTo(0, 2);

    expect(data[1].thisYearLabel).toContain(String(mid.getFullYear()));
    expect(data[1].lastYearLabel).toContain(String(midLastYear.getFullYear()));
    expect(data[1].month).toBe(data[1].thisYearLabel.split(" ")[0]);
    // Geçen yıl > 0 ise oran sayı; aksi null.
    expect(data[1].changePercent === null || typeof data[1].changePercent === "number").toBe(true);
  });

  it("anchor'lı computeRevenueTrend penceresi kapalıdır: pencere dışı ödeme sayılmaz; RBAC", async () => {
    // Geçen yılın penceresi bu yılın ödemelerini içermemeli.
    const lastYearWindow = await computeRevenueTrend(3, new Date(now.getFullYear() - 1, now.getMonth(), 1));
    const lastYearMid = lastYearWindow[1].total;
    const thisYearWindow = await computeRevenueTrend(3);
    expect(thisYearWindow[1].total - baseline[1].thisYear).toBeCloseTo(1250, 2);
    expect(lastYearMid - baseline[1].lastYear).toBeCloseTo(400, 2);

    const forbidden = await api().get("/analytics/year-over-year").set("Authorization", `Bearer ${tokens.staff}`);
    expect(forbidden.status).toBe(403);
  });

  it("geçen yılda hiç ödeme olmayan uzak bir pencere: lastYear 0 ve changePercent null (uydurma yok)", async () => {
    // 30 yıl öncesine demirlenmiş pencere — hiçbir kayıt yok.
    const far = await computeYearOverYear(2, new Date(now.getFullYear() - 30, 5, 1));
    for (const row of far) {
      expect(row.thisYear).toBe(0);
      expect(row.lastYear).toBe(0);
      expect(row.changePercent).toBeNull();
    }
  });
});

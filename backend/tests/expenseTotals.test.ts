import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ExpenseCategory, Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { api, TestContext, type TestUser } from "./helpers/fixtures";

/**
 * GET /expenses `totals`: kartlar sayfalanmış listeden değil, filtreye uyan
 * tüm kayıtların sunucu toplamından beslenir (önceden 20+ giderde eksik
 * gösteriliyordu).
 */
describe("Gider listesi toplamları", () => {
  const ctx = new TestContext();
  let owner: TestUser;
  let token: string;
  // Gerçek dev verisiyle karışmasın diye geçmiş, tekil bir ay kullanılır.
  const month = "2011-02";

  beforeAll(async () => {
    owner = await ctx.createUser(Role.OWNER);
    token = await ctx.tokenFor(owner);
    for (let i = 0; i < 23; i++) {
      const e = await prisma.expense.create({
        data: {
          category: i % 2 === 0 ? ExpenseCategory.FUEL : ExpenseCategory.RENT,
          amount: 100,
          date: new Date(2011, 1, 1 + (i % 27)),
          recordedByUserId: owner.id,
        },
      });
      ctx.track("expense", e.id);
    }
  });

  afterAll(() => ctx.cleanup());

  it("totals sayfa boyutundan bağımsız olarak tüm eşleşen kayıtları toplar", async () => {
    const res = await api().get("/expenses").query({ month, limit: 20 }).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(20);
    expect(res.body.totals.amount).toBe(2300);
    expect(res.body.totals.byCategory).toEqual({ FUEL: 1200, RENT: 1100 });
  });

  it("kategori filtresi toplamlara da uygulanır", async () => {
    const res = await api()
      .get("/expenses")
      .query({ month, category: "RENT" })
      .set("Authorization", `Bearer ${token}`);
    expect(res.body.totals).toEqual({ amount: 1100, byCategory: { RENT: 1100 } });
  });
});

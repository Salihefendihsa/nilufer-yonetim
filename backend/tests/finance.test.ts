import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ExpenseCategory, Role, StaffBonusStatus } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { computePaymentsSummary } from "../src/controllers/paymentsController";
import { api, TestContext, type TestUser } from "./helpers/fixtures";

/**
 * Finansal doğruluk:
 * - Net kâr = bu ay tahsilat − AKTİF personel maaş tabanı − bu ay gider.
 *   Arşivlenmiş personelin maaşı hesaba GİRMEZ (bugün bulunan bug'ın regresyonu).
 * - Prim onayı → Expense(BONUS) kaydı; net kâra yansır.
 * - /payments/summary ve /analytics/executive-summary aynı değeri döner.
 */
describe("Finansal doğruluk", () => {
  const ctx = new TestContext();
  let owner: TestUser;
  let ownerToken: string;

  beforeAll(async () => {
    owner = await ctx.createUser(Role.OWNER);
    ownerToken = await ctx.tokenFor(owner);
  });

  afterAll(() => ctx.cleanup());

  async function netProfit(): Promise<number> {
    const s = await computePaymentsSummary(true);
    return s.netProfitThisMonth as number;
  }

  it("aktif personel maaşı net kârı düşürür; arşivlenince (terfi) geri çıkar", async () => {
    const before = await netProfit();

    const staff = await ctx.createStaffUser(Role.STAFF, { salaryBase: 7777 });
    expect(await netProfit()).toBeCloseTo(before - 7777, 2);

    const promote = await api()
      .post(`/staff/${staff.staffId}/promote-to-manager`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ reason: "vt" });
    expect(promote.status).toBe(200);

    // Arşivlenen (archivedAt != null) personelin maaşı artık yük değil.
    expect(await netProfit()).toBeCloseTo(before, 2);
  });

  it("işten çıkarılan personelin maaşı da hariç tutulur", async () => {
    const before = await netProfit();
    const staff = await ctx.createStaffUser(Role.STAFF, { salaryBase: 5555, tag: "term" });
    expect(await netProfit()).toBeCloseTo(before - 5555, 2);
    await api().post(`/users/${staff.id}/terminate`).set("Authorization", `Bearer ${ownerToken}`).send({ reason: "vt" });
    expect(await netProfit()).toBeCloseTo(before, 2);
  });

  it("bu ayki gider net kârdan düşer, bu ayki tahsilat ekler", async () => {
    const before = await computePaymentsSummary(true);
    const expense = await prisma.expense.create({
      data: { category: ExpenseCategory.OTHER, amount: 1200, description: "vt_gider", date: new Date(), recordedByUserId: owner.id },
    });
    ctx.track("expense", expense.id);
    const customer = await ctx.createCustomer();
    const payment = await prisma.payment.create({ data: { customerId: customer.id, amount: 3000, paymentType: "vt_nakit" } });
    ctx.track("payment", payment.id);

    const after = await computePaymentsSummary(true);
    expect(after.totalExpensesThisMonth as number).toBeCloseTo((before.totalExpensesThisMonth as number) + 1200, 2);
    expect(after.thisMonthTotal as number).toBeCloseTo((before.thisMonthTotal as number) + 3000, 2);
    expect(after.netProfitThisMonth as number).toBeCloseTo((before.netProfitThisMonth as number) + 3000 - 1200, 2);
  });

  it("view_finance izni olmayan MANAGER net kâr alanlarını görmez; OWNER görür", async () => {
    const manager = await ctx.createUser(Role.MANAGER);
    const mgr = await api().get("/payments/summary").set("Authorization", `Bearer ${await ctx.tokenFor(manager)}`);
    expect(mgr.status).toBe(200);
    expect(mgr.body.netProfitThisMonth).toBeUndefined();

    const own = await api().get("/payments/summary").set("Authorization", `Bearer ${ownerToken}`);
    expect(own.status).toBe(200);
    expect(own.body.netProfitThisMonth).toBeTypeOf("number");
    // Decimal serileşmesi: sayı olarak döner, string değil.
    expect(typeof own.body.thisMonthTotal).toBe("number");
  });

  it("/analytics/executive-summary net kâr kartı /payments/summary ile aynı değeri taşır", async () => {
    const [summary, exec] = await Promise.all([
      api().get("/payments/summary").set("Authorization", `Bearer ${ownerToken}`),
      api().get("/analytics/executive-summary").set("Authorization", `Bearer ${ownerToken}`),
    ]);
    const card = exec.body.sections.finance.find((k: { key: string }) => k.key === "netProfitThisMonth");
    expect(card.value).toBeCloseTo(summary.body.netProfitThisMonth, 2);
    const outstanding = exec.body.sections.finance.find((k: { key: string }) => k.key === "outstandingBalance");
    expect(outstanding.value).toBeCloseTo(summary.body.totalOutstandingBalance, 2);
  });

  describe("prim onayı → Expense", () => {
    it("onay bonus'u APPROVED yapar ve aynı tutarda BONUS gideri oluşturur; ikinci onay 409", async () => {
      const staff = await ctx.createStaffUser(Role.STAFF, { tag: "bonus" });
      const period = await prisma.evaluationPeriod.create({
        data: { label: "vt_donem", startDate: new Date(), endDate: new Date(), bonusThreshold: 10, bonusAmount: 900 },
      });
      ctx.track("evaluationPeriod", period.id);
      const criterion = await prisma.evaluationCriterion.create({ data: { name: "vt_kriter" } });
      ctx.track("evaluationCriterion", criterion.id);
      const evaluation = await prisma.evaluation.create({
        data: {
          evaluatorUserId: owner.id,
          targetStaffId: staff.staffId!,
          periodId: period.id,
          status: "LOCKED",
          scores: { create: [{ criterionId: criterion.id, score: 18 }] },
        },
      });
      const bonus = await prisma.staffBonus.create({
        data: { staffId: staff.staffId!, evaluationPeriodId: period.id, evaluationId: evaluation.id, amount: 900 },
      });

      const before = await computePaymentsSummary(true);
      const expensesBefore = await prisma.expense.count({ where: { category: ExpenseCategory.BONUS, recordedByUserId: owner.id } });

      const res = await api().post(`/staff-bonuses/${bonus.id}/approve`).set("Authorization", `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status ?? res.body.bonus?.status).toBe(StaffBonusStatus.APPROVED);

      const expenses = await prisma.expense.findMany({ where: { category: ExpenseCategory.BONUS, recordedByUserId: owner.id } });
      expect(expenses).toHaveLength(expensesBefore + 1);
      expect(Number(expenses[expenses.length - 1].amount)).toBe(900);

      const after = await computePaymentsSummary(true);
      expect(after.netProfitThisMonth as number).toBeCloseTo((before.netProfitThisMonth as number) - 900, 2);

      const again = await api().post(`/staff-bonuses/${bonus.id}/approve`).set("Authorization", `Bearer ${ownerToken}`);
      expect(again.status).toBe(409);
      // İkinci deneme ikinci bir gider ÜRETMEDİ.
      expect(await prisma.expense.count({ where: { category: ExpenseCategory.BONUS, recordedByUserId: owner.id } })).toBe(expensesBefore + 1);
    });
  });
});

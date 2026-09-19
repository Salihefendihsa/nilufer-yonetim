import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AdvanceStatus, Role, StaffBonusStatus } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { api, TestContext, type TestUser } from "./helpers/fixtures";

/**
 * Bölüm AN (9. tur): personel bordro özeti (salt görüntüleme).
 * - net = salaryBase + o ayda APPROVED prim − o ayda APPROVED avans
 * - başka ay → prim/avans o aya girmez; PENDING/REJECTED sayılmaz
 * - OWNER/MANAGER/CUSTOMER 403 (STAFF-only uç); başka personelin kaydına
 *   erişim yolu yok (uç yalnızca /me)
 * - month biçimi hatalı → 400
 */
describe("Personel bordro özeti", () => {
  const ctx = new TestContext();
  let owner: TestUser;
  let staff: TestUser;
  let other: TestUser;
  let staffToken: string;

  const year = 2026;
  const month = 3; // Mart — testin çalıştığı aydan bağımsız sabit ay
  const inMonth = new Date(year, month - 1, 15, 12);
  const prevMonth = new Date(year, month - 2, 15, 12);

  beforeAll(async () => {
    owner = await ctx.createUser(Role.OWNER);
    staff = await ctx.createStaffUser(Role.STAFF, { salaryBase: 20000 });
    other = await ctx.createStaffUser(Role.STAFF, { salaryBase: 99000 });
    staffToken = await ctx.tokenFor(staff);

    const period = await prisma.evaluationPeriod.create({
      data: { label: "vt_bordro_donem", startDate: prevMonth, endDate: inMonth },
    });
    ctx.track("evaluationPeriod", period.id);

    async function bonus(target: TestUser, amount: number, status: StaffBonusStatus, approvedAt: Date | null) {
      const evaluation = await prisma.evaluation.create({
        data: { evaluatorUserId: owner.id, targetStaffId: target.staffId!, periodId: period.id, status: "LOCKED" },
      });
      await prisma.staffBonus.create({
        data: { staffId: target.staffId!, evaluationPeriodId: period.id, evaluationId: evaluation.id, amount, status, approvedAt, approvedByUserId: approvedAt ? owner.id : null },
      });
    }
    // Aynı (evaluator, target, period) tekil — her prim için farklı evaluator gerekir; ikinci OWNER kullan.
    await bonus(staff, 1500, StaffBonusStatus.APPROVED, inMonth);
    const owner2 = await ctx.createUser(Role.OWNER, { tag: "owner2" });
    const evaluation2 = await prisma.evaluation.create({
      data: { evaluatorUserId: owner2.id, targetStaffId: staff.staffId!, periodId: period.id, status: "LOCKED" },
    });
    // Önceki ayda onaylanan prim — Mart bordrosuna GİRMEZ.
    await prisma.staffBonus.create({
      data: { staffId: staff.staffId!, evaluationPeriodId: period.id, evaluationId: evaluation2.id, amount: 700, status: StaffBonusStatus.APPROVED, approvedAt: prevMonth, approvedByUserId: owner.id },
    });
    // Bekleyen prim — sayılmaz.
    const owner3 = await ctx.createUser(Role.OWNER, { tag: "owner3" });
    const evaluation3 = await prisma.evaluation.create({
      data: { evaluatorUserId: owner3.id, targetStaffId: staff.staffId!, periodId: period.id, status: "LOCKED" },
    });
    await prisma.staffBonus.create({
      data: { staffId: staff.staffId!, evaluationPeriodId: period.id, evaluationId: evaluation3.id, amount: 5000, status: StaffBonusStatus.PENDING },
    });
    // Başka personelin primi — bu personele karışmaz.
    await bonus(other, 4000, StaffBonusStatus.APPROVED, inMonth);

    // Avanslar: Mart'ta APPROVED 3000 + REJECTED 800 (sayılmaz) + Şubat'ta APPROVED 999 (sayılmaz).
    await prisma.advanceRequest.createMany({
      data: [
        { staffId: staff.staffId!, amount: 3000, reason: "vt_avans", status: AdvanceStatus.APPROVED, createdAt: inMonth },
        { staffId: staff.staffId!, amount: 800, reason: "vt_red", status: AdvanceStatus.REJECTED, createdAt: inMonth },
        { staffId: staff.staffId!, amount: 999, reason: "vt_onceki", status: AdvanceStatus.APPROVED, createdAt: prevMonth },
      ],
    });
  });

  afterAll(() => ctx.cleanup());

  it("net = taban + o ay APPROVED prim − o ay APPROVED avans; diğer ay/durumlar dışlanır", async () => {
    const res = await api().get("/staff/me/payslip?month=2026-03").set("Authorization", `Bearer ${staffToken}`);
    expect(res.status).toBe(200);
    expect(res.body.staffId).toBe(staff.staffId);
    expect(res.body.month).toBe("2026-03");
    expect(res.body.salaryBase).toBe(20000);
    expect(res.body.bonusTotal).toBe(1500);
    expect(res.body.bonusCount).toBe(1);
    expect(res.body.advanceTotal).toBe(3000);
    expect(res.body.advanceCount).toBe(1);
    expect(res.body.net).toBe(20000 + 1500 - 3000);
    expect(res.body.bonuses[0].periodName).toBe("vt_bordro_donem");
    expect(res.body.advances[0].reason).toBe("vt_avans");
  });

  it("önceki ayın bordrosu kendi prim/avansını gösterir", async () => {
    const res = await api().get("/staff/me/payslip?month=2026-02").set("Authorization", `Bearer ${staffToken}`);
    expect(res.status).toBe(200);
    expect(res.body.bonusTotal).toBe(700);
    expect(res.body.advanceTotal).toBe(999);
    expect(res.body.net).toBe(20000 + 700 - 999);
  });

  it("month yoksa içinde bulunulan ay; hatalı biçim 400", async () => {
    const now = new Date();
    const res = await api().get("/staff/me/payslip").set("Authorization", `Bearer ${staffToken}`);
    expect(res.status).toBe(200);
    expect(res.body.month).toBe(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
    const bad = await api().get("/staff/me/payslip?month=2026-3").set("Authorization", `Bearer ${staffToken}`);
    expect(bad.status).toBe(400);
  });

  it("OWNER/MANAGER/CUSTOMER erişemez (STAFF-only); TEAM_LEAD kendi kaydını görür", async () => {
    const manager = await ctx.createUser(Role.MANAGER);
    const customer = await ctx.createUser(Role.CUSTOMER);
    const lead = await ctx.createStaffUser(Role.TEAM_LEAD, { salaryBase: 30000 });
    for (const u of [owner, manager, customer]) {
      const res = await api().get("/staff/me/payslip?month=2026-03").set("Authorization", `Bearer ${await ctx.tokenFor(u)}`);
      expect(res.status, u.role).toBe(403);
    }
    const leadRes = await api().get("/staff/me/payslip?month=2026-03").set("Authorization", `Bearer ${await ctx.tokenFor(lead)}`);
    expect(leadRes.status).toBe(200);
    expect(leadRes.body.staffId).toBe(lead.staffId);
    expect(leadRes.body.salaryBase).toBe(30000);
    // Başka personelin (other) primi bu yanıta karışmaz — uç yalnızca kendi kaydı.
    expect(leadRes.body.bonusTotal).toBe(0);
  });
});

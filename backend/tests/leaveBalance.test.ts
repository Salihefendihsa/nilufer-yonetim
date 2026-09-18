import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { leaveDaysInYear, computeLeaveBalance } from "../src/lib/leaveBalance";
import { api, TestContext, type TestUser } from "./helpers/fixtures";

/**
 * Bölüm AH (7. tur): Yıllık izin bakiyesi.
 * - leaveDaysInYear: uçlar dahil, yıl sınırında kırpma
 * - GET /staff/:id/leave-balance: takvim yılı; geçen yılın izni bu yılı etkilemez;
 *   STAFF kendi (200) / başkası (403); PATCH /staff/:id ile kota değişir
 * - decide: bakiyeyi aşan talep REDDEDİLMEZ, yalnızca exceedsBalance:true;
 *   listede bekleyen talepler bayrak taşır
 */
describe("Yıllık izin bakiyesi", () => {
  const ctx = new TestContext();
  let owner: TestUser;
  let member: TestUser;
  let other: TestUser;
  const tokens: Record<string, string> = {};
  // Gelecek yıl kullanılır: dev/test verisiyle çakışmasın ve "geçmiş tarih" kuralı takılmasın.
  const year = new Date().getFullYear() + 1;

  beforeAll(async () => {
    owner = await ctx.createUser(Role.OWNER);
    member = await ctx.createStaffUser(Role.STAFF, { tag: "m" });
    other = await ctx.createStaffUser(Role.STAFF, { tag: "o" });
    for (const [k, u] of Object.entries({ owner, member, other })) tokens[k] = await ctx.tokenFor(u);
  });

  afterAll(() => ctx.cleanup());
  const as = (k: string) => `Bearer ${tokens[k]}`;

  it("leaveDaysInYear: uçlar dahil; yıl sınırında kırpılır", () => {
    expect(leaveDaysInYear(new Date(year, 5, 1), new Date(year, 5, 5), year)).toBe(5);
    expect(leaveDaysInYear(new Date(year, 11, 30), new Date(year + 1, 0, 2), year)).toBe(2); // 30–31 Aralık
    expect(leaveDaysInYear(new Date(year, 11, 30), new Date(year + 1, 0, 2), year + 1)).toBe(2); // 1–2 Ocak
    expect(leaveDaysInYear(new Date(year - 1, 5, 1), new Date(year - 1, 5, 3), year)).toBe(0);
  });

  it("varsayılan kota 14; geçen yılın onaylı izni bu yılın bakiyesini etkilemez; STAFF kendi/başkası", async () => {
    // Geçen yıla ait 5 günlük onaylı izin — bakiyeye girmemeli.
    await prisma.leaveRequest.create({
      data: { staffId: member.staffId!, startDate: new Date(year - 1, 2, 1), endDate: new Date(year - 1, 2, 5), reason: "vt", status: "APPROVED" },
    });
    const res = await api().get(`/staff/${member.staffId}/leave-balance?year=${year}`).set("Authorization", as("owner"));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ year, quotaDays: 14, usedDays: 0, remainingDays: 14, approvedRequestCount: 0 });

    const lastYear = await api().get(`/staff/${member.staffId}/leave-balance?year=${year - 1}`).set("Authorization", as("owner"));
    expect(lastYear.body.usedDays).toBe(5);

    expect((await api().get(`/staff/${member.staffId}/leave-balance`).set("Authorization", as("member"))).status).toBe(200);
    expect((await api().get(`/staff/${member.staffId}/leave-balance`).set("Authorization", as("other"))).status).toBe(403);
  });

  it("PATCH /staff/:id kotayı değiştirir; onaylı izinler kullanılan günü artırır", async () => {
    const upd = await api().patch(`/staff/${member.staffId}`).set("Authorization", as("owner")).send({ annualLeaveQuotaDays: 10 });
    expect(upd.status).toBe(200);
    expect(upd.body.annualLeaveQuotaDays).toBe(10);

    const leave = await api()
      .post("/leave-requests")
      .set("Authorization", as("member"))
      .send({ startDate: new Date(year, 3, 1).toISOString(), endDate: new Date(year, 3, 7).toISOString(), reason: "vt tatil" }); // 7 gün
    expect(leave.status).toBe(201);
    const decided = await api().patch(`/leave-requests/${leave.body.id}/decide`).set("Authorization", as("owner")).send({ status: "APPROVED" });
    expect(decided.status).toBe(200);
    expect(decided.body.requestedDays).toBe(7);
    expect(decided.body.exceedsBalance).toBe(false);
    expect(decided.body.remainingDaysAfter).toBe(3);

    const balance = await computeLeaveBalance(member.staffId!, year);
    expect(balance).toMatchObject({ quotaDays: 10, usedDays: 7, remainingDays: 3 });
  });

  it("bakiyeyi aşan talep: listede exceedsBalance true, onay ENGELLENMEZ ve bayrakla döner", async () => {
    const leave = await api()
      .post("/leave-requests")
      .set("Authorization", as("member"))
      .send({ startDate: new Date(year, 6, 1).toISOString(), endDate: new Date(year, 6, 5).toISOString(), reason: "vt uzun" }); // 5 gün > 3 kalan
    expect(leave.status).toBe(201);

    const list = await api().get("/leave-requests?status=PENDING&limit=100").set("Authorization", as("owner"));
    const row = list.body.data.find((r: { id: string }) => r.id === leave.body.id);
    expect(row.requestedDays).toBe(5);
    expect(row.remainingDays).toBe(3);
    expect(row.exceedsBalance).toBe(true);

    const decided = await api().patch(`/leave-requests/${leave.body.id}/decide`).set("Authorization", as("owner")).send({ status: "APPROVED" });
    expect(decided.status).toBe(200); // reddedilmedi
    expect(decided.body.status).toBe("APPROVED");
    expect(decided.body.exceedsBalance).toBe(true);
    expect(decided.body.remainingDaysAfter).toBe(-2);

    const balance = await computeLeaveBalance(member.staffId!, year);
    expect(balance?.remainingDays).toBe(-2);
  });
});

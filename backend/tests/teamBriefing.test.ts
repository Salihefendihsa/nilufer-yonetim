import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Role, StaffStatus } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { api, TestContext, type TestUser } from "./helpers/fixtures";

/**
 * Bölüm M (4. tur): GET /team/daily-briefing — izinli, müsait olmayan, normal
 * ve mola/işte olan personelin brifingde doğru görünmesi; ekip dışı personel
 * yok; bugünkü iş sayıları /team/summary ile aynı hesaptan gelir.
 */
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

describe("Günlük ekip brifingi (/team/daily-briefing)", () => {
  const ctx = new TestContext();
  let lead: TestUser;
  let normal: TestUser;
  let onLeave: TestUser;
  let unavailable: TestUser;
  let onBreak: TestUser;
  let outsider: TestUser;
  let owner: TestUser;
  const tokens: Record<string, string> = {};

  beforeAll(async () => {
    lead = await ctx.createStaffUser(Role.TEAM_LEAD, { tag: "lead" });
    normal = await ctx.createStaffUser(Role.STAFF, { supervisorId: lead.staffId, tag: "normal" });
    onLeave = await ctx.createStaffUser(Role.STAFF, { supervisorId: lead.staffId, tag: "leave" });
    unavailable = await ctx.createStaffUser(Role.STAFF, { supervisorId: lead.staffId, tag: "unav" });
    onBreak = await ctx.createStaffUser(Role.STAFF, { supervisorId: lead.staffId, tag: "break" });
    outsider = await ctx.createStaffUser(Role.STAFF, { tag: "out" });
    owner = await ctx.createUser(Role.OWNER);

    const customer = await ctx.createCustomer();
    const now = new Date();
    await ctx.createJob({ customerId: customer.id, assignedStaffId: normal.staffId, status: "SCHEDULED", scheduledAt: now });
    await ctx.createJob({ customerId: customer.id, assignedStaffId: normal.staffId, status: "COMPLETED", scheduledAt: now, completedAt: now });
    await ctx.createJob({ customerId: customer.id, assignedStaffId: outsider.staffId, status: "SCHEDULED", scheduledAt: now });

    // Onaylı, bugünü kapsayan izin.
    const yesterday = new Date(now.getTime() - 24 * 3600 * 1000);
    const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);
    await prisma.leaveRequest.create({
      data: { staffId: onLeave.staffId!, startDate: yesterday, endDate: tomorrow, reason: "Yıllık izin", status: "APPROVED" },
    });
    await prisma.staff.update({ where: { id: onLeave.staffId }, data: { status: StaffStatus.ON_LEAVE, statusUntil: tomorrow } });

    // Bugün için saat aralığı işareti (Bölüm K).
    await prisma.staffUnavailability.create({
      data: { staffId: unavailable.staffId!, date: new Date(`${todayIso()}T00:00:00.000Z`), startTime: "13:00", endTime: "17:00", reason: "Doktor" },
    });

    await prisma.staff.update({ where: { id: onBreak.staffId }, data: { status: StaffStatus.ON_BREAK, statusUntil: tomorrow } });

    for (const [k, u] of Object.entries({ lead, normal, owner })) tokens[k] = await ctx.tokenFor(u);
  });

  afterAll(() => ctx.cleanup());

  it("her ekip üyesi doğru durumla görünür; ekip dışı yok; sayılar summary ile tutarlı", async () => {
    const res = await api().get("/team/daily-briefing").set("Authorization", `Bearer ${tokens.lead}`);
    expect(res.status).toBe(200);
    expect(res.body.date).toBe(todayIso());
    expect(res.body.teamSize).toBe(5);

    const byId = Object.fromEntries(res.body.members.map((m: { staffId: string }) => [m.staffId, m]));
    expect(byId[outsider.staffId!]).toBeUndefined();

    expect(byId[lead.staffId!].isSelf).toBe(true);
    expect(byId[normal.staffId!].isSelf).toBe(false);

    const n = byId[normal.staffId!];
    expect(n.todaysJobsCount).toBe(2);
    expect(n.onLeave).toBe(false);
    expect(n.unavailable).toBe(false);
    expect(n.status).toBe("AVAILABLE");

    const l = byId[onLeave.staffId!];
    expect(l.onLeave).toBe(true);
    expect(l.status).toBe("ON_LEAVE");
    expect(l.unavailableReason).toBe("Yıllık izin");

    const u = byId[unavailable.staffId!];
    expect(u.unavailable).toBe(true);
    expect(u.unavailableAllDay).toBe(false);
    expect(u.unavailableRanges).toEqual(["13:00–17:00"]);
    expect(u.unavailableReason).toBe("Doktor");
    expect(u.onLeave).toBe(false);

    expect(byId[onBreak.staffId!].status).toBe("ON_BREAK");

    expect(res.body.todaysJobsCount).toBe(2);
    expect(res.body.completedTodayCount).toBe(1);
    expect(res.body.onLeaveCount).toBe(1);
    expect(res.body.unavailableCount).toBe(1);
    // Müsait: izinli değil, tüm gün müsait-değil değil, AVAILABLE → lead + normal + unavailable(saat aralığı)
    expect(res.body.availableNowCount).toBe(3);

    const summary = await api().get("/team/summary").set("Authorization", `Bearer ${tokens.lead}`);
    expect(summary.body.todaysJobsCount).toBe(res.body.todaysJobsCount);
    expect(summary.body.completedTodayCount).toBe(res.body.completedTodayCount);
  });

  it("STAFF ve OWNER 403", async () => {
    for (const k of ["normal", "owner"]) {
      const res = await api().get("/team/daily-briefing").set("Authorization", `Bearer ${tokens[k]}`);
      expect(res.status, k).toBe(403);
    }
  });
});

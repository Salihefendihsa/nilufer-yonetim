import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Role, StaffStatus } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { api, TestContext, type TestUser } from "./helpers/fixtures";

/**
 * Bölüm Z (6. tur): GET /jobs/suggest-staff — iş yüküne göre artan sıralama,
 * müsait olmayanlar (tüm gün / saat aralığı / izinli) sona ve rozetli, ilk
 * müsait "Önerilen"; TEAM_LEAD yalnızca ekibi; iptal işler sayılmaz.
 * Test verisi bugünden 5 gün sonrası (gerçek işlerle çakışma olmasın diye
 * yalnızca test personeli filtrelenir — liste tüm aktif personeli döner,
 * assertion'lar test kayıtlarına daraltılır).
 */
function isoDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

describe("Personel atama önerisi", () => {
  const ctx = new TestContext();
  let owner: TestUser;
  let lead: TestUser;
  let light: TestUser; // 0 iş
  let busy: TestUser; // 2 iş
  let partial: TestUser; // 13:00–17:00 müsait değil, 0 iş
  let allDay: TestUser; // tüm gün müsait değil
  let onLeave: TestUser; // ON_LEAVE
  let outsider: TestUser; // lead'in ekibinde değil
  const tokens: Record<string, string> = {};
  const day = isoDate(5);

  beforeAll(async () => {
    owner = await ctx.createUser(Role.OWNER);
    lead = await ctx.createStaffUser(Role.TEAM_LEAD, { tag: "lead" });
    light = await ctx.createStaffUser(Role.STAFF, { supervisorId: lead.staffId, tag: "light" });
    busy = await ctx.createStaffUser(Role.STAFF, { supervisorId: lead.staffId, tag: "busy" });
    partial = await ctx.createStaffUser(Role.STAFF, { supervisorId: lead.staffId, tag: "partial" });
    allDay = await ctx.createStaffUser(Role.STAFF, { supervisorId: lead.staffId, tag: "allday" });
    onLeave = await ctx.createStaffUser(Role.STAFF, { supervisorId: lead.staffId, tag: "leave" });
    outsider = await ctx.createStaffUser(Role.STAFF, { tag: "outsider" });

    const customer = await ctx.createCustomer();
    const [y, m, d] = day.split("-").map(Number);
    const at = (h: number) => new Date(y, m - 1, d, h, 0, 0);
    await ctx.createJob({ customerId: customer.id, assignedStaffId: busy.staffId, status: "SCHEDULED", scheduledAt: at(9) });
    await ctx.createJob({ customerId: customer.id, assignedStaffId: busy.staffId, status: "SCHEDULED", scheduledAt: at(11) });
    await ctx.createJob({ customerId: customer.id, assignedStaffId: busy.staffId, status: "CANCELLED", scheduledAt: at(15) }); // sayılmaz
    await ctx.createJob({ customerId: customer.id, assignedStaffId: light.staffId, status: "SCHEDULED", scheduledAt: new Date(y, m - 1, d + 1, 9) }); // başka gün

    await prisma.staffUnavailability.createMany({
      data: [
        { staffId: partial.staffId!, date: new Date(`${day}T00:00:00.000Z`), startTime: "13:00", endTime: "17:00", reason: "Doktor" },
        { staffId: allDay.staffId!, date: new Date(`${day}T00:00:00.000Z`) },
      ],
    });
    await prisma.staff.update({ where: { id: onLeave.staffId }, data: { status: StaffStatus.ON_LEAVE } });

    tokens.owner = await ctx.tokenFor(owner);
    tokens.lead = await ctx.tokenFor(lead);
    tokens.light = await ctx.tokenFor(light);
  });

  afterAll(() => ctx.cleanup());

  const mine = (rows: { staffId: string }[]) => {
    const ids = new Set([lead, light, busy, partial, allDay, onLeave, outsider].map((u) => u.staffId));
    return rows.filter((r) => ids.has(r.staffId));
  };

  it("date zorunlu (400); saat verilmeden: müsaitler iş yüküne göre artan, tüm gün/izinli sona, ilk müsait Önerilen", async () => {
    const bad = await api().get("/jobs/suggest-staff").set("Authorization", `Bearer ${tokens.owner}`);
    expect(bad.status).toBe(400);

    const res = await api().get(`/jobs/suggest-staff?date=${day}`).set("Authorization", `Bearer ${tokens.owner}`);
    expect(res.status).toBe(200);
    const rows = mine(res.body.data);
    const byId = Object.fromEntries(rows.map((r) => [r.staffId, r]));

    expect(byId[busy.staffId!].todayJobCount).toBe(2); // iptal sayılmadı
    expect(byId[light.staffId!].todayJobCount).toBe(0); // başka gün sayılmadı
    expect(byId[allDay.staffId!].isUnavailable).toBe(true);
    expect(byId[onLeave.staffId!].isUnavailable).toBe(true);
    expect(byId[onLeave.staffId!].unavailableReason).toBe("İzinli");
    // Saat verilmediğinde kısmi aralık listeden düşürmez ama uyarı metni taşır.
    expect(byId[partial.staffId!].isUnavailable).toBe(false);
    expect(byId[partial.staffId!].unavailableReason).toContain("13:00–17:00");

    const available = rows.filter((r) => !r.isUnavailable);
    const unavailable = rows.filter((r) => r.isUnavailable);
    // Müsaitler tamamı müsait olmayanlardan önce gelir.
    const lastAvailableIdx = Math.max(...available.map((r) => rows.indexOf(r)));
    const firstUnavailableIdx = Math.min(...unavailable.map((r) => rows.indexOf(r)));
    expect(lastAvailableIdx).toBeLessThan(firstUnavailableIdx);
    // İş yükü artan.
    for (let i = 1; i < available.length; i++) expect(available[i].todayJobCount).toBeGreaterThanOrEqual(available[i - 1].todayJobCount);
    expect(byId[busy.staffId!].todayJobCount).toBeGreaterThan(byId[light.staffId!].todayJobCount);
    expect(rows.indexOf(byId[light.staffId!])).toBeLessThan(rows.indexOf(byId[busy.staffId!]));

    // Önerilen: tüm listede tam olarak 1 ve müsait.
    const recommended = res.body.data.filter((r: { isRecommended: boolean }) => r.isRecommended);
    expect(recommended).toHaveLength(1);
    expect(recommended[0].isUnavailable).toBe(false);
  });

  it("saat verilince kısmi aralıkta olan müsait değil sayılır; aralık dışında müsait", async () => {
    const inside = await api().get(`/jobs/suggest-staff?date=${day}&time=14:00`).set("Authorization", `Bearer ${tokens.owner}`);
    const p1 = inside.body.data.find((r: { staffId: string }) => r.staffId === partial.staffId);
    expect(p1.isUnavailable).toBe(true);
    expect(p1.unavailableReason).toBe("Doktor");

    const outside = await api().get(`/jobs/suggest-staff?date=${day}&time=09:00`).set("Authorization", `Bearer ${tokens.owner}`);
    const p2 = outside.body.data.find((r: { staffId: string }) => r.staffId === partial.staffId);
    expect(p2.isUnavailable).toBe(false);
  });

  it("TEAM_LEAD yalnızca ekibini görür (dış personel yok); STAFF 403", async () => {
    const res = await api().get(`/jobs/suggest-staff?date=${day}`).set("Authorization", `Bearer ${tokens.lead}`);
    expect(res.status).toBe(200);
    const ids = res.body.data.map((r: { staffId: string }) => r.staffId);
    expect(ids).toContain(light.staffId);
    expect(ids).toContain(lead.staffId);
    expect(ids).not.toContain(outsider.staffId);

    const forbidden = await api().get(`/jobs/suggest-staff?date=${day}`).set("Authorization", `Bearer ${tokens.light}`);
    expect(forbidden.status).toBe(403);
  });
});

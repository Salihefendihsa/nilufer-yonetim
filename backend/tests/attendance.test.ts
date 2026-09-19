import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { api, TestContext, type TestUser } from "./helpers/fixtures";

/**
 * Bölüm AR (9. tur): puantaj.
 * - çıkış yapmadan clock-out → 400
 * - clock-in → 201; aynı gün ikinci clock-in → 409 (kayıt korunur, giriş saati değişmez)
 * - clock-out → 200 + workedHours; ikinci clock-out → 409; çıkıştan sonra clock-in → 409
 * - aylık toplam: yalnızca tamamlanmış günler toplanır, açık kayıt openCount'ta
 * - STAFF başkasının puantajını göremez (403); OWNER görür; hatalı month 400
 */
describe("Personel puantajı", () => {
  const ctx = new TestContext();
  let owner: TestUser;
  let staff: TestUser;
  let other: TestUser;
  let staffToken: string;
  let ownerToken: string;

  beforeAll(async () => {
    owner = await ctx.createUser(Role.OWNER);
    staff = await ctx.createStaffUser(Role.STAFF);
    other = await ctx.createStaffUser(Role.STAFF, { tag: "other" });
    staffToken = await ctx.tokenFor(staff);
    ownerToken = await ctx.tokenFor(owner);
  });

  afterAll(() => ctx.cleanup());

  it("giriş yapmadan çıkış → 400; bugün kayıt yok", async () => {
    const today = await api().get("/staff/me/attendance/today").set("Authorization", `Bearer ${staffToken}`);
    expect(today.status).toBe(200);
    expect(today.body.record).toBeNull();
    const out = await api().post("/staff/me/clock-out").set("Authorization", `Bearer ${staffToken}`).send({});
    expect(out.status).toBe(400);
  });

  it("clock-in 201; aynı gün ikinci giriş 409 ve ilk giriş saati korunur", async () => {
    const first = await api().post("/staff/me/clock-in").set("Authorization", `Bearer ${staffToken}`).send({ note: "vt_sabah" });
    expect(first.status).toBe(201);
    expect(first.body.clockInAt).toBeTruthy();
    expect(first.body.clockOutAt).toBeNull();
    expect(first.body.workedHours).toBeNull();

    const second = await api().post("/staff/me/clock-in").set("Authorization", `Bearer ${staffToken}`).send({});
    expect(second.status).toBe(409);
    expect(second.body.record.clockInAt).toBe(first.body.clockInAt);

    const today = await api().get("/staff/me/attendance/today").set("Authorization", `Bearer ${staffToken}`);
    expect(today.body.record.id).toBe(first.body.id);
    const count = await prisma.attendanceRecord.count({ where: { staffId: staff.staffId! } });
    expect(count).toBe(1);
  });

  it("clock-out 200 + workedHours; tekrar çıkış 409; çıkış sonrası giriş 409", async () => {
    const out = await api().post("/staff/me/clock-out").set("Authorization", `Bearer ${staffToken}`).send({});
    expect(out.status).toBe(200);
    expect(out.body.clockOutAt).toBeTruthy();
    expect(typeof out.body.workedHours).toBe("number");
    expect(out.body.workedHours).toBeGreaterThanOrEqual(0);

    const again = await api().post("/staff/me/clock-out").set("Authorization", `Bearer ${staffToken}`).send({});
    expect(again.status).toBe(409);
    const reIn = await api().post("/staff/me/clock-in").set("Authorization", `Bearer ${staffToken}`).send({});
    expect(reIn.status).toBe(409);
    expect(reIn.body.error).toContain("giriş ve çıkış");
  });

  it("aylık toplam: tamamlanmış günler toplanır, açık kayıt sayılmaz; başka ay dışlanır", async () => {
    // Sabit bir ay: Mart 2026 — 2 tam gün (8s + 6.5s) + 1 açık gün; Şubat'ta 1 tam gün (sayılmamalı)
    const mk = (d: number, inH: number, outH: number | null, month = 2) => ({
      staffId: staff.staffId!,
      date: new Date(Date.UTC(2026, month, d)),
      clockInAt: new Date(2026, month, d, inH, 0),
      clockOutAt: outH === null ? null : new Date(2026, month, d, Math.floor(outH), Math.round((outH % 1) * 60)),
    });
    await prisma.attendanceRecord.createMany({
      data: [mk(2, 9, 17), mk(3, 9, 15.5), mk(4, 9, null), mk(10, 9, 18, 1)],
    });

    const res = await api().get(`/staff/${staff.staffId}/attendance?month=2026-03`).set("Authorization", `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.month).toBe("2026-03");
    expect(res.body.data).toHaveLength(3);
    expect(res.body.totalHours).toBe(14.5);
    expect(res.body.completedDays).toBe(2);
    expect(res.body.openCount).toBe(1);

    const feb = await api().get(`/staff/${staff.staffId}/attendance?month=2026-02`).set("Authorization", `Bearer ${ownerToken}`);
    expect(feb.body.totalHours).toBe(9);
    expect(feb.body.data).toHaveLength(1);

    const bad = await api().get(`/staff/${staff.staffId}/attendance?month=2026-3`).set("Authorization", `Bearer ${ownerToken}`);
    expect(bad.status).toBe(400);
  });

  it("STAFF kendi aylık puantajını görür, başkasınınkini 403", async () => {
    const own = await api().get(`/staff/${staff.staffId}/attendance?month=2026-03`).set("Authorization", `Bearer ${staffToken}`);
    expect(own.status).toBe(200);
    expect(own.body.totalHours).toBe(14.5);
    const cross = await api().get(`/staff/${other.staffId}/attendance?month=2026-03`).set("Authorization", `Bearer ${staffToken}`);
    expect(cross.status).toBe(403);
  });
});

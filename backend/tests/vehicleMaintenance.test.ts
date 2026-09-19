import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { sweepVehicleMaintenanceAlerts } from "../src/lib/reminders";
import { api, localIsoDate, TestContext, type TestUser } from "./helpers/fixtures";

/**
 * Bölüm AQ (9. tur): araç bakım takibi.
 * - CRUD (OWNER); nextDueDate < lastServiceDate → 400; başka personelin kaydı → 404
 * - STAFF kendi kaydını salt-okunur görür, başkasınınkini 403, yazamaz (RBAC'de)
 * - liste yanıtı vehiclePlate + daysLeft/isOverdue taşır
 * - sweep: 14 gün penceresi, aynı gün dedup, vade ileri alınınca yeniden bildirim;
 *   yalnızca kapsamlı (onlyStaffIds) çağrılır
 */
const isoDaysFromNow = (days: number) => localIsoDate(days);

describe("Araç bakım takibi", () => {
  const ctx = new TestContext();
  let owner: TestUser;
  let staff: TestUser;
  let other: TestUser;
  let ownerToken: string;
  let staffToken: string;
  let rowId: string;

  beforeAll(async () => {
    owner = await ctx.createUser(Role.OWNER);
    staff = await ctx.createStaffUser(Role.STAFF);
    other = await ctx.createStaffUser(Role.STAFF, { tag: "other" });
    await prisma.staff.update({ where: { id: staff.staffId! }, data: { vehiclePlate: "16 VT 001" } });
    ownerToken = await ctx.tokenFor(owner);
    staffToken = await ctx.tokenFor(staff);
  });

  afterAll(() => ctx.cleanup());

  it("OWNER kayıt açar; tarih sırası hatalıysa 400; liste plaka + daysLeft döner", async () => {
    const bad = await api()
      .post(`/staff/${staff.staffId}/vehicle-maintenance`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ maintenanceType: "INSPECTION", lastServiceDate: isoDaysFromNow(0), nextDueDate: isoDaysFromNow(-1) });
    expect(bad.status).toBe(400);

    const res = await api()
      .post(`/staff/${staff.staffId}/vehicle-maintenance`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ maintenanceType: "INSPECTION", lastServiceDate: isoDaysFromNow(-300), nextDueDate: isoDaysFromNow(10), note: "vt_TÜVTÜRK" });
    expect(res.status).toBe(201);
    expect(res.body.daysLeft).toBe(10);
    expect(res.body.isOverdue).toBe(false);
    rowId = res.body.id;

    const list = await api().get(`/staff/${staff.staffId}/vehicle-maintenance`).set("Authorization", `Bearer ${ownerToken}`);
    expect(list.status).toBe(200);
    expect(list.body.vehiclePlate).toBe("16 VT 001");
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].maintenanceType).toBe("INSPECTION");
  });

  it("STAFF kendi kaydını okur; başkasınınkini 403", async () => {
    const own = await api().get(`/staff/${staff.staffId}/vehicle-maintenance`).set("Authorization", `Bearer ${staffToken}`);
    expect(own.status).toBe(200);
    expect(own.body.data).toHaveLength(1);
    const cross = await api().get(`/staff/${other.staffId}/vehicle-maintenance`).set("Authorization", `Bearer ${staffToken}`);
    expect(cross.status).toBe(403);
  });

  it("PATCH/DELETE: başka personelin :id'siyle 404; güncelleme daysLeft'i yeniler", async () => {
    const wrong = await api()
      .patch(`/staff/${other.staffId}/vehicle-maintenance/${rowId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ note: "x" });
    expect(wrong.status).toBe(404);

    const upd = await api()
      .patch(`/staff/${staff.staffId}/vehicle-maintenance/${rowId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ nextDueDate: isoDaysFromNow(5), note: "vt_güncel" });
    expect(upd.status).toBe(200);
    expect(upd.body.daysLeft).toBe(5);
    expect(upd.body.note).toBe("vt_güncel");
  });

  it("sweep: 14 gün penceresi + aynı gün dedup; vade ileri alınınca yeniden bildirir; pencere dışı sessiz", async () => {
    // Pencere dışı (60 gün) — bildirim üretmemeli
    await prisma.vehicleMaintenance.create({
      data: { staffId: staff.staffId!, maintenanceType: "TIRE", lastServiceDate: new Date(), nextDueDate: new Date(isoDaysFromNow(60)) },
    });
    const before = await prisma.notification.count({ where: { userId: owner.id, type: "vehicle_maintenance" } });

    const first = await sweepVehicleMaintenanceAlerts([staff.staffId!]);
    expect(first).toBe(1); // yalnızca 5 gün kalan muayene
    const second = await sweepVehicleMaintenanceAlerts([staff.staffId!]);
    expect(second).toBe(0);
    const after = await prisma.notification.count({ where: { userId: owner.id, type: "vehicle_maintenance" } });
    expect(after - before).toBe(1);
    const note = await prisma.notification.findFirst({ where: { userId: owner.id, type: "vehicle_maintenance" }, orderBy: { createdAt: "desc" } });
    expect(note?.body).toContain("16 VT 001");

    // Vade ileri alındı ama hâlâ pencere içinde → lastDueAlertAt sıfırlanır → tekrar bildirir
    const upd = await api()
      .patch(`/staff/${staff.staffId}/vehicle-maintenance/${rowId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ nextDueDate: isoDaysFromNow(12) });
    expect(upd.status).toBe(200);
    expect(await sweepVehicleMaintenanceAlerts([staff.staffId!])).toBe(1);

    // Gecikmiş kayıt ayrı başlıkla
    await prisma.vehicleMaintenance.create({
      data: { staffId: staff.staffId!, maintenanceType: "OIL_CHANGE", lastServiceDate: new Date(isoDaysFromNow(-200)), nextDueDate: new Date(isoDaysFromNow(-3)) },
    });
    expect(await sweepVehicleMaintenanceAlerts([staff.staffId!])).toBe(1);
    const late = await prisma.notification.findFirst({ where: { userId: owner.id, type: "vehicle_maintenance" }, orderBy: { createdAt: "desc" } });
    expect(late?.title).toBe("Araç bakımı gecikti");
  });

  it("DELETE 204, sonra 404", async () => {
    const del = await api().delete(`/staff/${staff.staffId}/vehicle-maintenance/${rowId}`).set("Authorization", `Bearer ${ownerToken}`);
    expect(del.status).toBe(204);
    const again = await api().delete(`/staff/${staff.staffId}/vehicle-maintenance/${rowId}`).set("Authorization", `Bearer ${ownerToken}`);
    expect(again.status).toBe(404);
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { api, TestContext, type TestUser } from "./helpers/fixtures";

/**
 * Personel talepleri (CustomerComplaint'in tersi):
 * - STAFF/TEAM_LEAD/MANAGER kendi adına açar (OPEN, MEDIUM, OTHER varsayılan); OWNER'a bildirim
 * - personel listede yalnızca kendi taleplerini görür; başkasınınkine GET → 404
 * - OWNER tümünü görür, filtreler; yalnızca OWNER yanıtlar (MANAGER PATCH → 403)
 * - RESOLVED/REJECTED → resolvedAt + talep sahibine bildirim; yeniden açılınca sıfırlanır
 */
describe("Personel talepleri", () => {
  const ctx = new TestContext();
  let owner: TestUser;
  let manager: TestUser;
  let staff: TestUser;
  let lead: TestUser;
  let ownerToken: string;
  let managerToken: string;
  let staffToken: string;
  let leadToken: string;
  let requestId: string;

  beforeAll(async () => {
    owner = await ctx.createUser(Role.OWNER);
    manager = await ctx.createUser(Role.MANAGER);
    staff = await ctx.createStaffUser(Role.STAFF);
    lead = await ctx.createStaffUser(Role.TEAM_LEAD);
    ownerToken = await ctx.tokenFor(owner);
    managerToken = await ctx.tokenFor(manager);
    staffToken = await ctx.tokenFor(staff);
    leadToken = await ctx.tokenFor(lead);
  });

  afterAll(() => ctx.cleanup());

  it("STAFF ekipman talebi açar → OPEN/MEDIUM, OWNER'a bildirim (MANAGER'a değil)", async () => {
    const ownerBefore = await prisma.notification.count({ where: { userId: owner.id, type: "staff_request" } });
    const res = await api()
      .post("/staff-requests")
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ subject: "vt_Yeni pülverizatör", description: "Mevcut pülverizatörün pompası sızdırıyor, değişmesi gerekiyor.", category: "EQUIPMENT" });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("OPEN");
    expect(res.body.priority).toBe("MEDIUM");
    expect(res.body.category).toBe("EQUIPMENT");
    expect(res.body.staffUserId).toBe(staff.id);
    expect(res.body.resolvedAt).toBeNull();
    requestId = res.body.id;
    const ownerAfter = await prisma.notification.count({ where: { userId: owner.id, type: "staff_request" } });
    expect(ownerAfter - ownerBefore).toBe(1);
    const managerNotes = await prisma.notification.count({ where: { userId: manager.id, type: "staff_request" } });
    expect(managerNotes).toBe(0);
  });

  it("geçersiz gövde 400 (kısa açıklama, bilinmeyen kategori)", async () => {
    const short = await api().post("/staff-requests").set("Authorization", `Bearer ${staffToken}`).send({ subject: "vt_x", description: "kısa" });
    expect(short.status).toBe(400);
    const badCat = await api()
      .post("/staff-requests")
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ subject: "vt_Kategori", description: "Kategori geçersiz olmalı, reddedilmeli.", category: "FOO" });
    expect(badCat.status).toBe(400);
  });

  it("personel yalnızca kendi taleplerini görür; başkasınınkine GET → 404", async () => {
    const leadRes = await api()
      .post("/staff-requests")
      .set("Authorization", `Bearer ${leadToken}`)
      .send({ subject: "vt_Ekip aracı", description: "Ekip için ikinci bir araç tahsis edilmesini öneriyorum.", category: "SUGGESTION", priority: "HIGH" });
    expect(leadRes.status).toBe(201);
    const mgrRes = await api()
      .post("/staff-requests")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ subject: "vt_Müdür talebi", description: "Ofis için yeni bir yazıcı alınması gerekiyor.", category: "OTHER" });
    expect(mgrRes.status).toBe(201);

    const staffList = await api().get("/staff-requests?limit=100").set("Authorization", `Bearer ${staffToken}`);
    expect(staffList.status).toBe(200);
    expect(staffList.body.data.length).toBeGreaterThan(0);
    expect(staffList.body.data.every((r: { staffUserId: string }) => r.staffUserId === staff.id)).toBe(true);

    const cross = await api().get(`/staff-requests/${requestId}`).set("Authorization", `Bearer ${leadToken}`);
    expect(cross.status).toBe(404);
    const crossMgr = await api().get(`/staff-requests/${requestId}`).set("Authorization", `Bearer ${managerToken}`);
    expect(crossMgr.status).toBe(404);
    const own = await api().get(`/staff-requests/${requestId}`).set("Authorization", `Bearer ${staffToken}`);
    expect(own.status).toBe(200);

    const all = await api().get("/staff-requests?limit=100").set("Authorization", `Bearer ${ownerToken}`);
    const ids = all.body.data.map((r: { id: string }) => r.id);
    expect(ids).toEqual(expect.arrayContaining([requestId, leadRes.body.id, mgrRes.body.id]));
    const high = await api().get("/staff-requests?priority=HIGH&limit=100").set("Authorization", `Bearer ${ownerToken}`);
    expect(high.body.data.every((r: { priority: string }) => r.priority === "HIGH")).toBe(true);
    const sugg = await api().get("/staff-requests?category=SUGGESTION&limit=100").set("Authorization", `Bearer ${ownerToken}`);
    expect(sugg.body.data.every((r: { category: string }) => r.category === "SUGGESTION")).toBe(true);
    expect(sugg.body.data.some((r: { id: string }) => r.id === leadRes.body.id)).toBe(true);
  });

  it("yalnızca OWNER yanıtlar; MANAGER ve talep sahibi PATCH → 403", async () => {
    const mgr = await api().patch(`/staff-requests/${requestId}`).set("Authorization", `Bearer ${managerToken}`).send({ status: "RESOLVED" });
    expect(mgr.status).toBe(403);
    const self = await api().patch(`/staff-requests/${requestId}`).set("Authorization", `Bearer ${staffToken}`).send({ status: "RESOLVED" });
    expect(self.status).toBe(403);

    const res = await api()
      .patch(`/staff-requests/${requestId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ status: "IN_PROGRESS", responseNote: "Tedarikçiden fiyat istendi." });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("IN_PROGRESS");
    expect(res.body.respondedBy.id).toBe(owner.id);
    expect(res.body.resolvedAt).toBeNull();
  });

  it("RESOLVED → resolvedAt + talep sahibine bildirim; yeniden açılınca sıfırlanır; REJECTED de kapatır", async () => {
    const before = await prisma.notification.count({ where: { userId: staff.id, type: "staff_request" } });
    const res = await api()
      .patch(`/staff-requests/${requestId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ status: "RESOLVED", responseNote: "Yeni pülverizatör teslim edildi." });
    expect(res.status).toBe(200);
    expect(res.body.resolvedAt).toBeTruthy();
    const after = await prisma.notification.count({ where: { userId: staff.id, type: "staff_request" } });
    expect(after - before).toBe(1);
    const note = await prisma.notification.findFirst({ where: { userId: staff.id, type: "staff_request" }, orderBy: { createdAt: "desc" } });
    expect(note?.title).toBe("Talebiniz sonuçlandı");

    const reopen = await api().patch(`/staff-requests/${requestId}`).set("Authorization", `Bearer ${ownerToken}`).send({ status: "OPEN" });
    expect(reopen.body.resolvedAt).toBeNull();

    const reject = await api().patch(`/staff-requests/${requestId}`).set("Authorization", `Bearer ${ownerToken}`).send({ status: "REJECTED" });
    expect(reject.body.status).toBe("REJECTED");
    expect(reject.body.resolvedAt).toBeTruthy();

    const empty = await api().patch(`/staff-requests/${requestId}`).set("Authorization", `Bearer ${ownerToken}`).send({});
    expect(empty.status).toBe(400);
  });
});

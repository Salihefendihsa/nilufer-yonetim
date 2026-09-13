import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { api, TestContext, type TestUser } from "./helpers/fixtures";

/**
 * Personel yaşam döngüsü: terfi → arşivleme, düşürme → canlanma (maaş/
 * pozisyon korunur), işten çıkarma → login reddi + eski JWT ölür,
 * geri aktif etme → login çalışır. Bugün bulunan "arşivlenen personel maaşı
 * hâlâ net kâra giriyor" bug'ının regresyonu finance.test.ts'te.
 */
describe("Personel yaşam döngüsü", () => {
  const ctx = new TestContext();
  let owner: TestUser;
  let ownerToken: string;

  beforeAll(async () => {
    owner = await ctx.createUser(Role.OWNER);
    ownerToken = await ctx.tokenFor(owner);
  });

  afterAll(() => ctx.cleanup());

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  it("promote-to-manager: Staff kaydı SİLİNMEZ, arşivlenir; rol MANAGER olur; eski token geçersizleşir", async () => {
    const staff = await ctx.createStaffUser(Role.TEAM_LEAD, { salaryBase: 25000, position: "vt_Sef" });
    const oldToken = await ctx.tokenFor(staff);

    const res = await api()
      .post(`/staff/${staff.staffId}/promote-to-manager`)
      .set(auth(ownerToken))
      .send({ reason: "vt_terfi" });
    expect(res.status).toBe(200);

    const staffRow = await prisma.staff.findUniqueOrThrow({ where: { id: staff.staffId! } });
    expect(staffRow.archivedAt).not.toBeNull();
    expect(Number(staffRow.salaryBase)).toBe(25000);
    expect(staffRow.position).toBe("vt_Sef");

    const user = await prisma.user.findUniqueOrThrow({ where: { id: staff.id } });
    expect(user.role).toBe(Role.MANAGER);

    // JWT'de eski rol gömülüydü → tokenVersion artışı ile reddedilmeli (bugün bulunan "JWT eski rol" bug'ı).
    const stale = await api().get("/auth/me").set(auth(oldToken));
    expect(stale.status).toBe(401);

    // Arşivlenmiş personel aktif listede görünmez; includeArchived ile OWNER görür.
    const active = await api().get("/staff?limit=100").set(auth(ownerToken));
    expect(active.body.data.some((s: { id: string }) => s.id === staff.staffId)).toBe(false);
    const archived = await api().get("/staff?limit=100&includeArchived=true").set(auth(ownerToken));
    expect(archived.body.data.some((s: { id: string }) => s.id === staff.staffId)).toBe(true);

    // İkinci terfi 409/400 — zaten arşivli / zaten MANAGER.
    const again = await api()
      .post(`/staff/${staff.staffId}/promote-to-manager`)
      .set(auth(ownerToken))
      .send({ reason: "vt_tekrar" });
    expect([400, 409]).toContain(again.status);
  });

  it("demote-from-manager: aynı Staff kaydı canlanır, maaş/pozisyon korunur, rol düşer", async () => {
    const staff = await ctx.createStaffUser(Role.STAFF, { salaryBase: 18000, position: "vt_Teknisyen" });
    await api().post(`/staff/${staff.staffId}/promote-to-manager`).set(auth(ownerToken)).send({ reason: "vt" });

    const res = await api()
      .post(`/users/${staff.id}/demote-from-manager`)
      .set(auth(ownerToken))
      .send({ reason: "vt_dusurme", newRole: "TEAM_LEAD" });
    expect(res.status).toBe(200);

    const staffRow = await prisma.staff.findUniqueOrThrow({ where: { userId: staff.id } });
    expect(staffRow.id).toBe(staff.staffId); // yeni kayıt DEĞİL, aynı kayıt
    expect(staffRow.archivedAt).toBeNull();
    expect(Number(staffRow.salaryBase)).toBe(18000);
    expect(staffRow.position).toBe("vt_Teknisyen");

    const user = await prisma.user.findUniqueOrThrow({ where: { id: staff.id } });
    expect(user.role).toBe(Role.TEAM_LEAD);
  });

  it("demote: hiç Staff kaydı olmayan MANAGER için pozisyon+maaş zorunlu (400), verilince yeni kayıt açılır", async () => {
    const manager = await ctx.createUser(Role.MANAGER, { tag: "puremgr" });
    const missing = await api()
      .post(`/users/${manager.id}/demote-from-manager`)
      .set(auth(ownerToken))
      .send({ reason: "vt", newRole: "STAFF" });
    expect(missing.status).toBe(400);

    const ok = await api()
      .post(`/users/${manager.id}/demote-from-manager`)
      .set(auth(ownerToken))
      .send({ reason: "vt", newRole: "STAFF", position: "vt_Yeni", salaryBase: 12000 });
    expect(ok.status).toBe(200);
    const staffRow = await prisma.staff.findUniqueOrThrow({ where: { userId: manager.id } });
    ctx.staffIds.push(staffRow.id);
    expect(Number(staffRow.salaryBase)).toBe(12000);
  });

  it("terminate: login 403, mevcut JWT 401, Staff arşivlenir; reactivate: login yeniden çalışır, Staff canlanır", async () => {
    const staff = await ctx.createStaffUser(Role.STAFF, { tag: "term" });
    const liveToken = await ctx.tokenFor(staff);
    expect((await api().get("/auth/me").set(auth(liveToken))).status).toBe(200);

    const terminate = await api().post(`/users/${staff.id}/terminate`).set(auth(ownerToken)).send({ reason: "vt_cikis" });
    expect(terminate.status).toBe(200);

    expect((await ctx.login(staff.email)).status).toBe(403);
    expect((await api().get("/auth/me").set(auth(liveToken))).status).toBe(401);
    expect((await prisma.staff.findUniqueOrThrow({ where: { id: staff.staffId! } })).archivedAt).not.toBeNull();

    // İkinci terminate 409.
    const again = await api().post(`/users/${staff.id}/terminate`).set(auth(ownerToken)).send({ reason: "vt" });
    expect(again.status).toBe(409);

    const reactivate = await api().post(`/users/${staff.id}/reactivate`).set(auth(ownerToken)).send({ reason: "vt_geri" });
    expect(reactivate.status).toBe(200);

    const login = await ctx.login(staff.email);
    expect(login.status).toBe(200);
    expect(login.body.token).toBeTypeOf("string");
    expect((await prisma.staff.findUniqueOrThrow({ where: { id: staff.staffId! } })).archivedAt).toBeNull();
  });

  it("terminate: OWNER hedef olamaz (403)", async () => {
    const otherOwner = await ctx.createUser(Role.OWNER, { tag: "owner2" });
    const res = await api().post(`/users/${otherOwner.id}/terminate`).set(auth(ownerToken)).send({ reason: "vt" });
    expect(res.status).toBe(403);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: otherOwner.id } })).isActive).toBe(true);
  });

  it("STAFF ↔ TEAM_LEAD rol değişimi arşivlemez, tokenVersion artırır", async () => {
    const staff = await ctx.createStaffUser(Role.STAFF, { tag: "swap" });
    const oldToken = await ctx.tokenFor(staff);
    const res = await api()
      .patch(`/staff/${staff.staffId}/role`)
      .set(auth(ownerToken))
      .send({ newRole: "TEAM_LEAD", reason: "vt" });
    expect(res.status).toBe(200);
    const row = await prisma.staff.findUniqueOrThrow({ where: { id: staff.staffId! }, include: { user: true } });
    expect(row.archivedAt).toBeNull();
    expect(row.user.role).toBe(Role.TEAM_LEAD);
    expect((await api().get("/auth/me").set(auth(oldToken))).status).toBe(401);

    const same = await api().patch(`/staff/${staff.staffId}/role`).set(auth(ownerToken)).send({ newRole: "TEAM_LEAD", reason: "vt" });
    expect(same.status).toBe(409);
  });
});

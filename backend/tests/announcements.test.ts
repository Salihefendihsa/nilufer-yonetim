import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { api, TestContext, type TestUser } from "./helpers/fixtures";

/**
 * Bölüm AK (8. tur): Sistem geneli duyuru şeridi.
 * - POST: yeni duyuru öncekini pasifleştirir (tek aktif)
 * - GET /active: süresi dolmuş duyuru dönmez; aktif yoksa null
 * - DELETE: isActive=false → /active null
 * - Geçmiş expiresAt → 400
 * Dev DB'de test öncesi aktif olan gerçek duyurular ID ile geri açılır (yan etki yok).
 */
describe("Duyuru şeridi", () => {
  const ctx = new TestContext();
  let owner: TestUser;
  let staff: TestUser;
  const tokens: Record<string, string> = {};
  let previouslyActiveIds: string[] = [];

  beforeAll(async () => {
    owner = await ctx.createUser(Role.OWNER);
    staff = await ctx.createStaffUser(Role.STAFF);
    tokens.owner = await ctx.tokenFor(owner);
    tokens.staff = await ctx.tokenFor(staff);
    previouslyActiveIds = (await prisma.announcement.findMany({ where: { isActive: true }, select: { id: true } })).map((a) => a.id);
  });

  afterAll(async () => {
    await ctx.cleanup();
    if (previouslyActiveIds.length) {
      await prisma.announcement.updateMany({ where: { id: { in: previouslyActiveIds } }, data: { isActive: true } });
    }
  });
  const as = (k: string) => `Bearer ${tokens[k]}`;

  it("yeni duyuru öncekini pasifleştirir; /active en yenisini döner (STAFF de görür)", async () => {
    const a = await api().post("/announcements").set("Authorization", as("owner")).send({ message: "vt_Duyuru 1" });
    expect(a.status).toBe(201);
    expect(a.body.isActive).toBe(true);

    const b = await api().post("/announcements").set("Authorization", as("owner")).send({ message: "vt_Duyuru 2" });
    expect(b.status).toBe(201);

    const first = await prisma.announcement.findUnique({ where: { id: a.body.id } });
    expect(first?.isActive).toBe(false);

    const active = await api().get("/announcements/active").set("Authorization", as("staff"));
    expect(active.status).toBe(200);
    expect(active.body.data).toMatchObject({ id: b.body.id, message: "vt_Duyuru 2" });

    const activeCount = await prisma.announcement.count({ where: { isActive: true } });
    expect(activeCount).toBe(1);
  });

  it("süresi dolmuş duyuru /active'de dönmez; geçmiş expiresAt ile oluşturma 400", async () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const bad = await api().post("/announcements").set("Authorization", as("owner")).send({ message: "vt_geçmiş", expiresAt: past });
    expect(bad.status).toBe(400);

    // Yakın gelecekte biten duyuru oluştur, sonra DB'de süresini geçmişe çek (ID ile).
    const soon = new Date(Date.now() + 60_000).toISOString();
    const c = await api().post("/announcements").set("Authorization", as("owner")).send({ message: "vt_Süreli", expiresAt: soon });
    expect(c.status).toBe(201);
    let active = await api().get("/announcements/active").set("Authorization", as("owner"));
    expect(active.body.data?.id).toBe(c.body.id);

    await prisma.announcement.update({ where: { id: c.body.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    active = await api().get("/announcements/active").set("Authorization", as("owner"));
    expect(active.body.data).toBeNull();
  });

  it("DELETE pasifleştirir → /active null; uydurma id 404; liste OWNER", async () => {
    const d = await api().post("/announcements").set("Authorization", as("owner")).send({ message: "vt_Silinecek" });
    const del = await api().delete(`/announcements/${d.body.id}`).set("Authorization", as("owner"));
    expect(del.status).toBe(200);
    expect(del.body.isActive).toBe(false);

    const active = await api().get("/announcements/active").set("Authorization", as("owner"));
    expect(active.body.data).toBeNull();

    expect((await api().delete("/announcements/00000000-0000-0000-0000-000000000000").set("Authorization", as("owner"))).status).toBe(404);
    const list = await api().get("/announcements").set("Authorization", as("owner"));
    expect(list.status).toBe(200);
    expect(list.body.data.some((r: { id: string }) => r.id === d.body.id)).toBe(true);
  });
});

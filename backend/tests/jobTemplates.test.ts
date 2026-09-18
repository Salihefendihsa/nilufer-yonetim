import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { api, TestContext, TEST_PREFIX, uid, type TestUser } from "./helpers/fixtures";

/**
 * Bölüm T (5. tur): İş şablonları CRUD (OWNER/MANAGER). Yumuşak silme,
 * ?includeInactive=true, doğrulama. "Şablondan doldur" istemci mantığıdır —
 * burada yalnızca backend sözleşmesi test edilir.
 */
describe("İş şablonları (/job-templates)", () => {
  const ctx = new TestContext();
  let owner: TestUser;
  let manager: TestUser;
  let staff: TestUser;
  let templateId: string;
  const name = `${TEST_PREFIX}Şablon ${uid()}`;
  const tokens: Record<string, string> = {};

  beforeAll(async () => {
    owner = await ctx.createUser(Role.OWNER);
    manager = await ctx.createUser(Role.MANAGER);
    staff = await ctx.createStaffUser(Role.STAFF);
    for (const [k, u] of Object.entries({ owner, manager, staff })) tokens[k] = await ctx.tokenFor(u);
  });

  afterAll(() => ctx.cleanup());

  const as = (k: string) => `Bearer ${tokens[k]}`;

  it("MANAGER oluşturur (201) — Decimal fiyat string olarak döner; doğrulama 400", async () => {
    const res = await api()
      .post("/job-templates")
      .set("Authorization", as("manager"))
      .send({ name, serviceType: "Hamam Böceği İlaçlama", defaultPrice: 1250.5, defaultDurationMinutes: 90, defaultNotes: "Mutfak öncelikli" });
    expect(res.status).toBe(201);
    expect(res.body.isActive).toBe(true);
    expect(Number(res.body.defaultPrice)).toBe(1250.5);
    templateId = res.body.id;
    ctx.track("jobTemplate", templateId);

    const bad = await api().post("/job-templates").set("Authorization", as("owner")).send({ name: "", serviceType: "x" });
    expect(bad.status).toBe(400);
    const badDuration = await api().post("/job-templates").set("Authorization", as("owner")).send({ name: "x", serviceType: "y", defaultDurationMinutes: 0 });
    expect(badDuration.status).toBe(400);
  });

  it("GET listeler (aktifler); PATCH günceller; notes boş string → null", async () => {
    const list = await api().get("/job-templates").set("Authorization", as("owner"));
    expect(list.status).toBe(200);
    expect(list.body.data.some((t: { id: string }) => t.id === templateId)).toBe(true);

    const upd = await api().patch(`/job-templates/${templateId}`).set("Authorization", as("owner")).send({ defaultPrice: 1400, defaultNotes: "" });
    expect(upd.status).toBe(200);
    expect(Number(upd.body.defaultPrice)).toBe(1400);
    expect(upd.body.defaultNotes).toBeNull();
    expect(upd.body.serviceType).toBe("Hamam Böceği İlaçlama");
  });

  it("DELETE yumuşak siler (204): aktif listede yok, includeInactive ile var; olmayan id 404", async () => {
    const del = await api().delete(`/job-templates/${templateId}`).set("Authorization", as("manager"));
    expect(del.status).toBe(204);

    const active = await api().get("/job-templates").set("Authorization", as("owner"));
    expect(active.body.data.some((t: { id: string }) => t.id === templateId)).toBe(false);

    const all = await api().get("/job-templates?includeInactive=true").set("Authorization", as("owner"));
    const row = all.body.data.find((t: { id: string }) => t.id === templateId);
    expect(row.isActive).toBe(false);

    const missing = await api().delete("/job-templates/00000000-0000-4000-8000-000000000000").set("Authorization", as("owner"));
    expect(missing.status).toBe(404);
  });

  it("STAFF hiçbir uca giremez (403)", async () => {
    const res = await api().get("/job-templates").set("Authorization", as("staff"));
    expect(res.status).toBe(403);
    const post = await api().post("/job-templates").set("Authorization", as("staff")).send({ name: "x", serviceType: "y" });
    expect(post.status).toBe(403);
  });
});

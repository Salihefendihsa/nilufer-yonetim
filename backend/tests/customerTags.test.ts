import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { api, TestContext, TEST_PREFIX, uid, type TestUser } from "./helpers/fixtures";

/**
 * Bölüm X (6. tur): Müşteri etiketleri.
 * - CRUD (OWNER/MANAGER), aynı ad 409, renk doğrulaması
 * - POST /customers/:id/tags kümeyi tam eşitler (ekle+çıkar), geçersiz etiket 400
 * - GET /customers?tagId= filtreler; liste/detay `tags` taşır
 * - DELETE etiket → atamalar Cascade ile temizlenir
 */
describe("Müşteri etiketleri", () => {
  const ctx = new TestContext();
  let owner: TestUser;
  let staff: TestUser;
  let customerA: string;
  let customerB: string;
  let vipId: string;
  let corpId: string;
  const tokens: Record<string, string> = {};
  const tagIds: string[] = [];

  beforeAll(async () => {
    owner = await ctx.createUser(Role.OWNER);
    staff = await ctx.createStaffUser(Role.STAFF);
    customerA = (await ctx.createCustomer()).id;
    customerB = (await ctx.createCustomer()).id;
    tokens.owner = await ctx.tokenFor(owner);
    tokens.staff = await ctx.tokenFor(staff);
  });

  afterAll(async () => {
    // Testin sonunda silinmemiş etiket kalırsa ID ile temizle (Cascade atamaları da götürür).
    await prisma.customerTag.deleteMany({ where: { id: { in: tagIds } } });
    await ctx.cleanup();
  });

  const as = (k: string) => `Bearer ${tokens[k]}`;

  it("oluşturma: 201, aynı ad 409, bozuk renk 400, STAFF 403", async () => {
    const vip = await api().post("/customer-tags").set("Authorization", as("owner")).send({ name: `${TEST_PREFIX}VIP ${uid()}`, color: "#B57F13" });
    expect(vip.status).toBe(201);
    vipId = vip.body.id;
    tagIds.push(vipId);
    const corp = await api().post("/customer-tags").set("Authorization", as("owner")).send({ name: `${TEST_PREFIX}Kurumsal ${uid()}` });
    expect(corp.status).toBe(201);
    expect(corp.body.color).toBe("#3D8A4E"); // varsayılan
    corpId = corp.body.id;
    tagIds.push(corpId);

    const dup = await api().post("/customer-tags").set("Authorization", as("owner")).send({ name: vip.body.name });
    expect(dup.status).toBe(409);
    const badColor = await api().post("/customer-tags").set("Authorization", as("owner")).send({ name: "x", color: "kırmızı" });
    expect(badColor.status).toBe(400);
    const forbidden = await api().post("/customer-tags").set("Authorization", as("staff")).send({ name: "y" });
    expect(forbidden.status).toBe(403);
  });

  it("atama kümeyi tam eşitler; geçersiz etiket 400; liste ve detayda tags", async () => {
    const both = await api().post(`/customers/${customerA}/tags`).set("Authorization", as("owner")).send({ tagIds: [vipId, corpId] });
    expect(both.status).toBe(200);
    expect(both.body.tags.map((t: { id: string }) => t.id).sort()).toEqual([vipId, corpId].sort());

    // Yalnızca VIP kalsın → Kurumsal çıkarılır.
    const onlyVip = await api().post(`/customers/${customerA}/tags`).set("Authorization", as("owner")).send({ tagIds: [vipId, vipId] });
    expect(onlyVip.body.tags.map((t: { id: string }) => t.id)).toEqual([vipId]);

    const bad = await api().post(`/customers/${customerA}/tags`).set("Authorization", as("owner")).send({ tagIds: ["00000000-0000-4000-8000-000000000000"] });
    expect(bad.status).toBe(400);

    await api().post(`/customers/${customerB}/tags`).set("Authorization", as("owner")).send({ tagIds: [corpId] });

    const detail = await api().get(`/customers/${customerA}`).set("Authorization", as("owner"));
    expect(detail.body.tags.map((t: { id: string }) => t.id)).toEqual([vipId]);
    expect(detail.body).not.toHaveProperty("tagAssignments");
  });

  it("GET /customers?tagId= filtreler; PATCH isActive/renk; liste customerCount taşır", async () => {
    const vipOnly = await api().get(`/customers?tagId=${vipId}&limit=100`).set("Authorization", as("owner"));
    const ids = vipOnly.body.data.map((c: { id: string }) => c.id);
    expect(ids).toContain(customerA);
    expect(ids).not.toContain(customerB);
    expect(vipOnly.body.data.find((c: { id: string }) => c.id === customerA).tags[0].id).toBe(vipId);

    const upd = await api().patch(`/customer-tags/${vipId}`).set("Authorization", as("owner")).send({ color: "#C0392B", isActive: false });
    expect(upd.status).toBe(200);
    expect(upd.body.color).toBe("#C0392B");

    const list = await api().get("/customer-tags?includeInactive=true").set("Authorization", as("owner"));
    const corpRow = list.body.data.find((t: { id: string }) => t.id === corpId);
    expect(corpRow.customerCount).toBe(1);
    const activeOnly = await api().get("/customer-tags").set("Authorization", as("staff"));
    expect(activeOnly.status).toBe(200);
    expect(activeOnly.body.data.some((t: { id: string }) => t.id === vipId)).toBe(false);
  });

  it("DELETE etiket → atamalar Cascade ile temizlenir; olmayan 404", async () => {
    const before = await prisma.customerTagAssignment.count({ where: { tagId: corpId } });
    expect(before).toBe(1);
    const del = await api().delete(`/customer-tags/${corpId}`).set("Authorization", as("owner"));
    expect(del.status).toBe(204);
    expect(await prisma.customerTagAssignment.count({ where: { tagId: corpId } })).toBe(0);
    const detail = await api().get(`/customers/${customerB}`).set("Authorization", as("owner"));
    expect(detail.body.tags).toEqual([]);

    const again = await api().delete(`/customer-tags/${corpId}`).set("Authorization", as("owner"));
    expect(again.status).toBe(404);
  });
});

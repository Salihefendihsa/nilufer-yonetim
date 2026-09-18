import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { ONBOARDING_TEMPLATE } from "../src/lib/onboarding";
import { api, TestContext, type TestUser } from "./helpers/fixtures";

/**
 * Bölüm U (5. tur): İşe alım kontrol listesi.
 * - POST /staff → 5 madde otomatik (aynı transaction)
 * - PATCH işaretleme: completedAt/By damgası, yeniden işaretlemede korunur,
 *   geri alınca sıfırlanır; ilerleme yüzdesi; audit log
 * - GET: OWNER herkes; STAFF kendi (200) / başkası (403); STAFF PATCH 403
 */
describe("İşe alım kontrol listesi (/staff/:id/onboarding)", () => {
  const ctx = new TestContext();
  let owner: TestUser;
  let newHireUser: TestUser;
  let otherStaff: TestUser;
  let staffId: string;
  const tokens: Record<string, string> = {};

  beforeAll(async () => {
    owner = await ctx.createUser(Role.OWNER);
    newHireUser = await ctx.createUser(Role.STAFF, { tag: "hire" });
    otherStaff = await ctx.createStaffUser(Role.STAFF, { tag: "other" });
    tokens.owner = await ctx.tokenFor(owner);
    tokens.other = await ctx.tokenFor(otherStaff);
  });

  afterAll(() => ctx.cleanup());

  const as = (k: string) => `Bearer ${tokens[k]}`;

  it("POST /staff yeni personel için 5 maddeyi otomatik oluşturur", async () => {
    const res = await api()
      .post("/staff")
      .set("Authorization", as("owner"))
      .send({ userId: newHireUser.id, position: "vt_Teknisyen", salaryBase: 12000 });
    expect(res.status).toBe(201);
    staffId = res.body.id;
    ctx.staffIds.push(staffId);
    tokens.hire = await ctx.tokenFor(newHireUser);

    const items = await prisma.onboardingChecklistItem.findMany({ where: { staffId }, orderBy: { sortOrder: "asc" } });
    expect(items.map((i) => i.item)).toEqual([...ONBOARDING_TEMPLATE]);
    expect(items.every((i) => !i.isCompleted)).toBe(true);
  });

  it("GET: OWNER ilerleme 0/5 görür; STAFF kendi kaydını görür, başkasınınkini 403", async () => {
    const own = await api().get(`/staff/${staffId}/onboarding`).set("Authorization", as("owner"));
    expect(own.status).toBe(200);
    expect(own.body.items).toHaveLength(5);
    expect(own.body.progress).toEqual({ total: 5, completed: 0, percent: 0, isComplete: false });

    const self = await api().get(`/staff/${staffId}/onboarding`).set("Authorization", as("hire"));
    expect(self.status).toBe(200);
    const other = await api().get(`/staff/${staffId}/onboarding`).set("Authorization", as("other"));
    expect(other.status).toBe(403);
  });

  it("PATCH işaretleme: damga + ilerleme; STAFF 403; yeniden işaretlemede damga korunur; geri alma sıfırlar; olmayan madde 404", async () => {
    const items = await prisma.onboardingChecklistItem.findMany({ where: { staffId }, orderBy: { sortOrder: "asc" } });
    const first = items[0];

    const forbidden = await api().patch(`/staff/${staffId}/onboarding/${first.id}`).set("Authorization", as("hire")).send({ isCompleted: true });
    expect(forbidden.status).toBe(403);

    const done = await api().patch(`/staff/${staffId}/onboarding/${first.id}`).set("Authorization", as("owner")).send({ isCompleted: true });
    expect(done.status).toBe(200);
    expect(done.body.item.isCompleted).toBe(true);
    expect(done.body.item.completedAt).toBeTruthy();
    expect(done.body.item.completedBy.id).toBe(owner.id);
    expect(done.body.progress).toEqual({ total: 5, completed: 1, percent: 20, isComplete: false });
    const stamp = done.body.item.completedAt;

    const again = await api().patch(`/staff/${staffId}/onboarding/${first.id}`).set("Authorization", as("owner")).send({ isCompleted: true });
    expect(again.body.item.completedAt).toBe(stamp);

    const undo = await api().patch(`/staff/${staffId}/onboarding/${first.id}`).set("Authorization", as("owner")).send({ isCompleted: false });
    expect(undo.body.item.isCompleted).toBe(false);
    expect(undo.body.item.completedAt).toBeNull();
    expect(undo.body.progress.completed).toBe(0);

    const audit = await prisma.auditLog.findFirst({ where: { actorUserId: owner.id, action: "onboarding.item_completed", targetId: first.id } });
    expect(audit?.detail).toBe(first.item);

    const missing = await api()
      .patch(`/staff/${staffId}/onboarding/00000000-0000-4000-8000-000000000000`)
      .set("Authorization", as("owner"))
      .send({ isCompleted: true });
    expect(missing.status).toBe(404);
  });

  it("tümü işaretlenince isComplete true", async () => {
    const items = await prisma.onboardingChecklistItem.findMany({ where: { staffId } });
    let last: { progress: { isComplete: boolean; percent: number } } | null = null;
    for (const i of items) {
      const res = await api().patch(`/staff/${staffId}/onboarding/${i.id}`).set("Authorization", as("owner")).send({ isCompleted: true });
      last = res.body;
    }
    expect(last?.progress).toMatchObject({ isComplete: true, percent: 100 });
  });
});

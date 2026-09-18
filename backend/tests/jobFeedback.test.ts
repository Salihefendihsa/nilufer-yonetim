import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { api, TestContext, type TestUser } from "./helpers/fixtures";

/**
 * Bölüm S (5. tur): Yapılandırılmış müşteri geri bildirimi.
 * - yalnızca kendi işi (başkası 403), yalnızca COMPLETED (aksi 400)
 * - bir kez (ikinci gönderim 409); rating/ratingComment'e dokunulmaz
 * - doğrulama (puan 1–5); /analytics/feedback-summary ortalamaları
 */
describe("Müşteri geri bildirimi (/jobs/:id/feedback)", () => {
  const ctx = new TestContext();
  let owner: TestUser;
  let customerA: TestUser;
  let customerB: TestUser;
  let completedJobId: string;
  let scheduledJobId: string;
  const tokens: Record<string, string> = {};

  beforeAll(async () => {
    owner = await ctx.createUser(Role.OWNER);
    customerA = await ctx.createUser(Role.CUSTOMER, { tag: "a" });
    customerB = await ctx.createUser(Role.CUSTOMER, { tag: "b" });
    const a = await ctx.createCustomer({ userId: customerA.id });
    await ctx.createCustomer({ userId: customerB.id });
    completedJobId = (await ctx.createJob({ customerId: a.id, status: "COMPLETED", completedAt: new Date(), rating: 4, ratingComment: "iyi" })).id;
    scheduledJobId = (await ctx.createJob({ customerId: a.id, status: "SCHEDULED" })).id;
    for (const [k, u] of Object.entries({ owner, customerA, customerB })) tokens[k] = await ctx.tokenFor(u);
  });

  afterAll(() => ctx.cleanup());

  const as = (k: string) => `Bearer ${tokens[k]}`;
  const body = { serviceQualityScore: 5, punctualityScore: 4, staffProfessionalismScore: 5, wouldRecommend: true, feedbackComment: "Çok memnun kaldık" };

  it("başka müşteri 403; OWNER route'a giremez 403", async () => {
    const other = await api().patch(`/jobs/${completedJobId}/feedback`).set("Authorization", as("customerB")).send(body);
    expect(other.status).toBe(403);
    const o = await api().patch(`/jobs/${completedJobId}/feedback`).set("Authorization", as("owner")).send(body);
    expect(o.status).toBe(403);
  });

  it("COMPLETED olmayan iş 400", async () => {
    const res = await api().patch(`/jobs/${scheduledJobId}/feedback`).set("Authorization", as("customerA")).send(body);
    expect(res.status).toBe(400);
  });

  it("puan aralığı dışı 400", async () => {
    const res = await api().patch(`/jobs/${completedJobId}/feedback`).set("Authorization", as("customerA")).send({ ...body, punctualityScore: 6 });
    expect(res.status).toBe(400);
  });

  it("kendi tamamlanmış işine gönderir; rating korunur; ikinci gönderim 409", async () => {
    const res = await api().patch(`/jobs/${completedJobId}/feedback`).set("Authorization", as("customerA")).send(body);
    expect(res.status).toBe(200);
    expect(res.body.serviceQualityScore).toBe(5);
    expect(res.body.wouldRecommend).toBe(true);
    expect(res.body.feedbackSubmittedAt).toBeTruthy();
    expect(res.body.rating).toBe(4);
    expect(res.body.ratingComment).toBe("iyi");

    const again = await api().patch(`/jobs/${completedJobId}/feedback`).set("Authorization", as("customerA")).send({ ...body, serviceQualityScore: 1 });
    expect(again.status).toBe(409);
  });

  it("GET /analytics/feedback-summary ortalamaları içerir (OWNER); CUSTOMER 403", async () => {
    const res = await api().get("/analytics/feedback-summary").set("Authorization", as("owner"));
    expect(res.status).toBe(200);
    expect(res.body.responseCount).toBeGreaterThanOrEqual(1);
    expect(res.body.serviceQualityAvg).toBeGreaterThanOrEqual(1);
    expect(res.body.serviceQualityAvg).toBeLessThanOrEqual(5);
    expect(res.body.recommendRate === null || (res.body.recommendRate >= 0 && res.body.recommendRate <= 100)).toBe(true);
    const c = await api().get("/analytics/feedback-summary").set("Authorization", as("customerA"));
    expect(c.status).toBe(403);
  });
});

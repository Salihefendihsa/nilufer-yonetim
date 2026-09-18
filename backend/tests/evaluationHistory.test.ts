import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { api, TestContext, type TestUser } from "./helpers/fixtures";

/**
 * Bölüm V (5. tur): GET /evaluations/staff/:staffId/history
 * - çok dönem kronolojik (dönem başlangıcına göre), taslaklar hariç
 * - overallAverage / lastDelta; tek dönemde lastDelta null
 * - STAFF kendi geçmişini görür ama evaluator kimliği SIZMAZ; başkasınınki 403
 */
describe("Değerlendirme geçmişi", () => {
  const ctx = new TestContext();
  let manager: TestUser;
  let member: TestUser;
  let other: TestUser;
  const tokens: Record<string, string> = {};
  const periodIds: string[] = [];

  beforeAll(async () => {
    manager = await ctx.createUser(Role.MANAGER);
    member = await ctx.createStaffUser(Role.STAFF, { tag: "m" });
    other = await ctx.createStaffUser(Role.STAFF, { tag: "o" });
    for (const [k, u] of Object.entries({ manager, member, other })) tokens[k] = await ctx.tokenFor(u);

    const criterion = await prisma.evaluationCriterion.create({ data: { name: "vt_hist_kriter" } });
    ctx.track("evaluationCriterion", criterion.id);

    // 3 dönem: 2026-01, 2026-04, 2026-07 — ters sırada oluşturulur ki
    // sıralamanın createdAt'e değil dönem tarihine göre olduğu görülsün.
    const specs = [
      { label: "vt_2026-Q3", start: new Date("2026-07-01"), end: new Date("2026-09-30"), score: 19 },
      { label: "vt_2026-Q1", start: new Date("2026-01-01"), end: new Date("2026-03-31"), score: 12 },
      { label: "vt_2026-Q2", start: new Date("2026-04-01"), end: new Date("2026-06-30"), score: 15 },
    ];
    for (const sp of specs) {
      const period = await prisma.evaluationPeriod.create({ data: { label: sp.label, startDate: sp.start, endDate: sp.end } });
      ctx.track("evaluationPeriod", period.id);
      periodIds.push(period.id);
      const create = await api()
        .post("/evaluations")
        .set("Authorization", `Bearer ${tokens.manager}`)
        .send({ targetStaffId: member.staffId, periodId: period.id, scores: [{ criterionId: criterion.id, score: sp.score }] });
      expect(create.status).toBe(201);
      const submit = await api().post(`/evaluations/${create.body.id}/submit`).set("Authorization", `Bearer ${tokens.manager}`);
      expect(submit.status).toBe(200);
    }

    // Taslak (gönderilmemiş) değerlendirme — geçmişte GÖRÜNMEMELİ.
    const draftPeriod = await prisma.evaluationPeriod.create({ data: { label: "vt_taslak", startDate: new Date("2026-10-01"), endDate: new Date("2026-12-31") } });
    ctx.track("evaluationPeriod", draftPeriod.id);
    const draft = await api()
      .post("/evaluations")
      .set("Authorization", `Bearer ${tokens.manager}`)
      .send({ targetStaffId: member.staffId, periodId: draftPeriod.id, scores: [{ criterionId: criterion.id, score: 5 }] });
    expect(draft.status).toBe(201);
  });

  afterAll(() => ctx.cleanup());

  it("MANAGER: kronolojik 3 nokta, taslak yok, ortalama ve delta doğru, evaluator görünür", async () => {
    const res = await api().get(`/evaluations/staff/${member.staffId}/history`).set("Authorization", `Bearer ${tokens.manager}`);
    expect(res.status).toBe(200);
    expect(res.body.data.map((d: { periodLabel: string }) => d.periodLabel)).toEqual(["vt_2026-Q1", "vt_2026-Q2", "vt_2026-Q3"]);
    expect(res.body.data.map((d: { averageScore: number }) => d.averageScore)).toEqual([12, 15, 19]);
    expect(res.body.data.map((d: { achievementTier: string | null }) => d.achievementTier)).toEqual(["BRONZE", "SILVER", "GOLD"]);
    expect(res.body.overallAverage).toBeCloseTo(15.33, 1);
    expect(res.body.lastDelta).toBe(4);
    expect(res.body.data[0].evaluatorUserId).toBe(manager.id);
    expect(res.body.data[0].evaluator.fullName).toBeTruthy();
  });

  it("STAFF kendi geçmişini görür; evaluator alanları YOK; başkasının geçmişi 403", async () => {
    const own = await api().get(`/evaluations/staff/${member.staffId}/history`).set("Authorization", `Bearer ${tokens.member}`);
    expect(own.status).toBe(200);
    expect(own.body.data).toHaveLength(3);
    for (const d of own.body.data) {
      expect(d).not.toHaveProperty("evaluatorUserId");
      expect(d).not.toHaveProperty("evaluator");
      expect(d.averageScore).toBeGreaterThan(0);
    }

    const foreign = await api().get(`/evaluations/staff/${member.staffId}/history`).set("Authorization", `Bearer ${tokens.other}`);
    expect(foreign.status).toBe(403);
  });

  it("hiç değerlendirmesi olmayan personel: boş liste, ortalama/delta null; olmayan personel 404", async () => {
    const res = await api().get(`/evaluations/staff/${other.staffId}/history`).set("Authorization", `Bearer ${tokens.manager}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.overallAverage).toBeNull();
    expect(res.body.lastDelta).toBeNull();

    const missing = await api().get("/evaluations/staff/00000000-0000-4000-8000-000000000000/history").set("Authorization", `Bearer ${tokens.manager}`);
    expect(missing.status).toBe(404);
  });
});

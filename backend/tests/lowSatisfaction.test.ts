import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { api, TestContext, type TestUser } from "./helpers/fixtures";

/**
 * Bölüm AG (7. tur): Düşük memnuniyet uyarısı.
 * - rating ≤ 2 → OWNER ve MANAGER'a low_satisfaction bildirimi (müşteri adı + iş türü + puan)
 * - rating ≥ 3 → bildirim YOK
 * - detaylı geri bildirimde wouldRecommend=false → bildirim; true → yok
 */
describe("Düşük memnuniyet uyarısı", () => {
  const ctx = new TestContext();
  let owner: TestUser;
  let manager: TestUser;
  let customerUser: TestUser;
  let customerId: string;
  const tokens: Record<string, string> = {};

  beforeAll(async () => {
    owner = await ctx.createUser(Role.OWNER);
    manager = await ctx.createUser(Role.MANAGER);
    customerUser = await ctx.createUser(Role.CUSTOMER);
    customerId = (await ctx.createCustomer({ userId: customerUser.id, fullName: "vt_Memnuniyet Müşterisi" })).id;
    tokens.customer = await ctx.tokenFor(customerUser);
  });

  afterAll(() => ctx.cleanup());

  const completedJob = () => ctx.createJob({ customerId, status: "COMPLETED", completedAt: new Date(), serviceType: "vt_Kemirgen" });
  const lowNotifs = (userId: string, jobId: string) => prisma.notification.findMany({ where: { userId, type: "low_satisfaction", relatedId: jobId } });

  it("puan 2 → OWNER ve MANAGER bildirim alır (müşteri + iş + puan)", async () => {
    const job = await completedJob();
    const res = await api().patch(`/jobs/${job.id}/rate`).set("Authorization", `Bearer ${tokens.customer}`).send({ rating: 2 });
    expect(res.status).toBe(200);
    const o = await lowNotifs(owner.id, job.id);
    const m = await lowNotifs(manager.id, job.id);
    expect(o).toHaveLength(1);
    expect(m).toHaveLength(1);
    expect(o[0].title).toBe("Düşük memnuniyet");
    expect(o[0].body).toContain("vt_Memnuniyet Müşterisi");
    expect(o[0].body).toContain("vt_Kemirgen");
    expect(o[0].body).toContain("puan: 2/5");
  });

  it("puan 3 ve 5 → bildirim yok", async () => {
    for (const rating of [3, 5]) {
      const job = await completedJob();
      const res = await api().patch(`/jobs/${job.id}/rate`).set("Authorization", `Bearer ${tokens.customer}`).send({ rating });
      expect(res.status).toBe(200);
      expect(await lowNotifs(owner.id, job.id)).toHaveLength(0);
    }
  });

  it("detaylı geri bildirim: tavsiye etmiyor → bildirim (kriter puanları özetli); tavsiye ediyor → yok", async () => {
    const bad = await completedJob();
    const r1 = await api()
      .patch(`/jobs/${bad.id}/feedback`)
      .set("Authorization", `Bearer ${tokens.customer}`)
      .send({ serviceQualityScore: 2, punctualityScore: 3, staffProfessionalismScore: 4, wouldRecommend: false });
    expect(r1.status).toBe(200);
    const n = await lowNotifs(owner.id, bad.id);
    expect(n).toHaveLength(1);
    expect(n[0].body).toContain("tavsiye etmiyor");
    expect(n[0].body).toContain("kalite 2");

    const good = await completedJob();
    const r2 = await api()
      .patch(`/jobs/${good.id}/feedback`)
      .set("Authorization", `Bearer ${tokens.customer}`)
      .send({ serviceQualityScore: 5, punctualityScore: 5, staffProfessionalismScore: 5, wouldRecommend: true });
    expect(r2.status).toBe(200);
    expect(await lowNotifs(owner.id, good.id)).toHaveLength(0);
  });
});

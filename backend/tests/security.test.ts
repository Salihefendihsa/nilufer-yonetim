import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { api, TestContext, type TestUser } from "./helpers/fixtures";

/**
 * Güvenlik kritiği:
 * - Impersonation OWNER'ı hedefleyemez; sonlandırılan oturumun token'ı ölür.
 * - TEAM_LEAD yalnızca kendi ekibini görür; ekip dışı personel 403.
 * - salaryBase STAFF/TEAM_LEAD yanıtlarında YOK; OWNER/MANAGER'da var.
 * - Evaluator kimliği (evaluatorUserId/evaluator) STAFF/TEAM_LEAD'e sızmaz.
 */
describe("Güvenlik kritiği", () => {
  const ctx = new TestContext();
  let owner: TestUser;
  let manager: TestUser;
  let lead: TestUser;
  let member: TestUser;
  let outsider: TestUser;
  let tokens: Record<"owner" | "manager" | "lead" | "member" | "outsider", string>;

  beforeAll(async () => {
    owner = await ctx.createUser(Role.OWNER);
    manager = await ctx.createUser(Role.MANAGER);
    lead = await ctx.createStaffUser(Role.TEAM_LEAD, { salaryBase: 30000 });
    member = await ctx.createStaffUser(Role.STAFF, { supervisorId: lead.staffId, salaryBase: 15000, tag: "member" });
    outsider = await ctx.createStaffUser(Role.STAFF, { salaryBase: 16000, tag: "outsider" });
    tokens = {
      owner: await ctx.tokenFor(owner),
      manager: await ctx.tokenFor(manager),
      lead: await ctx.tokenFor(lead),
      member: await ctx.tokenFor(member),
      outsider: await ctx.tokenFor(outsider),
    };
  });

  afterAll(() => ctx.cleanup());

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  describe("impersonation", () => {
    it("OWNER başka bir OWNER'ı impersonate edemez (403); STAFF'ı edebilir ve oturum sonlandırılınca token ölür", async () => {
      const otherOwner = await ctx.createUser(Role.OWNER, { tag: "owner2" });
      const blocked = await api()
        .post("/admin/impersonate")
        .set(auth(tokens.owner))
        .send({ targetUserId: otherOwner.id, reason: "vt" });
      expect(blocked.status).toBe(403);
      expect(await prisma.impersonationSession.count({ where: { targetUserId: otherOwner.id } })).toBe(0);

      const ok = await api()
        .post("/admin/impersonate")
        .set(auth(tokens.owner))
        .send({ targetUserId: member.id, reason: "vt_destek" });
      expect(ok.status).toBe(201);
      const impToken = ok.body.token as string;
      expect(ok.body.user.id).toBe(member.id);

      // Impersonation token'ı hedef kullanıcı olarak çalışır — OWNER uçlarına ERİŞEMEZ.
      const me = await api().get("/auth/me").set(auth(impToken));
      expect(me.status).toBe(200);
      expect(me.body.id).toBe(member.id);
      expect((await api().get("/audit-logs").set(auth(impToken))).status).toBe(403);

      const end = await api().post("/admin/impersonate/end").set(auth(impToken));
      expect(end.status).toBe(200);
      expect((await api().get("/auth/me").set(auth(impToken))).status).toBe(401);
    });

    it("MANAGER impersonate başlatamaz (403)", async () => {
      const res = await api()
        .post("/admin/impersonate")
        .set(auth(tokens.manager))
        .send({ targetUserId: member.id, reason: "vt" });
      expect(res.status).toBe(403);
    });
  });

  describe("TEAM_LEAD ekip kapsamı", () => {
    it("liste yalnızca kendi ekibini içerir; ekip dışı personel detayı 403", async () => {
      const list = await api().get("/staff?limit=100").set(auth(tokens.lead));
      expect(list.status).toBe(200);
      const ids = list.body.data.map((s: { id: string }) => s.id);
      expect(ids).toContain(lead.staffId);
      expect(ids).toContain(member.staffId);
      expect(ids).not.toContain(outsider.staffId);

      expect((await api().get(`/staff/${member.staffId}`).set(auth(tokens.lead))).status).toBe(200);
      expect((await api().get(`/staff/${outsider.staffId}`).set(auth(tokens.lead))).status).toBe(403);
    });

    it("TEAM_LEAD ekip dışı bir işi yeniden atayamaz, ekip dışı birine atayamaz", async () => {
      const customer = await ctx.createCustomer();
      const foreignJob = await ctx.createJob({ customerId: customer.id, assignedStaffId: outsider.staffId });
      const foreign = await api()
        .patch(`/jobs/${foreignJob.id}`)
        .set(auth(tokens.lead))
        .send({ assignedStaffId: member.staffId });
      expect(foreign.status).toBe(403);

      const teamJob = await ctx.createJob({ customerId: customer.id, assignedStaffId: member.staffId });
      const toOutsider = await api()
        .patch(`/jobs/${teamJob.id}`)
        .set(auth(tokens.lead))
        .send({ assignedStaffId: outsider.staffId });
      expect(toOutsider.status).toBe(400);
      expect((await prisma.job.findUniqueOrThrow({ where: { id: teamJob.id } })).assignedStaffId).toBe(member.staffId);
    });

    it("STAFF yalnızca kendi kaydını görür; başkasının detayı 403", async () => {
      const list = await api().get("/staff?limit=100").set(auth(tokens.member));
      expect(list.status).toBe(200);
      expect(list.body.data.map((s: { id: string }) => s.id)).toEqual([member.staffId]);
      expect((await api().get(`/staff/${outsider.staffId}`).set(auth(tokens.member))).status).toBe(403);
    });
  });

  describe("maaş alanı sızıntısı", () => {
    it("salaryBase STAFF/TEAM_LEAD yanıtlarında yok, OWNER/MANAGER'da var (liste + detay)", async () => {
      for (const t of [tokens.lead, tokens.member]) {
        const list = await api().get("/staff?limit=100").set(auth(t));
        expect(list.status).toBe(200);
        for (const row of list.body.data) expect(row).not.toHaveProperty("salaryBase");
      }
      const leadDetail = await api().get(`/staff/${member.staffId}`).set(auth(tokens.lead));
      expect(leadDetail.status).toBe(200);
      expect(leadDetail.body).not.toHaveProperty("salaryBase");
      const selfDetail = await api().get(`/staff/${member.staffId}`).set(auth(tokens.member));
      expect(selfDetail.body).not.toHaveProperty("salaryBase");

      for (const t of [tokens.owner, tokens.manager]) {
        const detail = await api().get(`/staff/${member.staffId}`).set(auth(t));
        expect(detail.status).toBe(200);
        expect(Number(detail.body.salaryBase)).toBe(15000);
      }
    });
  });

  describe("değerlendirici kimliği sızıntısı", () => {
    it("STAFF/TEAM_LEAD kendi değerlendirmesini görür ama evaluatorUserId/evaluator alanları yok; MANAGER görür", async () => {
      const period = await prisma.evaluationPeriod.create({
        data: { label: "vt_sec_donem", startDate: new Date(), endDate: new Date() },
      });
      ctx.track("evaluationPeriod", period.id);
      const criterion = await prisma.evaluationCriterion.create({ data: { name: "vt_sec_kriter" } });
      ctx.track("evaluationCriterion", criterion.id);

      const create = await api()
        .post("/evaluations")
        .set(auth(tokens.manager))
        .send({ targetStaffId: member.staffId, periodId: period.id, scores: [{ criterionId: criterion.id, score: 15 }] });
      expect(create.status).toBe(201);
      expect(create.body.evaluatorUserId).toBe(manager.id);
      const evaluationId = create.body.id as string;

      const asMember = await api().get(`/evaluations/${evaluationId}`).set(auth(tokens.member));
      expect(asMember.status).toBe(200);
      expect(asMember.body).not.toHaveProperty("evaluatorUserId");
      expect(asMember.body).not.toHaveProperty("evaluator");
      expect(asMember.body.averageScore).toBe(15);

      const listAsMember = await api().get("/evaluations").set(auth(tokens.member));
      expect(listAsMember.status).toBe(200);
      for (const e of listAsMember.body.data) {
        expect(e).not.toHaveProperty("evaluatorUserId");
        expect(e).not.toHaveProperty("evaluator");
      }

      // TEAM_LEAD, ekibindeki üyenin değerlendirmesini de başkası adına sorgulayamaz.
      const leadList = await api().get(`/evaluations?targetStaffId=${member.staffId}`).set(auth(tokens.lead));
      expect(leadList.status).toBe(403);

      const asManager = await api().get(`/evaluations/${evaluationId}`).set(auth(tokens.manager));
      expect(asManager.body.evaluatorUserId).toBe(manager.id);
      expect(asManager.body.evaluator?.id).toBe(manager.id);
    });
  });
});

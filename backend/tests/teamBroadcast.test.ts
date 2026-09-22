import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { api, TestContext, type TestUser } from "./helpers/fixtures";

/**
 * Bölüm L (4. tur): Şef → ekibe toplu duyuru (POST /team/broadcast).
 * Ekipteki HER üye ayrı bir team_broadcast bildirimi + mesaj alır; ekip dışı
 * personel ve şefin kendisi almaz. Yalnızca TEAM_LEAD; ekibi yoksa 400.
 */
describe("Ekip duyurusu (/team/broadcast)", () => {
  const ctx = new TestContext();
  let lead: TestUser;
  let memberA: TestUser;
  let memberB: TestUser;
  let outsider: TestUser;
  let lonelyLead: TestUser;
  let owner: TestUser;
  let staff: TestUser;
  const tokens: Record<string, string> = {};

  beforeAll(async () => {
    lead = await ctx.createStaffUser(Role.TEAM_LEAD, { tag: "lead" });
    memberA = await ctx.createStaffUser(Role.STAFF, { supervisorId: lead.staffId, tag: "a" });
    memberB = await ctx.createStaffUser(Role.STAFF, { supervisorId: lead.staffId, tag: "b" });
    outsider = await ctx.createStaffUser(Role.STAFF, { tag: "out" });
    lonelyLead = await ctx.createStaffUser(Role.TEAM_LEAD, { tag: "lonely" });
    owner = await ctx.createUser(Role.OWNER);
    staff = outsider;
    for (const [k, u] of Object.entries({ lead, memberA, memberB, outsider, lonelyLead, owner, staff })) {
      tokens[k] = await ctx.tokenFor(u);
    }
  });

  afterAll(() => ctx.cleanup());

  const as = (k: string) => `Bearer ${tokens[k]}`;

  it("TEAM_LEAD duyuru gönderir: ekipteki her üye bildirim + mesaj alır, ekip dışı ve şef almaz", async () => {
    const text = `Yarın 08:00 depo önünde toplanıyoruz ${lead.staffId!.slice(0, 6)}`;
    const res = await api().post("/team/broadcast").set("Authorization", as("lead")).send({ message: text });
    expect(res.status).toBe(201);
    expect(res.body.recipientCount).toBe(2);

    for (const m of [memberA, memberB]) {
      const notif = await prisma.notification.findFirst({ where: { userId: m.id, type: "team_broadcast", body: text } });
      expect(notif, `bildirim ${m.email}`).not.toBeNull();
      expect(notif!.relatedId).toBe(lead.id);
      const msg = await prisma.message.findFirst({ where: { senderId: lead.id, content: text, conversation: { OR: [{ participantAId: m.id }, { participantBId: m.id }] } } });
      expect(msg, `mesaj ${m.email}`).not.toBeNull();
    }

    const outsiderNotif = await prisma.notification.findFirst({ where: { userId: outsider.id, type: "team_broadcast", body: text } });
    expect(outsiderNotif).toBeNull();
    const selfNotif = await prisma.notification.findFirst({ where: { userId: lead.id, type: "team_broadcast", body: text } });
    expect(selfNotif).toBeNull();

    const audit = await prisma.auditLog.findFirst({ where: { actorUserId: lead.id, action: "conversation.team_broadcast" } });
    expect(audit).not.toBeNull();
  });

  it("`content` alanı da kabul edilir; boş metin 400", async () => {
    const ok = await api().post("/team/broadcast").set("Authorization", as("lead")).send({ content: "Kısa not" });
    expect(ok.status).toBe(201);
    const empty = await api().post("/team/broadcast").set("Authorization", as("lead")).send({ message: "   " });
    expect(empty.status).toBe(400);
    const none = await api().post("/team/broadcast").set("Authorization", as("lead")).send({});
    expect(none.status).toBe(400);
  });

  it("ekibi olmayan TEAM_LEAD 400", async () => {
    const res = await api().post("/team/broadcast").set("Authorization", as("lonelyLead")).send({ message: "x" });
    expect(res.status).toBe(400);
  });

  it("OWNER ve STAFF /team/broadcast'e giremez (403)", async () => {
    for (const k of ["owner", "staff"]) {
      const res = await api().post("/team/broadcast").set("Authorization", as(k)).send({ message: "x" });
      expect(res.status, k).toBe(403);
    }
  });
});

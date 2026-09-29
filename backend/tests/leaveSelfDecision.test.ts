import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LeaveRequestStatus, Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { api, localIsoDate, TestContext, type TestUser } from "./helpers/fixtures";

/** Şef kendi izin talebini karara bağlayamaz; ekip üyesininkini ve OWNER/MANAGER akışı korunur. */
describe("İzin kararı — şefin kendi talebi", () => {
  const ctx = new TestContext();
  let lead: TestUser;
  let member: TestUser;
  let manager: TestUser;
  let owner: TestUser;
  let leadToken: string;
  let memberToken: string;
  let managerToken: string;
  let ownerToken: string;
  let day = 20;

  beforeAll(async () => {
    lead = await ctx.createStaffUser(Role.TEAM_LEAD);
    member = await ctx.createStaffUser(Role.STAFF, { supervisorId: lead.staffId });
    manager = await ctx.createUser(Role.MANAGER);
    owner = await ctx.createUser(Role.OWNER);
    [leadToken, memberToken, managerToken, ownerToken] = await Promise.all([lead, member, manager, owner].map((u) => ctx.tokenFor(u)));
  });

  afterAll(() => ctx.cleanup());

  async function request(token: string) {
    const start = day;
    day += 5; // çakışmayan aralıklar
    const res = await api().post("/leave-requests").set("Authorization", `Bearer ${token}`).send({ startDate: localIsoDate(start), endDate: localIsoDate(start + 2), reason: "vt_izin" });
    expect(res.status).toBe(201);
    return res.body.id as string;
  }
  const decide = (token: string, id: string, status: "APPROVED" | "REJECTED") =>
    api().patch(`/leave-requests/${id}/decide`).set("Authorization", `Bearer ${token}`).send({ status });
  const statusOf = async (id: string) => (await prisma.leaveRequest.findUniqueOrThrow({ where: { id } })).status;

  it.each(["APPROVED", "REJECTED"] as const)("şef kendi talebini %s yapamaz: 403, talep PENDING kalır", async (status) => {
    const id = await request(leadToken);
    const res = await decide(leadToken, id, status);
    expect(res.status).toBe(403);
    expect(await statusOf(id)).toBe(LeaveRequestStatus.PENDING);
    const row = await prisma.leaveRequest.findUniqueOrThrow({ where: { id } });
    expect(row.decidedByUserId).toBeNull();
    expect(row.decidedAt).toBeNull();
  });

  it("şef ekip üyesinin talebini onaylayabilir ve reddedebilir", async () => {
    const a = await request(memberToken);
    const b = await request(memberToken);
    expect((await decide(leadToken, a, "APPROVED")).status).toBe(200);
    expect((await decide(leadToken, b, "REJECTED")).status).toBe(200);
    expect(await statusOf(a)).toBe(LeaveRequestStatus.APPROVED);
    expect(await statusOf(b)).toBe(LeaveRequestStatus.REJECTED);
  });

  it("şef, ekibi dışındaki personelin talebine hâlâ 403 alır", async () => {
    const outsider = await ctx.createStaffUser(Role.STAFF, { tag: "outsider" });
    const id = await request(await ctx.tokenFor(outsider));
    expect((await decide(leadToken, id, "APPROVED")).status).toBe(403);
    expect(await statusOf(id)).toBe(LeaveRequestStatus.PENDING);
  });

  it("MANAGER ve OWNER onay/ret akışı bozulmaz (şefin talebi dahil)", async () => {
    const leadOwn = await request(leadToken);
    const memberReq = await request(memberToken);
    expect((await decide(managerToken, leadOwn, "APPROVED")).status).toBe(200);
    expect((await decide(ownerToken, memberReq, "REJECTED")).status).toBe(200);
    expect(await statusOf(leadOwn)).toBe(LeaveRequestStatus.APPROVED);
    expect(await statusOf(memberReq)).toBe(LeaveRequestStatus.REJECTED);
  });
});

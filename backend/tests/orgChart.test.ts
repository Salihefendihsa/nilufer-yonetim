import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { api, TestContext, TEST_PREFIX, type TestUser } from "./helpers/fixtures";

interface Node {
  id: string;
  userId: string;
  role: string;
  children?: Node[];
}

function findPath(nodes: Node[], userId: string, path: string[] = []): string[] | null {
  for (const n of nodes) {
    const here = [...path, n.userId];
    if (n.userId === userId) return here;
    const found = findPath(n.children ?? [], userId, here);
    if (found) return found;
  }
  return null;
}

/**
 * Organizasyon şeması: şefsiz TEAM_LEAD'ler ekipleriyle patronun altında
 * görünür; müdürün Staff satırı ayrı/mükerrer düğüm olmaz; bağlantısız
 * STAFF'ın ekibi de yanıtta kaybolmaz.
 */
describe("GET /staff/org-chart hiyerarşisi", () => {
  const ctx = new TestContext();
  let owner: TestUser;
  let manager: TestUser;
  let lead: TestUser;
  let member: TestUser;
  let orphan: TestUser;
  let managerStaffId: string;
  let managerReport: TestUser;
  let token: string;

  beforeAll(async () => {
    owner = await ctx.createUser(Role.OWNER);
    manager = await ctx.createUser(Role.MANAGER);
    const mStaff = await prisma.staff.create({ data: { userId: manager.id, position: `${TEST_PREFIX}müdür`, salaryBase: 0 } });
    managerStaffId = mStaff.id;
    ctx.track("staff", mStaff.id);
    lead = await ctx.createStaffUser(Role.TEAM_LEAD, { tag: "lead" });
    member = await ctx.createStaffUser(Role.STAFF, { tag: "member", supervisorId: lead.staffId });
    orphan = await ctx.createStaffUser(Role.STAFF, { tag: "orphan" });
    // Müdürün Staff.id'sine bağlanmış biri → müdür (User) düğümünün altında görünmeli.
    managerReport = await ctx.createStaffUser(Role.STAFF, { tag: "mrep", supervisorId: managerStaffId });
    token = await ctx.tokenFor(owner);
  });

  afterAll(() => ctx.cleanup());

  it("şefsiz TEAM_LEAD ve ekibi patronun altında; müdür tek düğüm; bağlantısız STAFF listede", async () => {
    const res = await api().get("/staff/org-chart").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    const tree = res.body.tree as Node[];
    const unassigned = res.body.unassigned as Node[];

    const leadPath = findPath(tree, lead.id);
    expect(leadPath?.length).toBe(2); // patron → şef
    expect(findPath(tree, member.id)?.slice(-2)).toEqual([lead.id, member.id]);

    expect(unassigned.map((u) => u.userId)).not.toContain(lead.id);
    expect(unassigned.map((u) => u.userId)).not.toContain(manager.id); // mükerrer değil
    expect(unassigned.map((u) => u.userId)).toContain(orphan.id);

    expect(findPath(tree, managerReport.id)?.slice(-2)).toEqual([manager.id, managerReport.id]);
  });
});

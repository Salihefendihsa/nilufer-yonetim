import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { JobStatus, Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { api, TestContext, type TestUser } from "./helpers/fixtures";

/**
 * Panel kartlarından liste ekranlarına filtreli geçiş (mobil Ana Sayfa /
 * Yönetici Özeti / Bekleyen Onaylar → avans kartı) için eklenen sorgu
 * parametreleri.
 */
describe("Panel kartı drill-down filtreleri", () => {
  const ctx = new TestContext();
  let manager: TestUser;
  let staffA: TestUser;
  let staffB: TestUser;
  let managerToken: string;
  let staffToken: string;
  let customerId: string;

  beforeAll(async () => {
    manager = await ctx.createUser(Role.MANAGER);
    staffA = await ctx.createStaffUser(Role.STAFF, { tag: "a" });
    staffB = await ctx.createStaffUser(Role.STAFF, { tag: "b" });
    managerToken = await ctx.tokenFor(manager);
    staffToken = await ctx.tokenFor(staffA);
    customerId = (await ctx.createCustomer()).id;
  });

  afterAll(() => ctx.cleanup());

  it("GET /jobs?dateField=completedAt aralığı tamamlanma tarihine uygular (scheduledAt'e değil)", async () => {
    const lastYear = new Date("2020-01-10T10:00:00Z");
    const inRange = new Date("2031-05-15T10:00:00Z");
    // Planlama tarihi aralık dışında, tamamlanma aralık içinde:
    const job = await ctx.createJob({
      customerId,
      status: JobStatus.COMPLETED,
      scheduledAt: lastYear,
      completedAt: inRange,
    });

    const from = "2031-05-01T00:00:00.000Z";
    const to = "2031-05-31T23:59:59.999Z";
    const byCompleted = await api()
      .get("/jobs")
      .query({ from, to, dateField: "completedAt", status: "COMPLETED", customerId })
      .set("Authorization", `Bearer ${managerToken}`);
    expect(byCompleted.status).toBe(200);
    expect(byCompleted.body.data.map((j: { id: string }) => j.id)).toContain(job.id);

    // Varsayılan (scheduledAt) aynı aralıkta bu işi bulmaz.
    const byScheduled = await api()
      .get("/jobs")
      .query({ from, to, status: "COMPLETED", customerId })
      .set("Authorization", `Bearer ${managerToken}`);
    expect(byScheduled.body.data.map((j: { id: string }) => j.id)).not.toContain(job.id);
  });

  it("GET /advances?staffId= yönetim için tek personele daraltır; STAFF parametreyle başkasını göremez", async () => {
    const a = await prisma.advanceRequest.create({
      data: { staffId: staffA.staffId!, amount: 500, reason: "vt_a" },
    });
    const b = await prisma.advanceRequest.create({
      data: { staffId: staffB.staffId!, amount: 700, reason: "vt_b" },
    });
    ctx.track("advanceRequest", a.id);
    ctx.track("advanceRequest", b.id);

    const res = await api()
      .get("/advances")
      .query({ staffId: staffA.staffId })
      .set("Authorization", `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    const ids = res.body.data.map((x: { id: string }) => x.id);
    expect(ids).toContain(a.id);
    expect(ids).not.toContain(b.id);

    // STAFF her zaman yalnızca kendi kayıtlarını görür — staffId yok sayılır.
    const asStaff = await api()
      .get("/advances")
      .query({ staffId: staffB.staffId })
      .set("Authorization", `Bearer ${staffToken}`);
    const staffIds = asStaff.body.data.map((x: { id: string }) => x.id);
    expect(staffIds).toContain(a.id);
    expect(staffIds).not.toContain(b.id);
  });
});

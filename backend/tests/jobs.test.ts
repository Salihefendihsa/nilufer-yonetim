import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { JobStatus, Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { api, TestContext, type TestUser } from "./helpers/fixtures";

/**
 * İş durumu state machine (jobsController.ts:VALID_TRANSITIONS) ve
 * iyimser kilit (applyJobUpdate → updateMany where status=eski durum).
 */
describe("İş durumu state machine", () => {
  const ctx = new TestContext();
  let manager: TestUser;
  let staff: TestUser;
  let otherStaff: TestUser;
  let managerToken: string;
  let staffToken: string;
  let customerId: string;

  beforeAll(async () => {
    manager = await ctx.createUser(Role.MANAGER);
    staff = await ctx.createStaffUser(Role.STAFF);
    otherStaff = await ctx.createStaffUser(Role.STAFF, { tag: "other" });
    managerToken = await ctx.tokenFor(manager);
    staffToken = await ctx.tokenFor(staff);
    customerId = (await ctx.createCustomer()).id;
  });

  afterAll(() => ctx.cleanup());

  async function patchStatus(token: string, jobId: string, status: JobStatus, extra: Record<string, unknown> = {}) {
    return api().patch(`/jobs/${jobId}`).set("Authorization", `Bearer ${token}`).send({ status, ...extra });
  }

  it("geçerli zincir: PENDING → SCHEDULED → IN_PROGRESS → COMPLETED, zaman damgaları yalnızca geçiş anında basılır", async () => {
    const job = await ctx.createJob({ customerId, assignedStaffId: staff.staffId, status: JobStatus.PENDING });

    expect((await patchStatus(managerToken, job.id, JobStatus.SCHEDULED)).status).toBe(200);
    const inProgress = await patchStatus(staffToken, job.id, JobStatus.IN_PROGRESS);
    expect(inProgress.status).toBe(200);
    expect(inProgress.body.startedAt).not.toBeNull();
    expect(inProgress.body.completedAt).toBeNull();

    const completed = await patchStatus(staffToken, job.id, JobStatus.COMPLETED);
    expect(completed.status).toBe(200);
    expect(completed.body.completedAt).not.toBeNull();

    // Aynı duruma tekrar geçiş idempotent: 200, completedAt değişmez.
    const again = await patchStatus(staffToken, job.id, JobStatus.COMPLETED);
    expect(again.status).toBe(200);
    expect(again.body.completedAt).toBe(completed.body.completedAt);
  });

  it("geçersiz geçişler 400 ile reddedilir (COMPLETED → IN_PROGRESS, CANCELLED → PENDING, PENDING → COMPLETED)", async () => {
    const done = await ctx.createJob({ customerId, assignedStaffId: staff.staffId, status: JobStatus.COMPLETED });
    const cancelled = await ctx.createJob({ customerId, assignedStaffId: staff.staffId, status: JobStatus.CANCELLED });
    const pending = await ctx.createJob({ customerId, assignedStaffId: staff.staffId, status: JobStatus.PENDING });

    expect((await patchStatus(managerToken, done.id, JobStatus.IN_PROGRESS)).status).toBe(400);
    expect((await patchStatus(managerToken, cancelled.id, JobStatus.PENDING)).status).toBe(400);
    expect((await patchStatus(managerToken, pending.id, JobStatus.COMPLETED)).status).toBe(400);
    expect((await patchStatus(staffToken, pending.id, JobStatus.COMPLETED)).status).toBe(400);

    // Reddedilen geçişler DB'ye dokunmadı.
    const fresh = await prisma.job.findUniqueOrThrow({ where: { id: pending.id } });
    expect(fresh.status).toBe(JobStatus.PENDING);
  });

  it("STAFF yalnızca kendine atanmış işin durumunu değiştirebilir", async () => {
    const job = await ctx.createJob({ customerId, assignedStaffId: otherStaff.staffId, status: JobStatus.SCHEDULED });
    const res = await patchStatus(staffToken, job.id, JobStatus.IN_PROGRESS);
    expect(res.status).toBe(403);
  });

  it("iyimser kilit: aynı işe eşzamanlı COMPLETED ve CANCELLED isteklerinden yalnızca biri uygulanır", async () => {
    const job = await ctx.createJob({ customerId, assignedStaffId: staff.staffId, status: JobStatus.IN_PROGRESS });

    const [a, b] = await Promise.all([
      patchStatus(managerToken, job.id, JobStatus.COMPLETED),
      patchStatus(managerToken, job.id, JobStatus.CANCELLED, { cancellationReason: "vt_test" }),
    ]);

    const statuses = [a.status, b.status];
    // Kazanan 200; kaybeden ya 409 (yarış kilide takıldı) ya da 400 (ilk
    // istek tamamen bitmişse ikinci artık geçersiz bir geçiş görür).
    expect(statuses.filter((s) => s === 200)).toHaveLength(1);
    expect(statuses.filter((s) => s === 400 || s === 409)).toHaveLength(1);

    const fresh = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });
    const winner = a.status === 200 ? a : b;
    expect(fresh.status).toBe(winner.body.status);
    // İki zaman damgası birden basılmadı — yalnızca kazanan geçişinki.
    expect(fresh.completedAt !== null && fresh.cancelledAt !== null).toBe(false);
  });

  it("iyimser kilit (deterministik): DB'de durum el altından değişmişse eski duruma dayalı güncelleme 409 döner", async () => {
    // updateMany({ where: { id, status: fromStatus } }) sözleşmesini doğrudan
    // doğrular — controller'ın dayandığı tek koruma bu.
    const job = await ctx.createJob({ customerId, assignedStaffId: staff.staffId, status: JobStatus.IN_PROGRESS });
    await prisma.job.update({ where: { id: job.id }, data: { status: JobStatus.CANCELLED, cancelledAt: new Date() } });

    const result = await prisma.job.updateMany({
      where: { id: job.id, status: JobStatus.IN_PROGRESS },
      data: { status: JobStatus.COMPLETED, completedAt: new Date() },
    });
    expect(result.count).toBe(0);

    const fresh = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(fresh.status).toBe(JobStatus.CANCELLED);
    expect(fresh.completedAt).toBeNull();
  });

  it("MANAGER durum değişikliği olmadan diğer alanları serbestçe günceller", async () => {
    const job = await ctx.createJob({ customerId, status: JobStatus.COMPLETED });
    const res = await api()
      .patch(`/jobs/${job.id}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ notes: "vt_not", price: 1234 });
    expect(res.status).toBe(200);
    expect(res.body.notes).toBe("vt_not");
    expect(Number(res.body.price)).toBe(1234);
    expect(res.body.status).toBe(JobStatus.COMPLETED);
  });
});

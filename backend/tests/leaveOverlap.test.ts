import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LeaveRequestStatus, Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { computeLeaveBalance } from "../src/lib/leaveBalance";
import { api, localIsoDate, TestContext, type TestUser } from "./helpers/fixtures";

/**
 * HEALTH_AUDIT V-6: aynı personel için çakışan onaylı izin
 * - oluşturulamaz (409), onaylanamaz (409);
 * - eski veride varsa bakiye aynı günü iki kez DÜŞMEZ (gün kümesi).
 */
describe("İzin çakışması", () => {
  const ctx = new TestContext();
  let staff: TestUser;
  let manager: TestUser;
  let staffToken: string;
  let managerToken: string;
  let staffId: string;

  beforeAll(async () => {
    staff = await ctx.createStaffUser(Role.STAFF);
    manager = await ctx.createUser(Role.MANAGER);
    staffToken = await ctx.tokenFor(staff);
    managerToken = await ctx.tokenFor(manager);
    staffId = (await prisma.staff.findUniqueOrThrow({ where: { userId: staff.id } })).id;
  });

  afterAll(() => ctx.cleanup());

  const create = (start: number, end: number) =>
    api().post("/leave-requests").set("Authorization", `Bearer ${staffToken}`).send({ startDate: localIsoDate(start), endDate: localIsoDate(end), reason: "vt_izin" });
  const decide = (id: string, status: "APPROVED" | "REJECTED") =>
    api().patch(`/leave-requests/${id}/decide`).set("Authorization", `Bearer ${managerToken}`).send({ status });

  it("onaylı izinle çakışan yeni talep 409; çakışmayan talep kabul", async () => {
    const a = await create(10, 12);
    expect(a.status).toBe(201);
    // A onaylanmadan önce açılan, A ile çakışan talep (bekliyor) — onaylanamamalı
    const pendingOverlap = await create(11, 13);
    expect(pendingOverlap.status).toBe(201);
    expect((await decide(a.body.id, "APPROVED")).status).toBe(200);

    const overlap = await create(12, 14);
    expect(overlap.status).toBe(409);
    expect(overlap.body.error).toMatch(/çakışan/);

    const separate = await create(20, 21);
    expect(separate.status).toBe(201);

    // Çakışan bekleyen talep onaylanamaz; reddedilebilir.
    const approveOverlap = await decide(pendingOverlap.body.id, "APPROVED");
    expect(approveOverlap.status).toBe(409);
    expect((await decide(pendingOverlap.body.id, "REJECTED")).status).toBe(200);
  });

  it("eski veride aynı tarihli iki onaylı izin bakiyeden bir kez düşer", async () => {
    const start = new Date(localIsoDate(40));
    const end = new Date(localIsoDate(42));
    for (let i = 0; i < 2; i++) {
      await prisma.leaveRequest.create({ data: { staffId, startDate: start, endDate: end, reason: "vt_eski mükerrer", status: LeaveRequestStatus.APPROVED } });
    }
    const year = start.getFullYear();
    const balance = await computeLeaveBalance(staffId, year);
    const approved = await prisma.leaveRequest.findMany({ where: { staffId, status: LeaveRequestStatus.APPROVED } });
    // 10–12 (3 gün, yıl içindeyse) + 40–42 (3 gün, iki kez kayıtlı) → mükerrer gün sayılmaz
    const days = new Set<string>();
    for (const l of approved) {
      for (let d = new Date(l.startDate); d <= l.endDate; d.setDate(d.getDate() + 1)) {
        if (d.getFullYear() === year) days.add(d.toDateString());
      }
    }
    expect(balance!.usedDays).toBe(days.size);
    expect(balance!.approvedRequestCount).toBe(approved.filter((l) => l.startDate.getFullYear() <= year && l.endDate.getFullYear() >= year).length);
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { expireEndedContracts, generateRecurringJobs } from "../src/lib/cron";
import { findOverdueRecurringContracts } from "../src/controllers/contractsController";
import { TestContext } from "./helpers/fixtures";

/**
 * HEALTH_AUDIT V-4: bitiş tarihi geçmiş sözleşme
 * - gece cron'unda ACTIVE → EXPIRED olur,
 * - periyodik iş ÜRETMEZ (vadesi gelmiş olsa bile),
 * - "otomasyon gecikmesi" olarak raporlanmaz.
 * Yürürlükteki sözleşme ise iş üretmeye devam eder.
 */
describe("Süresi dolan sözleşmeler", () => {
  const ctx = new TestContext();
  const DAY = 24 * 3600 * 1000;
  let customerId: string;
  let expiredId: string;
  let liveId: string;

  beforeAll(async () => {
    const user = await ctx.createUser(Role.CUSTOMER);
    customerId = (await ctx.createCustomer({ userId: user.id })).id;
    const base = { customerId, durationMonths: 12, serviceType: "vt_Periyodik", recurrenceType: "MONTHLY" as const, nextGenerationDate: new Date(Date.now() - 2 * DAY) };
    expiredId = (await prisma.contract.create({ data: { ...base, status: "ACTIVE", startDate: new Date(Date.now() - 400 * DAY), endDate: new Date(Date.now() - 5 * DAY) } })).id;
    liveId = (await prisma.contract.create({ data: { ...base, status: "ACTIVE", startDate: new Date(Date.now() - 30 * DAY), endDate: new Date(Date.now() + 300 * DAY) } })).id;
  });

  afterAll(() => ctx.cleanup());

  it("süresi dolmuş ACTIVE sözleşme gecikme sayılmaz, cron'da iş üretmez; yürürlükteki üretir", async () => {
    const overdue = (await findOverdueRecurringContracts()).map((c) => c.id);
    expect(overdue).not.toContain(expiredId);
    expect(overdue).toContain(liveId);

    const before = await prisma.job.count({ where: { customerId } });
    const generated = await generateRecurringJobs([expiredId, liveId]);
    expect(generated).toBe(1);
    expect(await prisma.job.count({ where: { customerId } })).toBe(before + 1);
    const expired = await prisma.contract.findUniqueOrThrow({ where: { id: expiredId } });
    expect(expired.nextGenerationDate!.getTime()).toBeLessThan(Date.now()); // ilerletilmedi → üretim yapılmadı
  });

  it("expireEndedContracts yalnızca bitişi geçmiş ACTIVE sözleşmeyi EXPIRED yapar", async () => {
    expect(await expireEndedContracts([expiredId, liveId])).toBe(1);
    expect((await prisma.contract.findUniqueOrThrow({ where: { id: expiredId } })).status).toBe("EXPIRED");
    expect((await prisma.contract.findUniqueOrThrow({ where: { id: liveId } })).status).toBe("ACTIVE");
    expect(await expireEndedContracts([expiredId, liveId])).toBe(0); // idempotent
  });
});

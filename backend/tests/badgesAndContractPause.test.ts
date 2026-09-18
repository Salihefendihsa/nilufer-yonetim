import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { achievementTier, isLoyalCustomer, LOYAL_CUSTOMER_THRESHOLD } from "../src/lib/badges";
import { generateRecurringJobs } from "../src/lib/cron";
import { findOverdueRecurringContracts } from "../src/controllers/contractsController";
import { api, TestContext, type TestUser } from "./helpers/fixtures";

/**
 * Bölüm Q (4. tur):
 * - Rozet eşikleri (saf fonksiyon + uçlar): Sadık Müşteri ≥5 tamamlanmış iş;
 *   Altın ≥18 / Gümüş ≥15 / Bronz ≥12 / altı yok
 * - Sözleşme duraklat/devam: CUSTOMER yalnızca kendi sözleşmesi; duraklatılmış
 *   sözleşme için cron iş üretmez ve sağlık kontrolü "gecikmiş" saymaz;
 *   devam ettirince nextGenerationDate geleceğe alınır; audit log
 */
describe("Rozet eşikleri (saf)", () => {
  it("isLoyalCustomer eşiği", () => {
    expect(isLoyalCustomer(LOYAL_CUSTOMER_THRESHOLD - 1)).toBe(false);
    expect(isLoyalCustomer(LOYAL_CUSTOMER_THRESHOLD)).toBe(true);
    expect(isLoyalCustomer(50)).toBe(true);
  });

  it("achievementTier kademeleri", () => {
    expect(achievementTier(null)).toBeNull();
    expect(achievementTier(undefined)).toBeNull();
    expect(achievementTier(11.99)).toBeNull();
    expect(achievementTier(12)).toBe("BRONZE");
    expect(achievementTier(14.9)).toBe("BRONZE");
    expect(achievementTier(15)).toBe("SILVER");
    expect(achievementTier(17.99)).toBe("SILVER");
    expect(achievementTier(18)).toBe("GOLD");
    expect(achievementTier(20)).toBe("GOLD");
  });
});

describe("Rozet uçları + sözleşme duraklatma", () => {
  const ctx = new TestContext();
  let owner: TestUser;
  let loyalUser: TestUser;
  let newUser: TestUser;
  let staff: TestUser;
  let loyalCustomerId: string;
  let newCustomerId: string;
  let contractId: string;
  const tokens: Record<string, string> = {};

  beforeAll(async () => {
    owner = await ctx.createUser(Role.OWNER);
    loyalUser = await ctx.createUser(Role.CUSTOMER, { tag: "loyal" });
    newUser = await ctx.createUser(Role.CUSTOMER, { tag: "new" });
    staff = await ctx.createStaffUser(Role.STAFF);
    loyalCustomerId = (await ctx.createCustomer({ userId: loyalUser.id })).id;
    newCustomerId = (await ctx.createCustomer({ userId: newUser.id })).id;

    for (let i = 0; i < LOYAL_CUSTOMER_THRESHOLD; i++) {
      await ctx.createJob({ customerId: loyalCustomerId, status: "COMPLETED", completedAt: new Date() });
    }
    await ctx.createJob({ customerId: loyalCustomerId, status: "CANCELLED" }); // sayılmaz
    await ctx.createJob({ customerId: newCustomerId, status: "COMPLETED", completedAt: new Date() });

    // Tekrarlayan, tarihi geçmiş sözleşme (cron üretmeli).
    const past = new Date(Date.now() - 2 * 24 * 3600 * 1000);
    const contract = await prisma.contract.create({
      data: {
        customerId: loyalCustomerId,
        startDate: new Date(Date.now() - 30 * 24 * 3600 * 1000),
        endDate: new Date(Date.now() + 335 * 24 * 3600 * 1000),
        durationMonths: 12,
        status: "ACTIVE",
        serviceType: "Periyodik",
        recurrenceType: "MONTHLY",
        nextGenerationDate: past,
      },
    });
    contractId = contract.id; // cleanup: sweepByOwners sözleşmeyi siler

    for (const [k, u] of Object.entries({ owner, loyalUser, newUser, staff })) tokens[k] = await ctx.tokenFor(u);
  });

  afterAll(() => ctx.cleanup());

  const as = (k: string) => `Bearer ${tokens[k]}`;

  it("GET /customers/me/badges: eşiğe ulaşan sadık, ulaşmayan değil; iptal edilen iş sayılmaz", async () => {
    const loyal = await api().get("/customers/me/badges").set("Authorization", as("loyalUser"));
    expect(loyal.status).toBe(200);
    expect(loyal.body.completedJobCount).toBe(LOYAL_CUSTOMER_THRESHOLD);
    expect(loyal.body.isLoyal).toBe(true);

    const fresh = await api().get("/customers/me/badges").set("Authorization", as("newUser"));
    expect(fresh.body.completedJobCount).toBe(1);
    expect(fresh.body.isLoyal).toBe(false);

    const forbidden = await api().get("/customers/me/badges").set("Authorization", as("staff"));
    expect(forbidden.status).toBe(403);
  });

  it("GET /customers ve /customers/:id isLoyal alanını taşır", async () => {
    const detail = await api().get(`/customers/${loyalCustomerId}`).set("Authorization", as("owner"));
    expect(detail.body.isLoyal).toBe(true);
    expect(detail.body.completedJobCount).toBe(LOYAL_CUSTOMER_THRESHOLD);

    const list = await api().get("/customers?limit=100&sort=newest").set("Authorization", as("owner"));
    const row = list.body.data.find((c: { id: string }) => c.id === newCustomerId);
    expect(row.isLoyal).toBe(false);
    expect(row.completedJobCount).toBe(1);
  });

  it("GET /staff/leaderboard satırları achievementTier taşır (değerlendirme yoksa null)", async () => {
    const res = await api().get("/staff/leaderboard").set("Authorization", as("owner"));
    expect(res.status).toBe(200);
    const row = res.body.data.find((r: { staffId: string }) => r.staffId === staff.staffId);
    expect(row).toBeDefined();
    expect(row.achievementTier).toBeNull();
    expect(row.evaluationAverageScore).toBeNull();
  });

  it("başka müşteri duraklatamaz (403); sahibi duraklatır → cron iş üretmez, sağlık kontrolü gecikmiş saymaz; ikinci duraklatma 409", async () => {
    const other = await api().post(`/contracts/${contractId}/pause`).set("Authorization", as("newUser"));
    expect(other.status).toBe(403);
    const staffRes = await api().post(`/contracts/${contractId}/pause`).set("Authorization", as("staff"));
    expect(staffRes.status).toBe(403);

    // Duraklatmadan önce sağlık kontrolü bu sözleşmeyi gecikmiş görür.
    expect((await findOverdueRecurringContracts()).some((c) => c.id === contractId)).toBe(true);

    const paused = await api().post(`/contracts/${contractId}/pause`).set("Authorization", as("loyalUser"));
    expect(paused.status).toBe(200);
    expect(paused.body.isPaused).toBe(true);
    expect(paused.body.pausedAt).toBeTruthy();

    const again = await api().post(`/contracts/${contractId}/pause`).set("Authorization", as("loyalUser"));
    expect(again.status).toBe(409);

    const jobsBefore = await prisma.job.count({ where: { customerId: loyalCustomerId } });
    await generateRecurringJobs([contractId]); // yalnızca test sözleşmesi — dev verisine dokunma
    const jobsAfter = await prisma.job.count({ where: { customerId: loyalCustomerId } });
    expect(jobsAfter).toBe(jobsBefore); // duraklatılmış → iş üretilmedi

    expect((await findOverdueRecurringContracts()).some((c) => c.id === contractId)).toBe(false);

    const audit = await prisma.auditLog.findFirst({ where: { actorUserId: loyalUser.id, action: "contract.paused", targetId: contractId } });
    expect(audit).not.toBeNull();
  });

  it("devam ettirince nextGenerationDate geleceğe alınır, audit log; duraklatılmamışken resume 409", async () => {
    const resumed = await api().post(`/contracts/${contractId}/resume`).set("Authorization", as("loyalUser"));
    expect(resumed.status).toBe(200);
    expect(resumed.body.isPaused).toBe(false);
    expect(new Date(resumed.body.nextGenerationDate).getTime()).toBeGreaterThan(Date.now());

    const audit = await prisma.auditLog.findFirst({ where: { actorUserId: loyalUser.id, action: "contract.resumed", targetId: contractId } });
    expect(audit).not.toBeNull();

    const again = await api().post(`/contracts/${contractId}/resume`).set("Authorization", as("loyalUser"));
    expect(again.status).toBe(409);
  });
});

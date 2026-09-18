import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { ANONYMIZED_NAME, ANONYMIZED_PHONE } from "../src/controllers/dataDeletionController";
import { api, TestContext, TEST_PASSWORD, type TestUser } from "./helpers/fixtures";

/**
 * Bölüm AD (7. tur): KVKK veri silme talebi.
 * - CUSTOMER talep açar; ikinci bekleyen 409; OWNER listede görür
 * - approve: ad/telefon/e-posta/adres anonim, Job/Payment SAYILARI değişmez,
 *   login artık çalışmaz (isActive false) ve eski JWT 401 (tokenVersion++),
 *   audit log 'GERİ ALINAMAZ'
 * - reject: gerekçe zorunlu, müşteriye bildirim; ikinci karar 409
 * - RBAC: MANAGER bile approve/reject/list yapamaz
 */
describe("KVKK veri silme talebi", () => {
  const ctx = new TestContext();
  let owner: TestUser;
  let manager: TestUser;
  let custA: TestUser;
  let custB: TestUser;
  let customerAId: string;
  let customerBId: string;
  const tokens: Record<string, string> = {};

  beforeAll(async () => {
    owner = await ctx.createUser(Role.OWNER);
    manager = await ctx.createUser(Role.MANAGER);
    custA = await ctx.createUser(Role.CUSTOMER, { tag: "a" });
    custB = await ctx.createUser(Role.CUSTOMER, { tag: "b" });
    customerAId = (await ctx.createCustomer({ userId: custA.id, fullName: "vt_Ayşe Yılmaz" })).id;
    customerBId = (await ctx.createCustomer({ userId: custB.id })).id;
    await ctx.createJob({ customerId: customerAId, status: "COMPLETED", completedAt: new Date(), price: 500 });
    await ctx.createJob({ customerId: customerAId, status: "SCHEDULED" });
    await prisma.payment.create({ data: { customerId: customerAId, amount: 500, paymentType: "vt_test" } });
    for (const [k, u] of Object.entries({ owner, manager, custA, custB })) tokens[k] = await ctx.tokenFor(u);
  });

  afterAll(() => ctx.cleanup());
  const as = (k: string) => `Bearer ${tokens[k]}`;

  let requestAId: string;

  it("CUSTOMER talep açar (201); ikinci bekleyen 409; kendi talebini görür; OWNER listeler, MANAGER 403", async () => {
    const res = await api().post("/customers/me/deletion-request").set("Authorization", as("custA")).send({});
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("PENDING");
    requestAId = res.body.id;

    expect((await api().post("/customers/me/deletion-request").set("Authorization", as("custA")).send({})).status).toBe(409);

    const mine = await api().get("/customers/me/deletion-request").set("Authorization", as("custA"));
    expect(mine.body.data.id).toBe(requestAId);

    const list = await api().get("/data-deletion-requests").set("Authorization", as("owner"));
    expect(list.status).toBe(200);
    expect(list.body.data.some((r: { id: string }) => r.id === requestAId)).toBe(true);
    expect((await api().get("/data-deletion-requests").set("Authorization", as("manager"))).status).toBe(403);

    const notif = await prisma.notification.findFirst({ where: { userId: owner.id, type: "data_deletion_request", relatedId: requestAId } });
    expect(notif).not.toBeNull();
  });

  it("approve (OWNER): kişisel veriler anonim, iş/ödeme sayıları sabit, login ve eski JWT çalışmaz, audit log", async () => {
    const jobsBefore = await prisma.job.count({ where: { customerId: customerAId } });
    const paymentsBefore = await prisma.payment.count({ where: { customerId: customerAId } });

    expect((await api().post(`/data-deletion-requests/${requestAId}/approve`).set("Authorization", as("manager"))).status).toBe(403);

    const res = await api().post(`/data-deletion-requests/${requestAId}/approve`).set("Authorization", as("owner"));
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("COMPLETED");
    expect(res.body.processedBy.id).toBe(owner.id);

    const customer = await prisma.customer.findUniqueOrThrow({ where: { id: customerAId } });
    expect(customer.fullName).toBe(ANONYMIZED_NAME);
    expect(customer.phone).toBe(ANONYMIZED_PHONE);
    expect(customer.email).toBeNull();
    expect(customer.address).toBeNull();

    expect(await prisma.job.count({ where: { customerId: customerAId } })).toBe(jobsBefore);
    expect(await prisma.payment.count({ where: { customerId: customerAId } })).toBe(paymentsBefore);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: custA.id } });
    expect(user.isActive).toBe(false);
    expect(user.fullName).toBe(ANONYMIZED_NAME);
    expect(user.email).not.toBe(custA.email);

    // Eski JWT (tokenVersion arttı) → 401; yeni login → engellenir.
    const oldToken = await api().get("/customers/me/badges").set("Authorization", as("custA"));
    expect(oldToken.status).toBe(401);
    const login = await ctx.login(custA.email, TEST_PASSWORD);
    expect(login.status).toBeGreaterThanOrEqual(400);
    const loginNewEmail = await ctx.login(user.email, TEST_PASSWORD);
    expect(loginNewEmail.status).toBeGreaterThanOrEqual(400);

    const audit = await prisma.auditLog.findFirst({ where: { actorUserId: owner.id, action: "data_deletion.approved", targetId: customerAId } });
    expect(audit?.detail).toContain("GERİ ALINAMAZ");

    expect((await api().post(`/data-deletion-requests/${requestAId}/approve`).set("Authorization", as("owner"))).status).toBe(409);
  });

  it("reject: gerekçesiz 400; gerekçeyle REJECTED + müşteriye bildirim; sonrası yeni talep açılabilir", async () => {
    const create = await api().post("/customers/me/deletion-request").set("Authorization", as("custB")).send({});
    expect(create.status).toBe(201);
    const id = create.body.id as string;

    expect((await api().post(`/data-deletion-requests/${id}/reject`).set("Authorization", as("owner")).send({})).status).toBe(400);

    const res = await api().post(`/data-deletion-requests/${id}/reject`).set("Authorization", as("owner")).send({ reason: "Açık sözleşme var" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("REJECTED");
    expect(res.body.rejectionReason).toBe("Açık sözleşme var");

    const notif = await prisma.notification.findFirst({ where: { userId: custB.id, type: "data_deletion_rejected", relatedId: id } });
    expect(notif?.body).toBe("Açık sözleşme var");

    const customer = await prisma.customer.findUniqueOrThrow({ where: { id: customerBId } });
    expect(customer.fullName).not.toBe(ANONYMIZED_NAME);

    // Reddedildikten sonra yeniden talep açabilir (bekleyen yok).
    expect((await api().post("/customers/me/deletion-request").set("Authorization", as("custB")).send({})).status).toBe(201);
  });
});

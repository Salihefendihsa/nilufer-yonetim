import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { api, TestContext, TEST_PREFIX, uid, type TestUser } from "./helpers/fixtures";

/**
 * Bölüm Y (6. tur): Garanti takibi.
 * - ServiceType.defaultWarrantyDays tanımlıysa iş COMPLETED olduğunda
 *   warrantyExpiresAt = completedAt + gün; tanımlı değilse null
 * - GET /customers/:id/active-warranties: geçerli olanlar (+ daysLeft),
 *   süresi dolmuş/eşleşmeyen tür dahil değil; RBAC
 * - Bekleyen randevu talebi satırında activeWarranty (yönetim)
 */
describe("Garanti takibi", () => {
  const ctx = new TestContext();
  let owner: TestUser;
  let staff: TestUser;
  let customerUser: TestUser;
  let customerId: string;
  let otherCustomerId: string;
  const warrantyTypeName = `${TEST_PREFIX}Garantili ${uid()}`;
  const plainTypeName = `${TEST_PREFIX}Garantisiz ${uid()}`;
  let warrantyTypeId: string;
  const tokens: Record<string, string> = {};

  beforeAll(async () => {
    owner = await ctx.createUser(Role.OWNER);
    staff = await ctx.createStaffUser(Role.STAFF);
    customerUser = await ctx.createUser(Role.CUSTOMER);
    customerId = (await ctx.createCustomer({ userId: customerUser.id })).id;
    otherCustomerId = (await ctx.createCustomer()).id;
    for (const [k, u] of Object.entries({ owner, staff, customerUser })) tokens[k] = await ctx.tokenFor(u);

    const t1 = await api().post("/service-types").set("Authorization", `Bearer ${tokens.owner}`).send({ name: warrantyTypeName, defaultWarrantyDays: 30 });
    expect(t1.status).toBe(201);
    warrantyTypeId = t1.body.id;
    ctx.track("serviceType", t1.body.id);
    const t2 = await api().post("/service-types").set("Authorization", `Bearer ${tokens.owner}`).send({ name: plainTypeName });
    ctx.track("serviceType", t2.body.id);
  });

  afterAll(() => ctx.cleanup());

  const as = (k: string) => `Bearer ${tokens[k]}`;

  // Tamamlama artık saha raporuyla olur (PATCH COMPLETED raporsuz reddedilir); sonuç iş kaydı okunur.
  const completeViaReport = async (jobId: string) => {
    const res = await api().post(`/jobs/${jobId}/report`).set("Authorization", as("staff")).send({ dosage: "1 L" });
    expect(res.status).toBe(201);
    return { status: 200, body: await prisma.job.findUniqueOrThrow({ where: { id: jobId } }) };
  };

  it("tamamlanınca garanti hesaplanır (30 gün); türde tanımlı değilse null", async () => {
    const withWarranty = await ctx.createJob({ customerId, serviceType: warrantyTypeName, assignedStaffId: staff.staffId, status: "IN_PROGRESS" });
    const done = await completeViaReport(withWarranty.id);
    expect(done.status).toBe(200);
    expect(done.body.warrantyExpiresAt).toBeTruthy();
    const diffDays = (new Date(done.body.warrantyExpiresAt!).getTime() - new Date(done.body.completedAt!).getTime()) / (24 * 3600 * 1000);
    expect(diffDays).toBeCloseTo(30, 5);

    const plain = await ctx.createJob({ customerId, serviceType: plainTypeName, assignedStaffId: staff.staffId, status: "IN_PROGRESS" });
    const donePlain = await completeViaReport(plain.id);
    expect(donePlain.status).toBe(200);
    expect(donePlain.body.warrantyExpiresAt).toBeNull();
  });

  it("STAFF'ın raporla işi tamamlaması da garanti hesaplar", async () => {
    const job = await ctx.createJob({ customerId: otherCustomerId, serviceType: warrantyTypeName, assignedStaffId: staff.staffId, status: "IN_PROGRESS" });
    const done = await completeViaReport(job.id);
    expect(done.status).toBe(200);
    expect(done.body.warrantyExpiresAt).toBeTruthy();
  });

  it("active-warranties: geçerli olan listelenir (daysLeft ~30), süresi dolmuş ve farklı tür hariç; RBAC", async () => {
    // Süresi dolmuş bir garanti: doğrudan DB'de geçmiş tarih.
    const expired = await ctx.createJob({ customerId, serviceType: warrantyTypeName, status: "COMPLETED", completedAt: new Date(Date.now() - 60 * 24 * 3600 * 1000) });
    await prisma.job.update({ where: { id: expired.id }, data: { warrantyExpiresAt: new Date(Date.now() - 30 * 24 * 3600 * 1000) } });

    const res = await api().get(`/customers/${customerId}/active-warranties`).set("Authorization", as("owner"));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].serviceType).toBe(warrantyTypeName);
    expect(res.body.data[0].daysLeft).toBeGreaterThanOrEqual(29);
    expect(res.body.data[0].daysLeft).toBeLessThanOrEqual(30);
    expect(res.body.data.some((w: { jobId: string }) => w.jobId === expired.id)).toBe(false);

    const otherType = await api().get(`/customers/${customerId}/active-warranties?serviceType=${encodeURIComponent(plainTypeName)}`).set("Authorization", as("owner"));
    expect(otherType.body.data).toEqual([]);

    const forbidden = await api().get(`/customers/${customerId}/active-warranties`).set("Authorization", as("staff"));
    expect(forbidden.status).toBe(403);
  });

  it("bekleyen randevu talebinde activeWarranty (aynı tür) yönetime görünür, müşteriye görünmez", async () => {
    const create = await api()
      .post("/appointment-requests")
      .set("Authorization", as("customerUser"))
      .send({ serviceTypeId: warrantyTypeId, preferredDateStart: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString(), preferredDateEnd: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString() });
    expect(create.status).toBe(201);

    const asOwner = await api().get("/appointment-requests?status=PENDING&limit=100").set("Authorization", as("owner"));
    const row = asOwner.body.data.find((r: { id: string }) => r.id === create.body.id);
    expect(row.activeWarranty).not.toBeNull();
    expect(row.activeWarranty.daysLeft).toBeGreaterThan(0);

    const asCustomer = await api().get("/appointment-requests").set("Authorization", as("customerUser"));
    expect(asCustomer.body.data.find((r: { id: string }) => r.id === create.body.id)).not.toHaveProperty("activeWarranty");
  });
});

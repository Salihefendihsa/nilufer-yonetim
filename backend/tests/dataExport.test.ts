import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { api, TestContext, type TestUser } from "./helpers/fixtures";

/**
 * Bölüm AJ (8. tur): Müşteri kendi verisini indirir.
 * - GET /customers/me/data-export: yalnızca kendi Customer + Jobs + Contracts +
 *   Payments + AppointmentRequests + belge META (fileUrl YOK)
 * - başka müşterinin kayıtları yanıtta yer almaz; parametre yok → başkasına erişim yolu yok
 * - Customer kaydı olmayan CUSTOMER → 404; roller RBAC matrisinde
 */
describe("Müşteri veri dışa aktarımı", () => {
  const ctx = new TestContext();
  let owner: TestUser;
  let custA: TestUser;
  let custB: TestUser;
  let orphan: TestUser;
  let customerAId: string;
  let customerBId: string;
  const tokens: Record<string, string> = {};

  beforeAll(async () => {
    owner = await ctx.createUser(Role.OWNER);
    custA = await ctx.createUser(Role.CUSTOMER, { tag: "a" });
    custB = await ctx.createUser(Role.CUSTOMER, { tag: "b" });
    orphan = await ctx.createUser(Role.CUSTOMER, { tag: "orphan" });
    customerAId = (await ctx.createCustomer({ userId: custA.id, fullName: "vt_Export Ayşe" })).id;
    customerBId = (await ctx.createCustomer({ userId: custB.id, fullName: "vt_Export Başkası" })).id;

    await ctx.createJob({ customerId: customerAId, status: "COMPLETED", completedAt: new Date(), price: 750, serviceType: "vt_Haşere" });
    await ctx.createJob({ customerId: customerBId, status: "SCHEDULED", serviceType: "vt_Gizli" });
    await prisma.payment.create({ data: { customerId: customerAId, amount: 750, paymentType: "vt_nakit", referenceNo: "vt_REF1" } });
    await prisma.payment.create({ data: { customerId: customerBId, amount: 99, paymentType: "vt_gizli" } });
    await prisma.contract.create({
      data: { customerId: customerAId, startDate: new Date(), endDate: new Date(Date.now() + 365 * 86400000), durationMonths: 12, status: "ACTIVE", serviceType: "vt_Periyodik" },
    });
    await prisma.customerDocument.create({
      data: { customerId: customerAId, fileName: "vt_sozlesme.pdf", fileUrl: "/uploads/documents/vt_secret.pdf", fileType: "application/pdf", fileSize: 1234, uploadedByUserId: owner.id },
    });
    for (const [k, u] of Object.entries({ owner, custA, custB, orphan })) tokens[k] = await ctx.tokenFor(u);
  });

  afterAll(() => ctx.cleanup());
  const as = (k: string) => `Bearer ${tokens[k]}`;

  it("müşteri kendi verisini alır: tüm bölümler dolu, belge META var ama fileUrl yok", async () => {
    const res = await api().get("/customers/me/data-export").set("Authorization", as("custA"));
    expect(res.status).toBe(200);
    expect(res.headers["content-disposition"]).toContain("verilerim-");
    expect(res.body.customer).toMatchObject({ id: customerAId, fullName: "vt_Export Ayşe" });
    expect(res.body.jobs).toHaveLength(1);
    expect(res.body.jobs[0].serviceType).toBe("vt_Haşere");
    expect(res.body.contracts).toHaveLength(1);
    expect(res.body.payments).toHaveLength(1);
    expect(res.body.payments[0].referenceNo).toBe("vt_REF1");
    expect(res.body.appointmentRequests).toEqual([]);
    expect(res.body.documents).toHaveLength(1);
    expect(res.body.documents[0].fileName).toBe("vt_sozlesme.pdf");
    expect(res.body.documents[0]).not.toHaveProperty("fileUrl");
    expect(JSON.stringify(res.body)).not.toContain("vt_secret");
  });

  it("başka müşterinin verisi sızmaz; B kendi verisini görür", async () => {
    const a = await api().get("/customers/me/data-export").set("Authorization", as("custA"));
    expect(JSON.stringify(a.body)).not.toContain("vt_Gizli");
    expect(JSON.stringify(a.body)).not.toContain(customerBId);

    const b = await api().get("/customers/me/data-export").set("Authorization", as("custB"));
    expect(b.status).toBe(200);
    expect(b.body.customer.id).toBe(customerBId);
    expect(b.body.jobs).toHaveLength(1);
    expect(b.body.jobs[0].serviceType).toBe("vt_Gizli");
    expect(b.body.contracts).toEqual([]);
    expect(b.body.documents).toEqual([]);
  });

  it("Customer kaydı olmayan CUSTOMER → 404; OWNER → 403 (yalnızca müşteri)", async () => {
    expect((await api().get("/customers/me/data-export").set("Authorization", as("orphan"))).status).toBe(404);
    expect((await api().get("/customers/me/data-export").set("Authorization", as("owner"))).status).toBe(403);
  });
});

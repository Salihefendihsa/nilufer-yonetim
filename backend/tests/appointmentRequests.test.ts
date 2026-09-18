import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { api, TestContext, TEST_PREFIX, uid, type TestUser } from "./helpers/fixtures";

/**
 * Bölüm J (3. tur): Müşteri randevu talebi akışı.
 * - CUSTOMER oluşturur (doğrulama: gelecek tarih, start < end, geçerli hizmet türü)
 * - CUSTOMER yalnızca KENDİ taleplerini görür
 * - OWNER/MANAGER planlar (aynı müşterinin Job'ına bağlar) / reddeder; ikinci
 *   karar 409; müşteriye bildirim düşer
 * - RBAC: STAFF/TEAM_LEAD hiçbir uca giremez, CUSTOMER planlayamaz/reddedemez
 */

const NIL = "00000000-0000-4000-8000-000000000000";
const DAY = 24 * 3600 * 1000;

describe("Randevu talepleri (/appointment-requests)", () => {
  const ctx = new TestContext();
  let owner: TestUser;
  let staff: TestUser;
  let lead: TestUser;
  let customerUserA: TestUser;
  let customerUserB: TestUser;
  let customerAId: string;
  let customerBId: string;
  let serviceTypeId: string;
  const tokens: Record<string, string> = {};

  beforeAll(async () => {
    owner = await ctx.createUser(Role.OWNER);
    staff = await ctx.createStaffUser(Role.STAFF);
    lead = await ctx.createStaffUser(Role.TEAM_LEAD);
    customerUserA = await ctx.createUser(Role.CUSTOMER, { tag: "custA" });
    customerUserB = await ctx.createUser(Role.CUSTOMER, { tag: "custB" });
    customerAId = (await ctx.createCustomer({ userId: customerUserA.id })).id;
    customerBId = (await ctx.createCustomer({ userId: customerUserB.id })).id;

    const serviceType = await prisma.serviceType.create({ data: { name: `${TEST_PREFIX}Hizmet ${uid()}` } });
    serviceTypeId = serviceType.id;
    ctx.track("serviceType", serviceType.id);

    for (const [key, u] of Object.entries({ owner, staff, lead, customerUserA, customerUserB })) {
      tokens[key] = await ctx.tokenFor(u);
    }
  });

  afterAll(() => ctx.cleanup());

  const validBody = () => ({
    serviceTypeId,
    preferredDateStart: new Date(Date.now() + 2 * DAY).toISOString(),
    preferredDateEnd: new Date(Date.now() + 3 * DAY).toISOString(),
    note: "Öğleden sonra uygun",
  });

  const as = (key: string) => `Bearer ${tokens[key]}`;

  describe("doğrulama", () => {
    it("geçmiş tarih 400", async () => {
      const res = await api()
        .post("/appointment-requests")
        .set("Authorization", as("customerUserA"))
        .send({ ...validBody(), preferredDateStart: new Date(Date.now() - DAY).toISOString() });
      expect(res.status).toBe(400);
    });

    it("start >= end 400", async () => {
      const body = validBody();
      const res = await api()
        .post("/appointment-requests")
        .set("Authorization", as("customerUserA"))
        .send({ ...body, preferredDateEnd: body.preferredDateStart });
      expect(res.status).toBe(400);
    });

    it("geçersiz hizmet türü 400", async () => {
      const res = await api()
        .post("/appointment-requests")
        .set("Authorization", as("customerUserA"))
        .send({ ...validBody(), serviceTypeId: NIL });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/hizmet türü/i);
    });
  });

  describe("oluşturma ve görünürlük", () => {
    let requestId: string;

    it("CUSTOMER kendi talebini oluşturur — customerId otomatik bağlanır, yönetime bildirim düşer", async () => {
      const res = await api().post("/appointment-requests").set("Authorization", as("customerUserA")).send(validBody());
      expect(res.status).toBe(201);
      expect(res.body.customerId).toBe(customerAId);
      expect(res.body.status).toBe("PENDING");
      expect(res.body.serviceType.id).toBe(serviceTypeId);
      requestId = res.body.id;

      const notif = await prisma.notification.findFirst({
        where: { userId: owner.id, type: "appointment_request", relatedId: requestId },
      });
      expect(notif).not.toBeNull();
    });

    it("CUSTOMER yalnızca kendi taleplerini görür; başka müşterininkini GÖREMEZ", async () => {
      const mine = await api().get("/appointment-requests").set("Authorization", as("customerUserA"));
      expect(mine.status).toBe(200);
      expect(mine.body.data.map((r: { id: string }) => r.id)).toContain(requestId);

      const other = await api().get("/appointment-requests").set("Authorization", as("customerUserB"));
      expect(other.status).toBe(200);
      expect(other.body.data.map((r: { id: string }) => r.id)).not.toContain(requestId);
      expect(other.body.data.every((r: { customerId: string }) => r.customerId === customerBId)).toBe(true);
    });

    it("OWNER tüm talepleri görür ve ?status= ile filtreler", async () => {
      const all = await api().get("/appointment-requests?status=PENDING").set("Authorization", as("owner"));
      expect(all.status).toBe(200);
      expect(all.body.data.map((r: { id: string }) => r.id)).toContain(requestId);
      expect(all.body.data.every((r: { status: string }) => r.status === "PENDING")).toBe(true);
    });
  });

  describe("planlama", () => {
    it("başka müşterinin işine bağlanamaz (400); aynı müşterinin işine bağlanınca SCHEDULED + bildirim", async () => {
      const create = await api().post("/appointment-requests").set("Authorization", as("customerUserA")).send(validBody());
      const requestId = create.body.id as string;

      const jobOfB = await ctx.createJob({ customerId: customerBId, status: "SCHEDULED" });
      const wrong = await api().post(`/appointment-requests/${requestId}/schedule`).set("Authorization", as("owner")).send({ jobId: jobOfB.id });
      expect(wrong.status).toBe(400);

      const missing = await api().post(`/appointment-requests/${requestId}/schedule`).set("Authorization", as("owner")).send({ jobId: NIL });
      expect(missing.status).toBe(404);

      const jobOfA = await ctx.createJob({ customerId: customerAId, status: "SCHEDULED", scheduledAt: new Date(Date.now() + 2 * DAY) });
      const ok = await api().post(`/appointment-requests/${requestId}/schedule`).set("Authorization", as("owner")).send({ jobId: jobOfA.id });
      expect(ok.status).toBe(200);
      expect(ok.body.status).toBe("SCHEDULED");
      expect(ok.body.resultingJobId).toBe(jobOfA.id);
      expect(ok.body.respondedByUser.id).toBe(owner.id);
      expect(ok.body.respondedAt).toBeTruthy();

      const notif = await prisma.notification.findFirst({
        where: { userId: customerUserA.id, type: "appointment_request_scheduled", relatedId: jobOfA.id },
      });
      expect(notif).not.toBeNull();

      // İkinci karar 409.
      const again = await api().post(`/appointment-requests/${requestId}/decline`).set("Authorization", as("owner")).send({ reason: "x" });
      expect(again.status).toBe(409);
    });
  });

  describe("reddetme", () => {
    it("gerekçesiz 400; gerekçeyle DECLINED + müşteriye bildirim", async () => {
      const create = await api().post("/appointment-requests").set("Authorization", as("customerUserA")).send(validBody());
      const requestId = create.body.id as string;

      const noReason = await api().post(`/appointment-requests/${requestId}/decline`).set("Authorization", as("owner")).send({});
      expect(noReason.status).toBe(400);

      const ok = await api()
        .post(`/appointment-requests/${requestId}/decline`)
        .set("Authorization", as("owner"))
        .send({ reason: "O tarihte ekip dolu" });
      expect(ok.status).toBe(200);
      expect(ok.body.status).toBe("DECLINED");
      expect(ok.body.declineReason).toBe("O tarihte ekip dolu");

      const notif = await prisma.notification.findFirst({
        where: { userId: customerUserA.id, type: "appointment_request_declined", relatedId: requestId },
      });
      expect(notif?.body).toBe("O tarihte ekip dolu");

      const missing = await api().post(`/appointment-requests/${NIL}/decline`).set("Authorization", as("owner")).send({ reason: "x" });
      expect(missing.status).toBe(404);
    });
  });

  describe("RBAC", () => {
    it("POST / yalnızca CUSTOMER; STAFF/TEAM_LEAD/OWNER 403", async () => {
      for (const key of ["staff", "lead", "owner"]) {
        const res = await api().post("/appointment-requests").set("Authorization", as(key)).send(validBody());
        expect(res.status, key).toBe(403);
      }
    });

    it("GET / STAFF/TEAM_LEAD 403", async () => {
      for (const key of ["staff", "lead"]) {
        const res = await api().get("/appointment-requests").set("Authorization", as(key));
        expect(res.status, key).toBe(403);
      }
    });

    it("schedule/decline yalnızca OWNER/MANAGER; CUSTOMER/STAFF/TEAM_LEAD 403", async () => {
      for (const key of ["customerUserA", "staff", "lead"]) {
        const s = await api().post(`/appointment-requests/${NIL}/schedule`).set("Authorization", as(key)).send({ jobId: NIL });
        expect(s.status, `schedule ${key}`).toBe(403);
        const d = await api().post(`/appointment-requests/${NIL}/decline`).set("Authorization", as(key)).send({ reason: "x" });
        expect(d.status, `decline ${key}`).toBe(403);
      }
    });

    it("token'sız 401", async () => {
      const res = await api().get("/appointment-requests");
      expect(res.status).toBe(401);
    });
  });
});

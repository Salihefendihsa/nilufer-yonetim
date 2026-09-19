import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { api, TestContext, type TestUser } from "./helpers/fixtures";

/**
 * Bölüm AO (9. tur): müşteri şikayet/sorun bildirimi.
 * - CUSTOMER kendi adına açar (OPEN, MEDIUM varsayılan); yönetime bildirim
 * - başkasının işine bağlamaya çalışırsa 400
 * - CUSTOMER listede yalnızca kendi şikayetlerini görür; başkasınınkine GET → 404
 * - OWNER durum/öncelik/atama günceller; RESOLVED → resolvedAt + müşteriye bildirim;
 *   yeniden açılınca resolvedAt sıfırlanır; CUSTOMER'a atama 400
 * - filtre: status / priority
 */
describe("Müşteri şikayetleri", () => {
  const ctx = new TestContext();
  let owner: TestUser;
  let manager: TestUser;
  let customerA: TestUser;
  let customerB: TestUser;
  let tokenA: string;
  let tokenB: string;
  let ownerToken: string;
  let customerAId: string;
  let jobAId: string;
  let jobBId: string;
  let complaintId: string;

  beforeAll(async () => {
    owner = await ctx.createUser(Role.OWNER);
    manager = await ctx.createUser(Role.MANAGER);
    customerA = await ctx.createUser(Role.CUSTOMER, { tag: "custA" });
    customerB = await ctx.createUser(Role.CUSTOMER, { tag: "custB" });
    const a = await ctx.createCustomer({ userId: customerA.id });
    const b = await ctx.createCustomer({ userId: customerB.id });
    customerAId = a.id;
    jobAId = (await ctx.createJob({ customerId: a.id })).id;
    jobBId = (await ctx.createJob({ customerId: b.id })).id;
    tokenA = await ctx.tokenFor(customerA);
    tokenB = await ctx.tokenFor(customerB);
    ownerToken = await ctx.tokenFor(owner);
  });

  afterAll(() => ctx.cleanup());

  it("CUSTOMER kendi işine bağlı şikayet açar → OPEN/MEDIUM, yönetime bildirim", async () => {
    const before = await prisma.notification.count({ where: { userId: owner.id, type: "complaint" } });
    const res = await api()
      .post("/complaints")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ subject: "vt_Koku devam ediyor", description: "İlaçlamadan sonra hâlâ haşere görüyorum, koku da çok ağır.", jobId: jobAId });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("OPEN");
    expect(res.body.priority).toBe("MEDIUM");
    expect(res.body.customerId).toBe(customerAId);
    expect(res.body.job.id).toBe(jobAId);
    expect(res.body.resolvedAt).toBeNull();
    complaintId = res.body.id;
    const after = await prisma.notification.count({ where: { userId: owner.id, type: "complaint" } });
    expect(after - before).toBe(1);
  });

  it("başkasının işine bağlamak 400; kısa açıklama 400", async () => {
    const wrongJob = await api()
      .post("/complaints")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ subject: "vt_Yanlış iş", description: "Bu iş bana ait değil ama deniyorum.", jobId: jobBId });
    expect(wrongJob.status).toBe(400);
    const short = await api().post("/complaints").set("Authorization", `Bearer ${tokenA}`).send({ subject: "vt_x", description: "kısa" });
    expect(short.status).toBe(400);
  });

  it("CUSTOMER yalnızca kendi şikayetlerini listeler; başkasının kaydına GET → 404", async () => {
    await api().post("/complaints").set("Authorization", `Bearer ${tokenB}`).send({ subject: "vt_B şikayeti", description: "Randevuya kimse gelmedi, bilgi de verilmedi.", priority: "HIGH" });

    const listA = await api().get("/complaints?limit=100").set("Authorization", `Bearer ${tokenA}`);
    expect(listA.status).toBe(200);
    expect(listA.body.data.every((c: { customerId: string }) => c.customerId === customerAId)).toBe(true);
    expect(listA.body.data.some((c: { id: string }) => c.id === complaintId)).toBe(true);

    const cross = await api().get(`/complaints/${complaintId}`).set("Authorization", `Bearer ${tokenB}`);
    expect(cross.status).toBe(404);
    const own = await api().get(`/complaints/${complaintId}`).set("Authorization", `Bearer ${tokenA}`);
    expect(own.status).toBe(200);

    // Yönetim ikisini de görür; filtreler çalışır.
    const all = await api().get("/complaints?limit=100").set("Authorization", `Bearer ${ownerToken}`);
    const ids = all.body.data.map((c: { id: string }) => c.id);
    expect(ids).toContain(complaintId);
    const high = await api().get("/complaints?priority=HIGH&limit=100").set("Authorization", `Bearer ${ownerToken}`);
    expect(high.body.data.every((c: { priority: string }) => c.priority === "HIGH")).toBe(true);
    expect(high.body.data.some((c: { subject: string }) => c.subject === "vt_B şikayeti")).toBe(true);
  });

  it("OWNER atar + IN_PROGRESS; CUSTOMER'a atama 400", async () => {
    const bad = await api().patch(`/complaints/${complaintId}`).set("Authorization", `Bearer ${ownerToken}`).send({ assignedToUserId: customerB.id });
    expect(bad.status).toBe(400);

    const res = await api()
      .patch(`/complaints/${complaintId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ status: "IN_PROGRESS", assignedToUserId: manager.id, priority: "HIGH" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("IN_PROGRESS");
    expect(res.body.priority).toBe("HIGH");
    expect(res.body.assignedTo.id).toBe(manager.id);
    expect(res.body.resolvedAt).toBeNull();

    const inProgress = await api().get("/complaints?status=IN_PROGRESS&limit=100").set("Authorization", `Bearer ${ownerToken}`);
    expect(inProgress.body.data.some((c: { id: string }) => c.id === complaintId)).toBe(true);
  });

  it("RESOLVED → resolvedAt damgalanır, müşteriye bildirim; yeniden açılınca sıfırlanır", async () => {
    const before = await prisma.notification.count({ where: { userId: customerA.id, type: "complaint" } });
    const res = await api()
      .patch(`/complaints/${complaintId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ status: "RESOLVED", resolutionNote: "Ücretsiz tekrar uygulama yapıldı." });
    expect(res.status).toBe(200);
    expect(res.body.resolvedAt).toBeTruthy();
    expect(res.body.resolutionNote).toBe("Ücretsiz tekrar uygulama yapıldı.");
    const after = await prisma.notification.count({ where: { userId: customerA.id, type: "complaint" } });
    expect(after - before).toBe(1);
    const note = await prisma.notification.findFirst({ where: { userId: customerA.id, type: "complaint" }, orderBy: { createdAt: "desc" } });
    expect(note?.title).toBe("Şikayetiniz sonuçlandı");

    const reopen = await api().patch(`/complaints/${complaintId}`).set("Authorization", `Bearer ${ownerToken}`).send({ status: "IN_PROGRESS" });
    expect(reopen.status).toBe(200);
    expect(reopen.body.resolvedAt).toBeNull();

    // Boş gövde 400
    const empty = await api().patch(`/complaints/${complaintId}`).set("Authorization", `Bearer ${ownerToken}`).send({});
    expect(empty.status).toBe(400);
  });
});

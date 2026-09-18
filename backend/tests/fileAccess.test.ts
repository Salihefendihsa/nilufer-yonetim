import fs from "fs";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { UPLOADS_DIR, uploadedFileUrl } from "../src/lib/upload";
import { orderedPair } from "../src/lib/messaging";
import { api, TestContext, type TestUser } from "./helpers/fixtures";

/**
 * Bölüm AC (7. tur) — GÜVENLİK: kimlik doğrulamalı dosya servisi.
 * - /uploads/* artık hiç servis edilmez (404), dosya diskte olsa bile
 * - /files/:type/:id token'sız 401; yetkili rol dosyayı doğru Content-Type ile alır
 * - yetkisiz rol 403 (var/yok sızmaz: aynı mesajla), olmayan kayıt 404
 * - müşteri belgesi: OWNER/MANAGER; CUSTOMER kendi belgesi bile olsa 403
 * - iş fotoğrafı/imza: canAccessJob (STAFF yalnızca kendi işi, CUSTOMER kendi işi)
 * - mesaj eki: yalnızca konuşmanın katılımcıları
 * Diske yazılan test dosyaları isimle silinir.
 */
describe("Kimlik doğrulamalı dosya servisi (/files)", () => {
  const ctx = new TestContext();
  const files: string[] = [];
  let owner: TestUser;
  let manager: TestUser;
  let assignee: TestUser;
  let otherStaff: TestUser;
  let customerUser: TestUser;
  let otherCustomerUser: TestUser;
  let customerId: string;
  let jobId: string;
  let photoId: string;
  let docId: string;
  let messageId: string;
  const tokens: Record<string, string> = {};

  function writeFile(name: string, content: string): string {
    const filename = `vt-${Date.now()}-${name}`;
    fs.writeFileSync(path.join(UPLOADS_DIR, filename), content);
    files.push(filename);
    return filename;
  }

  beforeAll(async () => {
    owner = await ctx.createUser(Role.OWNER);
    manager = await ctx.createUser(Role.MANAGER);
    assignee = await ctx.createStaffUser(Role.STAFF, { tag: "assignee" });
    otherStaff = await ctx.createStaffUser(Role.STAFF, { tag: "other" });
    customerUser = await ctx.createUser(Role.CUSTOMER, { tag: "cust" });
    otherCustomerUser = await ctx.createUser(Role.CUSTOMER, { tag: "cust2" });
    customerId = (await ctx.createCustomer({ userId: customerUser.id })).id;
    await ctx.createCustomer({ userId: otherCustomerUser.id });
    for (const [k, u] of Object.entries({ owner, manager, assignee, otherStaff, customerUser, otherCustomerUser })) tokens[k] = await ctx.tokenFor(u);

    jobId = (await ctx.createJob({ customerId, assignedStaffId: assignee.staffId, status: "COMPLETED", completedAt: new Date() })).id;

    // İş fotoğrafı + imzalı rapor
    const photoFile = writeFile("photo.png", "PNGDATA");
    photoId = (await prisma.jobPhoto.create({ data: { jobId, url: uploadedFileUrl(photoFile), type: "BEFORE", uploadedByUserId: assignee.id } })).id;
    const sigFile = writeFile("imza.png", "SIGDATA");
    const report = await prisma.jobReport.create({ data: { jobId, staffId: assignee.staffId!, dosage: "10ml", signatureUrl: uploadedFileUrl(sigFile) } });
    ctx.track("jobReport", report.id);

    // Müşteri belgesi
    const docFile = writeFile("sozlesme.pdf", "%PDF-1.4");
    docId = (
      await prisma.customerDocument.create({
        data: { customerId, fileName: "vt_sozlesme.pdf", fileUrl: uploadedFileUrl(docFile), fileType: "application/pdf", fileSize: 8, uploadedByUserId: owner.id },
      })
    ).id;

    // Mesaj eki: owner ↔ assignee
    const [a, b] = orderedPair(owner.id, assignee.id);
    const conv = await prisma.conversation.create({ data: { participantAId: a, participantBId: b } });
    const attFile = writeFile("ek.png", "ATTDATA");
    messageId = (await prisma.message.create({ data: { conversationId: conv.id, senderId: owner.id, content: "ek", attachmentUrl: uploadedFileUrl(attFile), attachmentType: "image" } })).id;
  });

  afterAll(async () => {
    for (const f of files) await fs.promises.unlink(path.join(UPLOADS_DIR, f)).catch(() => {});
    await ctx.cleanup();
  });

  const as = (k: string) => `Bearer ${tokens[k]}`;
  /** supertest resim/pdf gövdesini Buffer olarak verir; metin yanıtta res.text dolar. */
  const bodyText = (res: { text?: string; body: unknown }) =>
    typeof res.text === "string" && res.text.length > 0 ? res.text : Buffer.isBuffer(res.body) ? res.body.toString("utf8") : String(res.body ?? "");

  it("ESKİ /uploads/* yolu artık servis edilmez (404) — dosya diskte olsa bile", async () => {
    const res = await api().get(`/uploads/${files[0]}`);
    expect(res.status).toBe(404);
    expect(fs.existsSync(path.join(UPLOADS_DIR, files[0]))).toBe(true);
    const withToken = await api().get(`/uploads/${files[0]}`).set("Authorization", as("owner"));
    expect(withToken.status).toBe(404);
  });

  it("token'sız 401; bilinmeyen tür 404", async () => {
    expect((await api().get(`/files/job-photo/${photoId}`)).status).toBe(401);
    expect((await api().get(`/files/wat/${photoId}`).set("Authorization", as("owner"))).status).toBe(404);
  });

  it("iş fotoğrafı: OWNER, atanan STAFF ve işin müşterisi alır (image/png); başka STAFF ve başka müşteri 403; olmayan 404", async () => {
    for (const k of ["owner", "assignee", "customerUser"]) {
      const res = await api().get(`/files/job-photo/${photoId}`).set("Authorization", as(k));
      expect(res.status, k).toBe(200);
      expect(res.headers["content-type"]).toContain("image/png");
      expect(bodyText(res)).toContain("PNGDATA");
    }
    const forbiddenStaff = await api().get(`/files/job-photo/${photoId}`).set("Authorization", as("otherStaff"));
    expect(forbiddenStaff.status).toBe(403);
    const forbiddenCust = await api().get(`/files/job-photo/${photoId}`).set("Authorization", as("otherCustomerUser"));
    expect(forbiddenCust.status).toBe(403);
    expect(forbiddenCust.body.error).toBe("Bu dosyaya erişim yetkiniz yok");
    const missing = await api().get("/files/job-photo/00000000-0000-4000-8000-000000000000").set("Authorization", as("owner"));
    expect(missing.status).toBe(404);
    expect(missing.body.error).toBe("Dosya bulunamadı");
  });

  it("imza: job id ile, canAccessJob kuralı", async () => {
    const ok = await api().get(`/files/job-signature/${jobId}`).set("Authorization", as("customerUser"));
    expect(ok.status).toBe(200);
    expect(bodyText(ok)).toContain("SIGDATA");
    const forbidden = await api().get(`/files/job-signature/${jobId}`).set("Authorization", as("otherStaff"));
    expect(forbidden.status).toBe(403);
  });

  it("müşteri belgesi: OWNER/MANAGER alır (application/pdf, orijinal ad); CUSTOMER kendi belgesi bile olsa 403; STAFF 403", async () => {
    for (const k of ["owner", "manager"]) {
      const res = await api().get(`/files/customer-document/${docId}`).set("Authorization", as(k));
      expect(res.status, k).toBe(200);
      expect(res.headers["content-type"]).toContain("application/pdf");
      expect(res.headers["content-disposition"]).toContain("vt_sozlesme.pdf");
    }
    for (const k of ["customerUser", "assignee"]) {
      const res = await api().get(`/files/customer-document/${docId}`).set("Authorization", as(k));
      expect(res.status, k).toBe(403);
    }
  });

  it("mesaj eki: yalnızca katılımcılar; üçüncü kişi 403", async () => {
    expect((await api().get(`/files/message-attachment/${messageId}`).set("Authorization", as("assignee"))).status).toBe(200);
    expect((await api().get(`/files/message-attachment/${messageId}`).set("Authorization", as("owner"))).status).toBe(200);
    expect((await api().get(`/files/message-attachment/${messageId}`).set("Authorization", as("manager"))).status).toBe(403);
  });

  it("path traversal: id yerine yol verilse bile yalnızca kayıt aranır (404)", async () => {
    const res = await api().get(`/files/job-photo/${encodeURIComponent("../.env")}`).set("Authorization", as("owner"));
    expect(res.status).toBe(404);
  });
});

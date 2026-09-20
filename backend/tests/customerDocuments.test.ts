import fs from "fs";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { UPLOADS_DIR } from "../src/lib/storage";
import { api, TestContext, type TestUser } from "./helpers/fixtures";

/**
 * Bölüm AB (6. tur): Müşteri belge kasası.
 * - multipart yükleme (PDF + resim), izinsiz tür 400/500 değil → reddedilir
 * - listeleme; DELETE hem DB kaydını hem diskteki dosyayı siler
 * - başka müşterinin belgesi kendi yolundan silinemez (404); STAFF 403
 * Temizlik: kalan belge dosyaları ID/isim ile diskten silinir.
 */
describe("Müşteri belge kasası (/customers/:id/documents)", () => {
  const ctx = new TestContext();
  let owner: TestUser;
  let staff: TestUser;
  let customerA: string;
  let customerB: string;
  const tokens: Record<string, string> = {};
  const createdFiles: string[] = [];

  beforeAll(async () => {
    owner = await ctx.createUser(Role.OWNER);
    staff = await ctx.createStaffUser(Role.STAFF);
    customerA = (await ctx.createCustomer()).id;
    customerB = (await ctx.createCustomer()).id;
    tokens.owner = await ctx.tokenFor(owner);
    tokens.staff = await ctx.tokenFor(staff);
  });

  afterAll(async () => {
    for (const f of createdFiles) await fs.promises.unlink(path.join(UPLOADS_DIR, f)).catch(() => {});
    await ctx.cleanup();
  });

  const pdfBuffer = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF", "utf8");
  const pngBuffer = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

  let docId: string;
  let docFilename: string;

  it("PDF yükler (201): orijinal ad korunur, disk dosyası oluşur; STAFF 403; dosyasız 400", async () => {
    const res = await api()
      .post(`/customers/${customerA}/documents`)
      .set("Authorization", `Bearer ${tokens.owner}`)
      .attach("file", pdfBuffer, { filename: "vt_sozlesme.pdf", contentType: "application/pdf" });
    expect(res.status).toBe(201);
    expect(res.body.fileName).toBe("vt_sozlesme.pdf");
    expect(res.body.fileType).toBe("application/pdf");
    expect(res.body.fileSize).toBe(pdfBuffer.length);
    expect(res.body.uploadedBy.id).toBe(owner.id);
    docId = res.body.id;
    docFilename = path.basename(res.body.fileUrl);
    createdFiles.push(docFilename);
    expect(fs.existsSync(path.join(UPLOADS_DIR, docFilename))).toBe(true);

    const forbidden = await api()
      .post(`/customers/${customerA}/documents`)
      .set("Authorization", `Bearer ${tokens.staff}`)
      .attach("file", pngBuffer, { filename: "x.png", contentType: "image/png" });
    expect(forbidden.status).toBe(403);

    const none = await api().post(`/customers/${customerA}/documents`).set("Authorization", `Bearer ${tokens.owner}`);
    expect(none.status).toBe(400);
  });

  it("resim de yüklenir; izin verilmeyen tür reddedilir", async () => {
    const img = await api()
      .post(`/customers/${customerA}/documents`)
      .set("Authorization", `Bearer ${tokens.owner}`)
      .attach("file", pngBuffer, { filename: "vt_kimlik.png", contentType: "image/png" });
    expect(img.status).toBe(201);
    createdFiles.push(path.basename(img.body.fileUrl));

    const exe = await api()
      .post(`/customers/${customerA}/documents`)
      .set("Authorization", `Bearer ${tokens.owner}`)
      .attach("file", Buffer.from("MZ"), { filename: "virus.exe", contentType: "application/x-msdownload" });
    expect(exe.status).toBeGreaterThanOrEqual(400);
    expect(exe.status).toBeLessThan(500);
  });

  it("listeler (en yeni önce); başka müşterinin listesinde görünmez", async () => {
    const a = await api().get(`/customers/${customerA}/documents`).set("Authorization", `Bearer ${tokens.owner}`);
    expect(a.status).toBe(200);
    expect(a.body.data).toHaveLength(2);
    expect(a.body.data[0].fileName).toBe("vt_kimlik.png");
    const b = await api().get(`/customers/${customerB}/documents`).set("Authorization", `Bearer ${tokens.owner}`);
    expect(b.body.data).toEqual([]);
  });

  it("başka müşterinin yolundan silinemez (404, dosya durur); doğru yoldan DELETE → DB + disk temizlenir", async () => {
    const wrong = await api().delete(`/customers/${customerB}/documents/${docId}`).set("Authorization", `Bearer ${tokens.owner}`);
    expect(wrong.status).toBe(404);
    expect(await prisma.customerDocument.findUnique({ where: { id: docId } })).not.toBeNull();
    expect(fs.existsSync(path.join(UPLOADS_DIR, docFilename))).toBe(true);

    const del = await api().delete(`/customers/${customerA}/documents/${docId}`).set("Authorization", `Bearer ${tokens.owner}`);
    expect(del.status).toBe(204);
    expect(await prisma.customerDocument.findUnique({ where: { id: docId } })).toBeNull();
    expect(fs.existsSync(path.join(UPLOADS_DIR, docFilename))).toBe(false);

    const audit = await prisma.auditLog.findFirst({ where: { actorUserId: owner.id, action: "customer_document.deleted", targetId: docId } });
    expect(audit?.detail).toBe("vt_sozlesme.pdf");

    const again = await api().delete(`/customers/${customerA}/documents/${docId}`).set("Authorization", `Bearer ${tokens.owner}`);
    expect(again.status).toBe(404);
  });
});

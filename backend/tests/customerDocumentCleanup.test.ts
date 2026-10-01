import fs from "fs";
import path from "path";
import express, { type Request, type Response, type NextFunction } from "express";
import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  customers: new Map<string, { id: string; userId: string | null }>(),
  documents: new Map<string, Record<string, unknown>>(),
  failCreate: false,
  failCleanup: false,
  deleteCustomerOnPersist: false,
  tempDir: "",
}));

vi.mock("../src/lib/prisma", () => ({
  prisma: {
    $disconnect: vi.fn(async () => {}),
    customer: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => state.customers.get(where.id) ?? null),
    },
    customerDocument: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        if (state.failCreate || !state.customers.has(data.customerId as string)) throw new Error("Kayıt oluşturulamadı");
        const document = {
          ...data,
          id: `doc-${state.documents.size + 1}`,
          uploadedAt: new Date().toISOString(),
          uploadedBy: { id: "owner", fullName: "Test Kullanıcı" },
        };
        state.documents.set(document.id, document);
        return document;
      }),
      findMany: vi.fn(async ({ where }: { where: { customerId: string } }) =>
        [...state.documents.values()].filter((doc) => doc.customerId === where.customerId)),
    },
  },
}));

vi.mock("../src/lib/storage", async () => {
  const os = await import("os");
  const fsModule = await import("fs");
  const pathModule = await import("path");
  state.tempDir = fsModule.mkdtempSync(pathModule.join(os.tmpdir(), "nilufer-document-test-"));
  return {
    UPLOADS_DIR: state.tempDir,
    persistFile: vi.fn(async () => {
      if (state.deleteCustomerOnPersist) state.customers.delete("customer-a");
    }),
    cleanupFailedUpload: vi.fn(async (file: { path: string }) => {
      if (state.failCleanup) throw new Error("Gizli dosya yolu");
      await fsModule.promises.unlink(file.path);
    }),
    deleteFile: vi.fn(async () => {}),
  };
});

vi.mock("../src/lib/auditLog", () => ({ recordAuditLog: vi.fn(async () => {}) }));

vi.mock("../src/middleware/auth", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/middleware/auth")>();
  const { Role } = await import("@prisma/client");
  return {
    ...original,
    requireAuth: (req: Request, _res: Response, next: NextFunction) => {
      req.user = {
        sub: "owner",
        role: req.header("x-test-role") === "STAFF" ? Role.STAFF : Role.OWNER,
        tokenVersion: 0,
      } as Request["user"];
      next();
    },
  };
});

import customerRoutes from "../src/routes/customers";
import { errorHandler } from "../src/middleware/errorHandler";

const app = express();
app.use("/customers", customerRoutes);
app.use(errorHandler);

const pdf = Buffer.from("%PDF-1.4\n%%EOF", "utf8");

async function upload(customerId: string, role = "OWNER") {
  return request(app)
    .post(`/customers/${customerId}/documents`)
    .set("x-test-role", role)
    .attach("file", pdf, { filename: "belge.pdf", contentType: "application/pdf" });
}

describe("müşteri belgesi başarısız yükleme temizliği", () => {
  beforeEach(() => {
    state.customers.clear();
    state.customers.set("customer-a", { id: "customer-a", userId: null });
    state.documents.clear();
    state.failCreate = false;
    state.failCleanup = false;
    state.deleteCustomerOnPersist = false;
  });

  afterEach(async () => {
    for (const filename of await fs.promises.readdir(state.tempDir)) {
      await fs.promises.unlink(path.join(state.tempDir, filename));
    }
  });

  afterAll(async () => {
    await fs.promises.rmdir(state.tempDir);
  });

  it("olmayan müşteri için 404 döner; dosya veya kayıt oluşturmaz", async () => {
    const res = await upload("missing");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Müşteri bulunamadı");
    expect(state.documents.size).toBe(0);
    expect(await fs.promises.readdir(state.tempDir)).toEqual([]);
  });

  it("yetkisiz personeli dosya yazılmadan reddeder", async () => {
    const res = await upload("customer-a", "STAFF");
    expect(res.status).toBe(403);
    expect(state.documents.size).toBe(0);
    expect(await fs.promises.readdir(state.tempDir)).toEqual([]);
  });

  it("kayıt hatasında yalnız yeni dosyayı siler, mevcut belgeyi korur", async () => {
    const existing = await upload("customer-a");
    expect(existing.status).toBe(201);
    const existingFile = path.basename(existing.body.fileUrl);
    state.failCreate = true;

    const failed = await upload("customer-a");
    expect(failed.status).toBe(500);
    expect(failed.body.error).toBe("Sunucu hatası oluştu");
    expect(await fs.promises.readdir(state.tempDir)).toEqual([existingFile]);
    expect(state.documents.size).toBe(1);
  });

  it("başarılı yüklemede dosya ve metadata korunur, listede görünür", async () => {
    const uploaded = await upload("customer-a");
    expect(uploaded.status).toBe(201);
    expect(uploaded.body.fileName).toBe("belge.pdf");
    expect(uploaded.body.customerId).toBe("customer-a");
    expect(fs.existsSync(path.join(state.tempDir, path.basename(uploaded.body.fileUrl)))).toBe(true);

    const listed = await request(app).get("/customers/customer-a/documents");
    expect(listed.status).toBe(200);
    expect(listed.body.data).toHaveLength(1);
    expect(listed.body.data[0].id).toBe(uploaded.body.id);
  });

  it("müşteri yazımdan sonra silinirse bu isteğin dosyasını temizler", async () => {
    state.deleteCustomerOnPersist = true;
    const res = await upload("customer-a");
    expect(res.status).toBe(500);
    expect(state.documents.size).toBe(0);
    expect(await fs.promises.readdir(state.tempDir)).toEqual([]);
  });

  it("temizlik hatasında kontrollü genel yanıt döner", async () => {
    state.failCreate = true;
    state.failCleanup = true;
    const res = await upload("customer-a");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Sunucu hatası oluştu" });
    expect(JSON.stringify(res.body)).not.toContain("Gizli dosya yolu");
    expect(state.documents.size).toBe(0);
  });
});

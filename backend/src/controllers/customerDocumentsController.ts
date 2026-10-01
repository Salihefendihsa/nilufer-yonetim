import path from "path";
import type { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import { idParam } from "../lib/params";
import { recordAuditLog } from "../lib/auditLog";
import { uploadedFileUrl } from "../lib/upload";
import { cleanupFailedUpload, deleteFile, persistFile } from "../lib/storage";
import { logger } from "../lib/logger";

/**
 * Bölüm AB (6. tur): Müşteri belge kasası (OWNER/MANAGER).
 * - POST   /customers/:id/documents          multipart "file" (lib/upload.ts:uploadDocument)
 * - GET    /customers/:id/documents
 * - DELETE /customers/:id/documents/:docId   DB kaydı + diskteki dosya birlikte
 * Belge yalnızca kendi müşterisinin altından erişilir (docId + customerId eşleşmeli → aksi 404).
 */
const documentSelect = {
  id: true,
  customerId: true,
  fileName: true,
  fileUrl: true,
  fileType: true,
  fileSize: true,
  uploadedAt: true,
  uploadedBy: { select: { id: true, fullName: true } },
} as const;

async function loadCustomer(req: Request, res: Response) {
  const customer = await prisma.customer.findUnique({ where: { id: idParam(req) }, select: { id: true, userId: true } });
  if (!customer) {
    res.status(404).json({ error: "Müşteri bulunamadı" });
    return null;
  }
  return customer;
}

/** Yetki kontrolünden sonra, dosya diske yazılmadan önce müşteri varlığını doğrular. */
export async function ensureCustomerDocumentTarget(req: Request, res: Response, next: NextFunction) {
  const customer = await loadCustomer(req, res);
  if (!customer) return;
  res.locals.documentCustomer = customer;
  next();
}

export async function listCustomerDocuments(req: Request, res: Response) {
  const customer = await loadCustomer(req, res);
  if (!customer) return;
  const data = await prisma.customerDocument.findMany({
    where: { customerId: customer.id },
    orderBy: { uploadedAt: "desc" },
    select: documentSelect,
  });
  return res.json({ data });
}

export async function uploadCustomerDocument(req: Request, res: Response) {
  const customer = res.locals.documentCustomer as { id: string; userId: string | null } | undefined;
  if (!customer) return res.status(404).json({ error: "Müşteri bulunamadı" });
  if (!req.file) {
    return res.status(400).json({ error: "Dosya gerekli (alan adı: file)" });
  }

  const file = req.file;
  let doc;
  try {
    await persistFile(file.path, file.filename);
    doc = await prisma.customerDocument.create({
      data: {
        customerId: customer.id,
        // Orijinal ad kullanıcıya gösterilir; diskteki ad rastgele (upload.ts).
        fileName: file.originalname,
        fileUrl: uploadedFileUrl(file.filename),
        fileType: file.mimetype,
        fileSize: file.size,
        uploadedByUserId: req.user!.sub,
      },
      select: documentSelect,
    });
  } catch (err) {
    try {
      await cleanupFailedUpload(file);
    } catch {
      // Dosya yolu veya içerik loglanmaz; asıl hata genel hata işleyicisine gider.
      logger.error("customer_document_cleanup_failed");
    }
    throw err;
  }

  await recordAuditLog({
    actorUserId: req.user!.sub,
    action: "customer_document.uploaded",
    targetUserId: customer.userId ?? req.user!.sub,
    targetType: "CustomerDocument",
    targetId: doc.id,
    detail: doc.fileName,
  });

  return res.status(201).json(doc);
}

export async function deleteCustomerDocument(req: Request, res: Response) {
  const customer = await loadCustomer(req, res);
  if (!customer) return;
  const docId = req.params.docId as string;

  // customerId eşleşmesi: başka müşterinin belgesi bu yoldan silinemez (404).
  const doc = await prisma.customerDocument.findFirst({ where: { id: docId, customerId: customer.id } });
  if (!doc) {
    return res.status(404).json({ error: "Belge bulunamadı" });
  }

  await prisma.customerDocument.delete({ where: { id: doc.id } });
  // Depodaki dosya (S3 veya yerel disk): URL'den yalnızca dosya adı alınır (path traversal yok).
  await deleteFile(path.basename(doc.fileUrl)).catch(() => {}); // zaten yoksa sorun değil

  await recordAuditLog({
    actorUserId: req.user!.sub,
    action: "customer_document.deleted",
    targetUserId: customer.userId ?? req.user!.sub,
    targetType: "CustomerDocument",
    targetId: doc.id,
    detail: doc.fileName,
  });

  return res.status(204).send();
}

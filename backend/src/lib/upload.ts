import fs from "fs";
import path from "path";
import crypto from "crypto";
import multer from "multer";
import type { Request, Response, NextFunction } from "express";
import { UPLOADS_DIR, persistFile } from "./storage";

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || "";
    cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Yalnızca resim dosyaları yüklenebilir"));
      return;
    }
    cb(null, true);
  },
});

export function uploadedFileUrl(filename: string): string {
  return `/uploads/${filename}`;
}

/** Decodes a data-URL / base64 PNG (e.g. a signature pad export) and saves it as a file. Returns the public URL. */
export async function saveBase64Image(base64: string, prefix: string): Promise<string> {
  const match = /^data:image\/(\w+);base64,(.+)$/.exec(base64);
  const ext = match ? match[1] : "png";
  const data = match ? match[2] : base64;

  const filename = `${prefix}-${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const localPath = path.join(UPLOADS_DIR, filename);
  fs.writeFileSync(localPath, Buffer.from(data, "base64"));
  await persistFile(localPath, filename);
  return uploadedFileUrl(filename);
}

/**
 * `upload`/`uploadDocument` (multer diskStorage) her zaman önce yerel diske
 * yazar; nesne depolama (S3 vb.) yapılandırılmışsa bu middleware yüklenen
 * dosyayı oraya taşıyıp yerel kopyayı siler (bkz. lib/storage.ts). S3
 * yapılandırılmadıysa no-op — dosya yerel diskte kalır, davranış değişmez.
 * `upload.single(...)`/`uploadDocument.single(...)` middleware'inden HEMEN
 * sonra route'a eklenmelidir.
 */
export async function finalizeUpload(req: Request, _res: Response, next: NextFunction) {
  try {
    if (req.file) {
      await persistFile(req.file.path, req.file.filename);
    }
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Bölüm AB (6. tur): Müşteri belgeleri — resimlere ek olarak PDF ve ofis
 * belgeleri; 15 MB. Aynı depolama ve dosya adlandırması.
 */
const DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
]);

export function isAllowedDocumentMime(mimetype: string): boolean {
  return mimetype.startsWith("image/") || DOCUMENT_MIME_TYPES.has(mimetype);
}

export const uploadDocument = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!isAllowedDocumentMime(file.mimetype)) {
      cb(new Error("Yalnızca resim, PDF veya ofis belgeleri yüklenebilir"));
      return;
    }
    cb(null, true);
  },
});

import fs from "fs";
import path from "path";
import type { Request, Response } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { canAccessJob } from "../lib/access";
import { UPLOADS_DIR } from "../lib/upload";

/**
 * Bölüm AC (7. tur) — KRİTİK GÜVENLİK: Kimlik doğrulamalı dosya servisi.
 *
 * Eskiden `/uploads` express.static ile kimliksiz servis ediliyor, güvenlik
 * yalnızca rastgele dosya adına dayanıyordu. Artık statik mount YOK; her dosya
 * `GET /files/:type/:id` üzerinden, ilgili kaydın yetki kuralı uygulanarak
 * stream edilir. Yetki kuralları ilgili uçlarla BİREBİR aynıdır:
 *
 *   job-photo/:photoId          → canAccessJob (listJobPhotos ile aynı)
 *   job-signature/:jobId        → canAccessJob (getJobReport ile aynı)
 *   customer-document/:docId    → OWNER/MANAGER (customerDocuments uçlarıyla aynı)
 *   message-attachment/:msgId   → konuşmanın katılımcısı (sendMessage ile aynı)
 *
 * Var/yok bilgisi sızmasın diye yetkisiz ve bulunamayan durumlar ayrı kodla ama
 * tek tip mesajla döner: 403 "Bu dosyaya erişim yetkiniz yok", 404 "Dosya
 * bulunamadı". Diskteki dosya yolu daima `path.basename` ile üretilir
 * (traversal yok). URL token'sız üretilmez — istemciler Authorization header'ı
 * ile çeker (web: fetch+blob, mobil: Image.network headers).
 */
export const FILE_TYPES = ["job-photo", "job-signature", "customer-document", "message-attachment"] as const;
export type FileType = (typeof FILE_TYPES)[number];

const NOT_FOUND = { error: "Dosya bulunamadı" };
const FORBIDDEN = { error: "Bu dosyaya erişim yetkiniz yok" };

interface Resolved {
  /** Diskteki dosya adı (URL'nin basename'i). */
  filename: string;
  /** Content-Disposition için insan-okunur ad (opsiyonel). */
  downloadName?: string;
  /** Bilinen MIME (CustomerDocument saklıyor); yoksa uzantıdan çıkarılır. */
  mimeType?: string;
}

/** Yetki + kayıt çözümü. `null` → 404, `"forbidden"` → 403. */
async function resolveFile(type: FileType, id: string, user: { sub: string; role: Role }): Promise<Resolved | null | "forbidden"> {
  switch (type) {
    case "job-photo": {
      const photo = await prisma.jobPhoto.findUnique({ where: { id }, include: { job: { select: { customerId: true, assignedStaffId: true } } } });
      if (!photo) return null;
      if (!(await canAccessJob(user, photo.job))) return "forbidden";
      return { filename: path.basename(photo.url) };
    }
    case "job-signature": {
      const job = await prisma.job.findUnique({ where: { id }, select: { customerId: true, assignedStaffId: true } });
      if (!job) return null;
      if (!(await canAccessJob(user, job))) return "forbidden";
      const report = await prisma.jobReport.findFirst({ where: { jobId: id }, select: { signatureUrl: true } });
      if (!report?.signatureUrl) return null;
      return { filename: path.basename(report.signatureUrl) };
    }
    case "customer-document": {
      if (user.role !== Role.OWNER && user.role !== Role.MANAGER) return "forbidden";
      const doc = await prisma.customerDocument.findUnique({ where: { id } });
      if (!doc) return null;
      return { filename: path.basename(doc.fileUrl), downloadName: doc.fileName, mimeType: doc.fileType };
    }
    case "message-attachment": {
      const message = await prisma.message.findUnique({
        where: { id },
        select: { attachmentUrl: true, conversation: { select: { participantAId: true, participantBId: true } } },
      });
      if (!message) return null;
      const isParticipant = message.conversation.participantAId === user.sub || message.conversation.participantBId === user.sub;
      if (!isParticipant) return "forbidden";
      if (!message.attachmentUrl) return null;
      return { filename: path.basename(message.attachmentUrl) };
    }
  }
}

const EXT_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export async function serveFile(req: Request, res: Response) {
  const type = req.params.type as string;
  const id = req.params.id as string;
  if (!(FILE_TYPES as readonly string[]).includes(type)) {
    return res.status(404).json(NOT_FOUND);
  }

  const resolved = await resolveFile(type as FileType, id, req.user!);
  if (resolved === "forbidden") return res.status(403).json(FORBIDDEN);
  if (!resolved) return res.status(404).json(NOT_FOUND);

  const safeName = path.basename(resolved.filename);
  const filePath = path.join(UPLOADS_DIR, safeName);
  if (!filePath.startsWith(UPLOADS_DIR) || !fs.existsSync(filePath)) {
    return res.status(404).json(NOT_FOUND);
  }

  const mime = resolved.mimeType ?? EXT_MIME[path.extname(safeName).toLowerCase()] ?? "application/octet-stream";
  res.setHeader("Content-Type", mime);
  res.setHeader("Cache-Control", "private, max-age=300");
  // Web'de <img>/blob için inline; indirme butonu `download` özniteliğiyle adı verir.
  const dispositionName = encodeURIComponent(resolved.downloadName ?? safeName);
  res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${dispositionName}`);
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");

  const stream = fs.createReadStream(filePath);
  stream.on("error", () => {
    if (!res.headersSent) res.status(404).json(NOT_FOUND);
    else res.end();
  });
  return stream.pipe(res);
}

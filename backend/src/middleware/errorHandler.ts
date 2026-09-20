import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { recordError } from "../lib/metrics";
import { logger } from "../lib/logger";
import { captureException } from "../lib/errorReporting";
import multer from "multer";

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: "Girdiğiniz bilgilerde hata var", details: err.issues });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Bu bilgiyle zaten bir kayıt mevcut" });
    }
    if (err.code === "P2003") {
      return res.status(400).json({ error: "İlişkili kayıt bulunamadı" });
    }
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Kayıt bulunamadı" });
    }
  }

  // Bölüm AB (6. tur): dosya yükleme hataları istemci hatasıdır — boyut/sayı
  // sınırı (MulterError) ve fileFilter'ın fırlattığı tür reddi 400 döner.
  if (err instanceof multer.MulterError) {
    const message = err.code === "LIMIT_FILE_SIZE" ? "Dosya çok büyük" : "Dosya yüklenemedi";
    return res.status(400).json({ error: message });
  }
  if (err instanceof Error && /yüklenebilir$/.test(err.message)) {
    return res.status(400).json({ error: err.message });
  }

  recordError();

  // Beklenmeyen hatanın gerçek mesajı (İngilizce/teknik olabilir, dosya yolu
  // sızdırabilir) sunucu loguna yazılır ama istemciye asla ham haliyle
  // dönülmez — diğer tüm response'larla tutarlı, sabit bir Türkçe mesaj.
  logger.error({ err, method: req.method, path: req.originalUrl, userId: req.user?.sub }, "unhandled_error");
  captureException(err);
  return res.status(500).json({ error: "Sunucu hatası oluştu" });
}

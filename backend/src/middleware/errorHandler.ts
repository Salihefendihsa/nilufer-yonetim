import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { recordError } from "../lib/metrics";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
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

  recordError();

  if (err instanceof Error) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }

  console.error(err);
  return res.status(500).json({ error: "Sunucu hatası oluştu" });
}

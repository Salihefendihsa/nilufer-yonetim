import type { Request, Response } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { csvToRecords } from "../lib/csv";
import { generateReferralCode } from "../lib/referral";
import { recordAuditLog } from "../lib/auditLog";

/**
 * Bölüm AL (8. tur): Toplu müşteri içe aktarma (CSV).
 * Sütunlar: fullName, phone, email?, address?, district? (başlık satırı zorunlu,
 * büyük/küçük harf duyarsız; ayraç `,` veya `;`).
 * - Her satır ayrı işlenir (TEK transaction DEĞİL): bir satırın hatası diğerlerini engellemez.
 * - fullName+phone zorunlu; telefon doğrulaması mevcut Customer create şemasıyla aynı (min 1).
 * - Telefonu zaten kayıtlı satır atlanır (güncelleme YOK).
 * - Dosya bellekte tutulur, diske yazılmaz (kişisel veri).
 */
export const uploadCsv = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    // MIME tarayıcıya göre değişir (text/csv, application/vnd.ms-excel, octet-stream) — uzantı esas alınır.
    if (!/\.csv$/i.test(file.originalname)) {
      cb(new Error("Yalnızca .csv dosyası yüklenebilir"));
      return;
    }
    cb(null, true);
  },
});

// customersController.createSchema ile aynı kurallar (userId hariç).
const rowSchema = z.object({
  fullName: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().optional(),
  address: z.string().optional(),
  district: z.string().optional(),
});

const MAX_ROWS = 2000;

export interface ImportResult {
  created: number;
  skipped: number;
  errors: { row: number; reason: string }[];
}

export async function importCustomersCsv(req: Request, res: Response) {
  if (!req.file) return res.status(400).json({ error: "CSV dosyası gerekli (alan adı: file)" });

  const { headers, records } = csvToRecords(req.file.buffer.toString("utf8"));
  const lower = headers.map((h) => h.toLowerCase());
  if (!lower.includes("fullname") || !lower.includes("phone")) {
    return res.status(400).json({ error: "Başlık satırında fullName ve phone sütunları bulunmalı" });
  }
  if (records.length === 0) return res.status(400).json({ error: "CSV'de veri satırı yok" });
  if (records.length > MAX_ROWS) return res.status(400).json({ error: `En fazla ${MAX_ROWS} satır içe aktarılabilir` });

  const result: ImportResult = { created: 0, skipped: 0, errors: [] };
  const seenPhones = new Set<string>();

  for (let i = 0; i < records.length; i++) {
    const rowNo = i + 2; // 1 = başlık
    const rec = records[i];
    const parsed = rowSchema.safeParse({
      fullName: rec.fullname || undefined,
      phone: rec.phone || undefined,
      email: rec.email || undefined,
      address: rec.address || undefined,
      district: rec.district || undefined,
    });
    if (!parsed.success) {
      const missing = parsed.error.issues.map((iss) => iss.path.join(".")).join(", ");
      result.errors.push({ row: rowNo, reason: `Geçersiz/eksik alan: ${missing}` });
      continue;
    }
    const data = parsed.data;

    // Aynı dosya içinde yinelenen telefon da "atlandı" sayılır.
    if (seenPhones.has(data.phone)) {
      result.skipped++;
      continue;
    }
    seenPhones.add(data.phone);

    try {
      const exists = await prisma.customer.findFirst({ where: { phone: data.phone }, select: { id: true } });
      if (exists) {
        result.skipped++;
        continue;
      }
      await prisma.customer.create({ data: { ...data, referralCode: generateReferralCode() } });
      result.created++;
    } catch (err) {
      result.errors.push({ row: rowNo, reason: err instanceof Error ? err.message : "Kayıt oluşturulamadı" });
    }
  }

  await recordAuditLog({
    actorUserId: req.user!.sub,
    action: "customer.import_csv",
    targetUserId: req.user!.sub,
    targetType: "Customer",
    detail: `${result.created} eklendi, ${result.skipped} atlandı, ${result.errors.length} hata (${req.file.originalname})`,
  });

  return res.json(result);
}

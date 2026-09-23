import path from "path";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { readFileStream } from "./storage";
import { logger } from "./logger";

/**
 * Bölüm J: iş fotoğrafından yapay zekâ ile haşere tanıma.
 *
 * Akış: fotoğraf yüklenince `schedulePestAnalysis(photoId)` isteği bloklamadan
 * arka planda bir analiz başlatır; sonuç `PestDetection` olarak kaydedilir.
 *
 * Opsiyonel entegrasyon (SMTP/Firebase/S3 ile aynı desen): ANTHROPIC_API_KEY
 * yoksa analiz sessizce atlanır (bir kez loglanır), hiçbir şey fırlatılmaz.
 *
 * Maliyet güvenliği:
 * - Fotoğraf başına en fazla bir analiz: önce var mı bakılır (API çağrısı
 *   yapılmadan), PestDetection.jobPhotoId @unique yarışları da engeller;
 *   süreç içindeki eşzamanlı tetikler `inFlight` ile tekilleştirilir.
 * - Hata / hız sınırı / ret durumunda yeniden deneme YOK — kayıt oluşmaz,
 *   loglanıp geçilir (analizci istemcisi de otomatik yeniden denemesiz kurulur).
 * - Desteklenmeyen biçim veya 5 MB üstü görsel API'ye hiç gönderilmez.
 */

export const SUPPORTED_IMAGE_TYPES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
} as const;
export type SupportedImageType = (typeof SUPPORTED_IMAGE_TYPES)[keyof typeof SUPPORTED_IMAGE_TYPES];

/** Claude görsel girdisi için görsel başına üst sınır. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export interface PestAnalysis {
  /** Türkçe haşere adı; tespit yoksa "Tespit edilmedi". */
  pestType: string;
  /** 0-1 arası güven skoru. */
  confidence: number;
  /** Kısa Türkçe açıklama (bulgular, öneri). */
  description: string;
}

export interface PestAnalyzer {
  /** Kayda yazılan model kimliği. */
  readonly model: string;
  /** Başarısızlıkta null döndürmeli ya da fırlatmalı — çağıran yeniden denemez. */
  analyze(image: { data: Buffer; mediaType: SupportedImageType }): Promise<PestAnalysis | null>;
}

// undefined: henüz çözülmedi; null: devre dışı (anahtar yok).
let analyzer: PestAnalyzer | null | undefined;
// Varsayılan: Claude istemcisi — SDK yalnızca anahtar tanımlıyken dinamik yüklenir.
let analyzerFactory: (() => Promise<PestAnalyzer | null>) | null = async () =>
  (await import("./claudePestAnalyzer")).createClaudePestAnalyzer();

/**
 * Testler gerçek API çağrısı yapmadan akışı doğrulamak için sahte bir
 * analizci enjekte eder; `undefined` verilirse varsayılana (ortam) döner.
 */
export function setPestAnalyzerForTesting(value: PestAnalyzer | null | undefined): void {
  analyzer = value;
}

/** Varsayılan (Claude) analizci üreticisini değiştirir — ör. başka bir sağlayıcı. */
export function registerPestAnalyzerFactory(factory: () => Promise<PestAnalyzer | null>): void {
  analyzerFactory = factory;
}

async function getAnalyzer(): Promise<PestAnalyzer | null> {
  if (analyzer !== undefined) return analyzer;
  if (!process.env.ANTHROPIC_API_KEY || !analyzerFactory) {
    logger.info("ANTHROPIC_API_KEY tanımlı değil, yapay zekâ haşere analizi atlanıyor.");
    analyzer = null;
    return analyzer;
  }
  try {
    analyzer = await analyzerFactory();
  } catch (err) {
    logger.error({ err }, "Haşere analizcisi başlatılamadı, analiz devre dışı");
    analyzer = null;
  }
  return analyzer;
}

async function readBytes(filename: string): Promise<Buffer | null> {
  const file = await readFileStream(filename);
  if (!file) return null;
  if (file.contentLength && file.contentLength > MAX_IMAGE_BYTES) return null;
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of file.stream as AsyncIterable<Buffer | string>) {
    const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
    total += buf.length;
    if (total > MAX_IMAGE_BYTES) return null;
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

export type PestAnalysisOutcome = "created" | "exists" | "in_progress" | "disabled" | "skipped" | "failed";

const inFlight = new Set<string>();

/** Bir fotoğrafı analiz eder; hiçbir koşulda fırlatmaz. */
export async function analyzeJobPhoto(photoId: string): Promise<PestAnalysisOutcome> {
  // Aynı süreçte bu fotoğraf için zaten bir analiz sürüyor.
  if (inFlight.has(photoId)) return "in_progress";
  inFlight.add(photoId);
  try {
    const existing = await prisma.pestDetection.findUnique({ where: { jobPhotoId: photoId }, select: { id: true } });
    if (existing) return "exists";

    const current = await getAnalyzer();
    if (!current) return "disabled";

    const photo = await prisma.jobPhoto.findUnique({ where: { id: photoId } });
    if (!photo) return "skipped";
    const filename = path.basename(photo.url);
    const mediaType = SUPPORTED_IMAGE_TYPES[path.extname(filename).toLowerCase() as keyof typeof SUPPORTED_IMAGE_TYPES];
    if (!mediaType) return "skipped";
    const data = await readBytes(filename);
    if (!data) return "skipped";

    let result: PestAnalysis | null;
    try {
      result = await current.analyze({ data, mediaType });
    } catch (err) {
      // Yeniden deneme yok: hız sınırı, ağ hatası veya ret — bu fotoğraf analizsiz kalır.
      logger.warn({ err, photoId }, "Haşere analizi başarısız, atlandı (yeniden denenmeyecek)");
      return "failed";
    }
    if (!result) return "failed";

    try {
      await prisma.pestDetection.create({
        data: {
          jobPhotoId: photoId,
          detectedPestType: result.pestType.trim().slice(0, 120) || "Belirsiz",
          confidence: Math.min(1, Math.max(0, result.confidence)),
          description: result.description.trim().slice(0, 2000),
          model: current.model,
        },
      });
      return "created";
    } catch (err) {
      // Başka bir süreç aynı fotoğrafı önce kaydetmiş (unique) ya da fotoğraf
      // bu arada silinmiş (FK) — ikisi de sessizce geçilir.
      if (err instanceof Prisma.PrismaClientKnownRequestError && (err.code === "P2002" || err.code === "P2003")) {
        return "exists";
      }
      logger.error({ err, photoId }, "Haşere analizi kaydedilemedi");
      return "failed";
    }
  } catch (err) {
    logger.error({ err, photoId }, "Haşere analizi beklenmedik hata");
    return "failed";
  } finally {
    inFlight.delete(photoId);
  }
}

/** Yükleme isteğini bloklamadan analizi arka planda başlatır. */
export function schedulePestAnalysis(photoId: string): void {
  setImmediate(() => {
    void analyzeJobPhoto(photoId);
  });
}

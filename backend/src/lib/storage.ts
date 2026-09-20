import fs from "fs";
import path from "path";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

export const UPLOADS_DIR = path.join(__dirname, "..", "..", "uploads");

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Nesne depolama (S3-uyumlu: AWS S3, Cloudflare R2, MinIO, Backblaze B2 ...)
 * için opsiyonel arka uç. S3_BUCKET/S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY
 * tanımlı değilse tamamen devre dışı kalır ve her şey eskisi gibi
 * `backend/uploads/` altında yerel diskte kalır — SMTP/reCAPTCHA/Firebase
 * ile aynı "yapılandırılmadıysa sessizce atla" deseni.
 */
export function isS3Configured(): boolean {
  const { S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = process.env;
  return Boolean(S3_BUCKET && S3_ACCESS_KEY_ID && S3_SECRET_ACCESS_KEY);
}

let client: S3Client | null | undefined;

function getClient(): S3Client | null {
  if (client !== undefined) return client;
  if (!isS3Configured()) {
    client = null;
    return client;
  }
  client = new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: Boolean(process.env.S3_ENDPOINT),
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  });
  return client;
}

function bucket(): string {
  return process.env.S3_BUCKET!;
}

/**
 * Yerel diske yazılmış bir dosyayı (multer diskStorage veya saveBase64Image
 * çıktısı) nesne depolamaya taşır ve yerel kopyayı siler. S3 yapılandırılmadıysa
 * no-op — dosya yerel diskte kalır (mevcut davranış, davranış değişikliği yok).
 */
export async function persistFile(localPath: string, filename: string): Promise<void> {
  const s3 = getClient();
  if (!s3) return;

  const body = fs.readFileSync(localPath);
  await s3.send(new PutObjectCommand({ Bucket: bucket(), Key: filename, Body: body }));
  fs.unlinkSync(localPath);
}

export interface FileStreamResult {
  stream: NodeJS.ReadableStream;
  contentLength?: number;
}

/** S3 yapılandırılmışsa oradan, değilse yerel diskten okur. Bulunamazsa null. */
export async function readFileStream(filename: string): Promise<FileStreamResult | null> {
  const s3 = getClient();
  if (s3) {
    try {
      const obj = await s3.send(new GetObjectCommand({ Bucket: bucket(), Key: filename }));
      if (!obj.Body) return null;
      return { stream: obj.Body as unknown as NodeJS.ReadableStream, contentLength: obj.ContentLength };
    } catch {
      return null;
    }
  }

  const filePath = path.join(UPLOADS_DIR, filename);
  if (!filePath.startsWith(UPLOADS_DIR) || !fs.existsSync(filePath)) return null;
  return { stream: fs.createReadStream(filePath) };
}

/** Bir dosyayı depodan (S3 veya yerel disk) siler. Bulunamazsa sessizce döner. */
export async function deleteFile(filename: string): Promise<void> {
  const s3 = getClient();
  if (s3) {
    await s3.send(new DeleteObjectCommand({ Bucket: bucket(), Key: filename })).catch(() => undefined);
    return;
  }
  const filePath = path.join(UPLOADS_DIR, filename);
  if (filePath.startsWith(UPLOADS_DIR) && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

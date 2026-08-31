import fs from "fs";
import path from "path";
import crypto from "crypto";
import multer from "multer";

export const UPLOADS_DIR = path.join(__dirname, "..", "..", "uploads");

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

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
export function saveBase64Image(base64: string, prefix: string): string {
  const match = /^data:image\/(\w+);base64,(.+)$/.exec(base64);
  const ext = match ? match[1] : "png";
  const data = match ? match[2] : base64;

  const filename = `${prefix}-${Date.now()}-${crypto.randomUUID()}.${ext}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), Buffer.from(data, "base64"));
  return uploadedFileUrl(filename);
}

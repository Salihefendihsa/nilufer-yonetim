import { randomBytes } from "crypto";
import { prisma } from "./prisma";

/**
 * Bölüm P (4. tur): Arkadaşını Davet Et — müşteri davet kodu.
 * Kod kısa, büyük harf + rakam, karışabilen karakterler (0/O, 1/I/L) yok.
 * İndirim/ödül mekanizması bilinçli olarak YOK — yalnızca takip/gösterim
 * (bkz. docs: "indirim/ödül mekanizması ayrı bir karar gerektirir").
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

export function generateReferralCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/** Müşterinin kodu yoksa üretir (unique çakışmasında yeniden dener) ve döner. */
export async function ensureReferralCode(customerId: string): Promise<string> {
  const existing = await prisma.customer.findUnique({ where: { id: customerId }, select: { referralCode: true } });
  if (existing?.referralCode) return existing.referralCode;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateReferralCode();
    try {
      const updated = await prisma.customer.update({ where: { id: customerId }, data: { referralCode: code }, select: { referralCode: true } });
      return updated.referralCode!;
    } catch {
      /* unique çakışması — yeniden dene */
    }
  }
  throw new Error("Davet kodu üretilemedi");
}

export function normalizeReferralCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return /^[A-Z0-9]{4,12}$/.test(code) ? code : null;
}

/** Davet linki — web'deki anonim teklif formu (?ref=). */
export function referralInviteLink(code: string): string {
  const base = (process.env.WEB_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/teklif-al?ref=${encodeURIComponent(code)}`;
}

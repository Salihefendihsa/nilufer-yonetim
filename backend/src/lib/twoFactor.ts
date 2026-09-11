import { createHash, randomBytes } from "crypto";
import { generateSecret, generateURI, verify } from "otplib";

const ISSUER = "Nilüfer İlaçlama";

export function generateTwoFactorSecret(): string {
  return generateSecret();
}

export function buildOtpauthUri(email: string, secret: string): string {
  return generateURI({ issuer: ISSUER, label: email, secret });
}

export async function verifyTotpCode(secret: string, token: string): Promise<boolean> {
  if (!/^\d{6}$/.test(token)) return false;
  const result = await verify({ secret, token });
  return result.valid;
}

function hashCode(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** 10 tek kullanımlık kurtarma kodu — ham hâlleri yalnızca üretim anında döner. */
export function generateRecoveryCodes(count = 10): { raw: string[]; hashes: string[] } {
  const raw: string[] = [];
  const hashes: string[] = [];
  for (let i = 0; i < count; i++) {
    const code = randomBytes(5).toString("hex").toUpperCase(); // 10 hex karakter
    const formatted = `${code.slice(0, 5)}-${code.slice(5)}`;
    raw.push(formatted);
    hashes.push(hashCode(formatted));
  }
  return { raw, hashes };
}

export function hashRecoveryCode(raw: string): string {
  return hashCode(raw.trim().toUpperCase());
}

export function generateChallengeToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("hex");
  return { raw, hash: hashCode(raw) };
}

export function hashChallengeToken(raw: string): string {
  return hashCode(raw);
}

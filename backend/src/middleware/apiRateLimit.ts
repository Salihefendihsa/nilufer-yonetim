import type { Request } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { verifyToken } from "../lib/jwt";

/**
 * Genel API istek limiti (login/şifre sıfırlama limitleri ayrı —
 * middleware/loginRateLimit.ts, bunlar aynen korunur).
 *
 * Eskiden tek kova vardı: IP başına 300 istek / 15 dk. Tek bir Patron
 * mobilde ~12 ekran gezince doluyordu; ofis NAT'ı arkasında tüm çalışanlar
 * aynı kovayı paylaştığı için yoğun saatte herkes 429 alırdı.
 *
 * Şimdi:
 * - Geçerli (imzası doğrulanmış) JWT taşıyan istek → KULLANICI başına kova.
 *   İmza doğrulanır; aksi halde sahte bir `sub` ile yeni kova açılıp limit
 *   atlatılabilirdi. Süresi dolmuş/geçersiz token IP kovasına düşer.
 * - Kimliksiz istek → IP başına kova (düşük limit).
 */
export const API_WINDOW_MS = 15 * 60 * 1000;
export const API_USER_LIMIT = 2000;
export const API_ANON_IP_LIMIT = 300;

function authenticatedUserId(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  try {
    return verifyToken(header.slice(7)).sub;
  } catch {
    return null;
  }
}

export function createApiRateLimiter(opts: { userLimit?: number; anonLimit?: number; windowMs?: number; skip?: () => boolean } = {}) {
  const userLimit = opts.userLimit ?? API_USER_LIMIT;
  const anonLimit = opts.anonLimit ?? API_ANON_IP_LIMIT;
  return rateLimit({
    windowMs: opts.windowMs ?? API_WINDOW_MS,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      const userId = authenticatedUserId(req);
      return userId ? `u:${userId}` : `ip:${ipKeyGenerator(req.ip ?? "unknown")}`;
    },
    limit: (req) => (authenticatedUserId(req) ? userLimit : anonLimit),
    message: { error: "Çok fazla istek gönderildi, lütfen biraz bekleyip tekrar deneyin." },
    skip: opts.skip,
  });
}

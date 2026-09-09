import type { Request, Response, NextFunction } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";

/** IP + e-posta birleşimiyle anahtarlanır — tek bir IP'den farklı hesapları
 * denemeye çalışan bir saldırgan da, tek bir hesabı farklı IP'lerden
 * denemeye çalışan bir saldırgan da yakalanır. */
function loginKeyGenerator(req: Request): string {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  return `${ipKeyGenerator(req.ip ?? "unknown")}:${email}`;
}

const RATE_LIMIT_MESSAGE = { error: "Çok fazla giriş denemesi yapıldı, lütfen daha sonra tekrar deneyin" };

/** Web girişi için standart limit. */
const webLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  keyGenerator: loginKeyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  message: RATE_LIMIT_MESSAGE,
});

/**
 * Mobil girişler reCAPTCHA'yı atladığı için (bkz. authController.ts:
 * isVerifiedMobileClient) buradaki limit KASITLI OLARAK daha sıkı —
 * bypass edilen bot/brute-force korumasının kısmi bir telafisi.
 */
const mobileLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  keyGenerator: loginKeyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  message: RATE_LIMIT_MESSAGE,
});

/**
 * Hangi limitin uygulanacağı YALNIZCA `X-Client-Type` header'ının varlığına
 * bakar (sır doğrulaması burada YAPILMAZ) — bu kasıtlı: sırrı bilmeyen biri
 * "mobile" header'ını taklit etse bile daha sıkı limite düşer (kendi
 * aleyhine), sırrı bilen gerçek mobil istemci zaten bu sıkı limiti hak eder.
 * Dolayısıyla limit seçiminde sahte header'dan doğan bir bypass riski yoktur.
 */
export function loginRateLimiter(req: Request, res: Response, next: NextFunction) {
  const isMobileClaim = req.headers["x-client-type"] === "mobile";
  return isMobileClaim ? mobileLoginLimiter(req, res, next) : webLoginLimiter(req, res, next);
}

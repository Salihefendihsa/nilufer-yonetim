import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import { createHash, timingSafeEqual } from "crypto";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { signToken } from "../lib/jwt";
import { verifyRecaptcha } from "../lib/recaptcha";

const SALT_ROUNDS = 10;

/** Sabit uzunluklu (hash'lenmiş) zamanlama-güvenli karşılaştırma — doğrudan
 * string karşılaştırma erken-çıkışla sızıntı verebileceği için kullanılmaz. */
function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/**
 * Flutter mobil istemcisi reCAPTCHA v3 üretemez (tarayıcı/JS'e bağımlı bir
 * mekanizma; mobilde WebView kullanmama kararı kesin — bkz.
 * docs/STITCH_FEATURE_MATRIX.md "reCAPTCHA/Mobil Giriş Kararı"). Bu yüzden
 * mobil istemci ayrı bir yoldan geçer: yalnızca `X-Client-Type: mobile`
 * header'ına bakmak YETERSİZ — herkes bu header'ı taklit edip reCAPTCHA'yı
 * atlatabilir. Bu yüzden ayrıca `.env`'deki MOBILE_APP_SECRET ile eşleşen
 * `X-Mobile-App-Key` header'ı da zorunlu tutulur.
 *
 * ÖNEMLİ SINIRLAMA: Bu paylaşılan sır mobil derlemenin (APK/IPA) içine gömülü
 * olduğundan tersine mühendislikle çıkarılabilir — gerçek bir kimlik
 * doğrulaması DEĞİL, yalnızca "bu istek gerçek mobil uygulamamızdan mı yoksa
 * rastgele bir bot mu" ayrımını zorlaştıran ikinci bir savunma katmanıdır.
 * Asıl brute-force telafisi, mobil girişlere özel daha sıkı rate limit'tir
 * (bkz. middleware/loginRateLimit.ts).
 */
function isVerifiedMobileClient(req: Request): boolean {
  const secret = process.env.MOBILE_APP_SECRET;
  if (!secret) return false; // sır yapılandırılmamışsa asla bypass edilmez (fail-closed)

  const clientType = req.headers["x-client-type"];
  const appKey = req.headers["x-mobile-app-key"];
  if (clientType !== "mobile" || typeof appKey !== "string" || appKey.length === 0) return false;

  return safeEqual(appKey, secret);
}

// Herkese açık kayıt (requireAuth yok, routes/auth.ts:7) — role kasıtlı olarak
// şemada yer almıyor. Gövdeden rol kabul edilirse kimliksiz bir istekle OWNER
// hesabı açılabilir; bu uçtan doğan her hesap CUSTOMER'dır.
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1),
  phone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  recaptchaToken: z.string().optional(),
});

export async function register(req: Request, res: Response) {
  const { email, password, fullName, phone } = registerSchema.parse(req.body);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "Bu e-posta adresi zaten kullanılıyor" });
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      fullName,
      phone,
      role: Role.CUSTOMER,
    },
  });

  const token = signToken({ sub: user.id, role: user.role, email: user.email });

  return res.status(201).json({
    token,
    user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
  });
}

export async function login(req: Request, res: Response) {
  const { email, password, recaptchaToken } = loginSchema.parse(req.body);

  // Web akışı reCAPTCHA korumasını AYNEN korur; yalnızca doğrulanmış mobil
  // istemci bu kontrolü atlar (bkz. isVerifiedMobileClient üstteki not).
  if (!isVerifiedMobileClient(req) && !(await verifyRecaptcha(recaptchaToken, "login"))) {
    return res.status(400).json({ error: "Doğrulama başarısız, lütfen tekrar deneyin" });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ error: "E-posta veya şifre hatalı" });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "E-posta veya şifre hatalı" });
  }

  const session = await prisma.userSession.create({
    data: { userId: user.id, deviceInfo: req.headers["user-agent"] ?? undefined },
  });

  const token = signToken({ sub: user.id, role: user.role, email: user.email, sessionId: session.id });

  return res.json({
    token,
    user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
  });
}

export async function heartbeat(req: Request, res: Response) {
  const sessionId = req.user!.sessionId;
  if (!sessionId) {
    return res.json({ ok: true });
  }

  await prisma.userSession.updateMany({
    where: { id: sessionId, userId: req.user!.sub },
    data: { lastActiveAt: new Date() },
  });

  return res.json({ ok: true });
}

export async function logoutSession(req: Request, res: Response) {
  const sessionId = req.user!.sessionId;
  if (sessionId) {
    await prisma.userSession.updateMany({
      where: { id: sessionId, userId: req.user!.sub },
      data: { logoutAt: new Date(), lastActiveAt: new Date() },
    });
  }

  return res.json({ ok: true });
}

export async function me(req: Request, res: Response) {
  const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
  if (!user) {
    return res.status(404).json({ error: "Kullanıcı bulunamadı" });
  }

  return res.json({
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    role: user.role,
    createdAt: user.createdAt,
  });
}

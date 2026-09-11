import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { signToken } from "../lib/jwt";
import { verifyRecaptcha } from "../lib/recaptcha";
import { sendEmail } from "../lib/email";

const SALT_ROUNDS = 10;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 saat — makul bir varsayılan, docs/SECURITY.md'de not edildi.

/** Ham sıfırlama token'ı asla DB'de durmaz — yalnızca bu hash saklanır/karşılaştırılır. */
function hashResetToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

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

  const token = signToken({ sub: user.id, role: user.role, email: user.email, tokenVersion: user.tokenVersion });

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

  const token = signToken({
    sub: user.id,
    role: user.role,
    email: user.email,
    sessionId: session.id,
    tokenVersion: user.tokenVersion,
  });

  return res.json({
    token,
    user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
    mustChangePassword: user.mustChangePassword,
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
    mustChangePassword: user.mustChangePassword,
  });
}

const forgotPasswordSchema = z.object({ email: z.string().email() });

/**
 * Kullanıcı var/yok fark etmeksizin AYNI başarı mesajı döner (email
 * enumeration'ı önlemek için) — yalnızca kullanıcı gerçekten varsa arka
 * planda bir token üretilip e-posta gönderilir.
 */
export async function forgotPassword(req: Request, res: Response) {
  const { email } = forgotPasswordSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    const rawToken = randomBytes(32).toString("hex");
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token: hashResetToken(rawToken),
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });

    const webUrl = process.env.WEB_APP_URL ?? "http://localhost:3000";
    const resetUrl = `${webUrl}/sifre-sifirla?token=${rawToken}`;
    await sendEmail(
      user.email,
      "Şifre Sıfırlama Talebi",
      `<p>Merhaba ${user.fullName},</p><p>Şifrenizi sıfırlamak için <a href="${resetUrl}">bu bağlantıya</a> tıklayın. Bağlantı 1 saat geçerlidir.</p><p>Bu talebi siz yapmadıysanız bu e-postayı yok sayabilirsiniz.</p>`
    );
  }

  return res.json({ message: "Bu e-posta adresi sistemde kayıtlıysa bir sıfırlama bağlantısı gönderildi." });
}

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8),
});

export async function resetPassword(req: Request, res: Response) {
  const { token, newPassword } = resetPasswordSchema.parse(req.body);
  const tokenHash = hashResetToken(token);

  const resetToken = await prisma.passwordResetToken.findUnique({ where: { token: tokenHash } });
  if (!resetToken || resetToken.usedAt || resetToken.expiresAt.getTime() < Date.now()) {
    return res.status(400).json({ error: "Sıfırlama bağlantısı geçersiz veya süresi dolmuş" });
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash, mustChangePassword: false, tokenVersion: { increment: 1 } },
    }),
    prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } }),
  ]);

  return res.json({ message: "Şifreniz güncellendi, yeniden giriş yapabilirsiniz." });
}

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

/**
 * Zorunlu şifre değiştirme ekranı (OWNER birinin şifresini sıfırladığında)
 * VE isteğe bağlı kendi kendine şifre değiştirme için ortak uç. `currentPassword`
 * her zaman zorunlu — çalıntı bir JWT'nin tek başına şifreyi değiştirebilmesini
 * önler (geçici şifre zaten yalnızca OWNER'ın ekranında bir kereliğine
 * gösterildiği için kullanıcı bunu biliyor olmalı).
 */
export async function changePassword(req: Request, res: Response) {
  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
  if (!user) {
    return res.status(404).json({ error: "Kullanıcı bulunamadı" });
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Mevcut şifre hatalı" });
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, mustChangePassword: false, tokenVersion: { increment: 1 } },
  });

  const session = await prisma.userSession.create({
    data: { userId: user.id, deviceInfo: req.headers["user-agent"] ?? undefined },
  });
  const token = signToken({
    sub: user.id,
    role: user.role,
    email: user.email,
    sessionId: session.id,
    tokenVersion: user.tokenVersion + 1,
  });

  return res.json({ token, user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role } });
}

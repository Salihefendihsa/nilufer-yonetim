import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import QRCode from "qrcode";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { signToken } from "../lib/jwt";
import { recordAuditLog } from "../lib/auditLog";
import {
  generateTwoFactorSecret,
  buildOtpauthUri,
  verifyTotpCode,
  generateRecoveryCodes,
  hashRecoveryCode,
  generateChallengeToken,
  hashChallengeToken,
} from "../lib/twoFactor";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

/**
 * Sırrı üretir ve User.twoFactorSecret'e yazar ama twoFactorEnabled'ı HENÜZ
 * true yapmaz — kullanıcı /2fa/enable ile authenticator uygulamasından
 * gerçek bir kod göndermeden 2FA aktif olmaz (yanlış kurulum kilitlenmesini
 * önler).
 */
export async function setupTwoFactor(req: Request, res: Response) {
  const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
  if (!user) {
    return res.status(404).json({ error: "Kullanıcı bulunamadı" });
  }
  if (user.twoFactorEnabled) {
    return res.status(400).json({ error: "İki adımlı doğrulama zaten etkin" });
  }

  const secret = generateTwoFactorSecret();
  await prisma.user.update({ where: { id: user.id }, data: { twoFactorSecret: secret } });

  const otpauthUri = buildOtpauthUri(user.email, secret);
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUri);

  return res.json({ secret, otpauthUri, qrCodeDataUrl });
}

const enableSchema = z.object({ code: z.string().min(6).max(6) });

export async function enableTwoFactor(req: Request, res: Response) {
  const { code } = enableSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
  if (!user || !user.twoFactorSecret) {
    return res.status(400).json({ error: "Önce /auth/2fa/setup ile kurulum başlatılmalı" });
  }
  if (user.twoFactorEnabled) {
    return res.status(400).json({ error: "İki adımlı doğrulama zaten etkin" });
  }

  const valid = await verifyTotpCode(user.twoFactorSecret, code);
  if (!valid) {
    return res.status(400).json({ error: "Kod hatalı veya süresi dolmuş" });
  }

  const { raw, hashes } = generateRecoveryCodes();

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: true } }),
    prisma.twoFactorRecoveryCode.createMany({
      data: hashes.map((codeHash) => ({ userId: user.id, codeHash })),
    }),
  ]);

  await recordAuditLog({
    actorUserId: user.id,
    action: "user.2fa_enabled",
    targetUserId: user.id,
    targetType: "User",
    targetId: user.id,
    detail: "İki adımlı doğrulama etkinleştirildi",
  });

  return res.json({ recoveryCodes: raw });
}

const disableSchema = z.object({ currentPassword: z.string().min(1) });

export async function disableTwoFactor(req: Request, res: Response) {
  const { currentPassword } = disableSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
  if (!user) {
    return res.status(404).json({ error: "Kullanıcı bulunamadı" });
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Mevcut şifre hatalı" });
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    }),
    prisma.twoFactorRecoveryCode.deleteMany({ where: { userId: user.id } }),
  ]);

  await recordAuditLog({
    actorUserId: user.id,
    action: "user.2fa_disabled",
    targetUserId: user.id,
    targetType: "User",
    targetId: user.id,
    detail: "İki adımlı doğrulama devre dışı bırakıldı",
  });

  return res.json({ message: "İki adımlı doğrulama devre dışı bırakıldı" });
}

/** login() şifre doğrulandıktan sonra twoFactorEnabled=true ise bunu çağırıp
 * JWT yerine döner. */
export async function createTwoFactorChallenge(userId: string) {
  const { raw, hash } = generateChallengeToken();
  await prisma.twoFactorChallenge.create({
    data: { userId, tokenHash: hash, expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS) },
  });
  return raw;
}

const verifySchema = z.object({
  preToken: z.string().min(1),
  code: z.string().min(1).optional(),
  recoveryCode: z.string().min(1).optional(),
});

export async function verifyTwoFactor(req: Request, res: Response) {
  const { preToken, code, recoveryCode } = verifySchema.parse(req.body);
  if (!code && !recoveryCode) {
    return res.status(400).json({ error: "Kod veya kurtarma kodu gerekli" });
  }

  const tokenHash = hashChallengeToken(preToken);
  const challenge = await prisma.twoFactorChallenge.findUnique({ where: { tokenHash } });
  if (!challenge || challenge.consumedAt || challenge.expiresAt.getTime() < Date.now()) {
    return res.status(401).json({ error: "Doğrulama isteğinin süresi doldu, tekrar giriş yapın" });
  }

  const user = await prisma.user.findUnique({ where: { id: challenge.userId } });
  if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
    return res.status(401).json({ error: "Geçersiz istek" });
  }

  let validated = false;
  if (code) {
    validated = await verifyTotpCode(user.twoFactorSecret, code);
  } else if (recoveryCode) {
    const codeHash = hashRecoveryCode(recoveryCode);
    const recovery = await prisma.twoFactorRecoveryCode.findUnique({ where: { codeHash } });
    if (recovery && recovery.userId === user.id && !recovery.usedAt) {
      await prisma.twoFactorRecoveryCode.update({ where: { id: recovery.id }, data: { usedAt: new Date() } });
      validated = true;
    }
  }

  if (!validated) {
    return res.status(401).json({ error: "Kod hatalı" });
  }

  await prisma.twoFactorChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } });

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

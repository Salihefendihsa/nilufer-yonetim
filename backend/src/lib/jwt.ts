import jwt from "jsonwebtoken";
import type { Role } from "@prisma/client";

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set in the environment");
  }
  return secret;
}

export interface JwtPayload {
  sub: string;
  role: Role;
  email: string;
  sessionId?: string;
  /** User.tokenVersion anlık değeriyle karşılaştırılır (bkz. middleware/auth.ts)
   * — şifre sıfırlama gibi güvenlik olaylarında bu token'lar geçersiz kılınır. */
  tokenVersion: number;
  /** Bu bir impersonation token'ıysa: OWNER'ın User.id'si. */
  impersonatedBy?: string;
  /** Bu bir impersonation token'ıysa: ImpersonationSession.id — sonlandırılan
   * bir oturumun token'ının hemen reddedilebilmesi için. */
  impersonationSessionId?: string;
}

/**
 * Normal oturumlar 7 gün geçerli. Impersonation token'ları KASITLI OLARAK
 * çok daha kısa (1 saat) — hem yanlışlıkla uzun süre "başkası olarak"
 * kalınmasını önler hem de sızıntı riskini sınırlar. Bu süre bir iş kararı
 * değil, makul bir varsayılan (docs/SECURITY.md'de not edildi).
 */
export function signToken(payload: JwtPayload): string {
  const expiresIn = payload.impersonationSessionId ? "1h" : "7d";
  return jwt.sign(payload, getSecret(), { expiresIn });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, getSecret()) as unknown as JwtPayload;
}

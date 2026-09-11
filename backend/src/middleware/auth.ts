import type { Request, Response, NextFunction } from "express";
import { Role } from "@prisma/client";
import { verifyToken, type JwtPayload } from "../lib/jwt";
import { hasPermission } from "../lib/access";
import type { PermissionKey } from "../lib/permissions";
import { prisma } from "../lib/prisma";
import { runWithRequestContext } from "../lib/requestContext";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

// mustChangePassword=true iken bu tam yollara (mount path dahil) erişim serbest
// kalır — geri kalan HER UÇ 403 döner (bkz. schema.prisma User.mustChangePassword).
const FORCE_CHANGE_ALLOWED_PATHS = new Set(["/auth/me", "/auth/logout", "/auth/change-password"]);

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Yetkilendirme başlığı eksik veya geçersiz" });
  }

  const token = header.slice("Bearer ".length);
  let payload: JwtPayload;
  try {
    payload = verifyToken(token);
  } catch {
    return res.status(401).json({ error: "Geçersiz veya süresi dolmuş oturum" });
  }

  try {
    // Şifre sıfırlama gibi güvenlik olayları User.tokenVersion'ı artırır —
    // eski token'lar (imzaları hâlâ geçerli olsa bile) burada elenir. JWT'ler
    // stateless olduğu için gerçek "oturum iptali" tek yolu budur.
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { tokenVersion: true, mustChangePassword: true, isActive: true },
    });
    if (!user || user.tokenVersion !== payload.tokenVersion) {
      return res.status(401).json({ error: "Oturumunuzun süresi doldu, tekrar giriş yapın" });
    }
    // İşten çıkarma (terminate) tokenVersion'ı zaten artırır (mevcut tüm
    // token'lar bir üstteki kontrolle elenir) — bu, o mekanizma bir şekilde
    // atlatılsa bile ikinci bir savunma katmanı.
    if (!user.isActive) {
      return res.status(403).json({ error: "Hesabınız devre dışı bırakılmış" });
    }

    if (payload.impersonationSessionId) {
      const impersonation = await prisma.impersonationSession.findUnique({
        where: { id: payload.impersonationSessionId },
        select: { endedAt: true },
      });
      if (!impersonation || impersonation.endedAt) {
        return res.status(401).json({ error: "Impersonation oturumu sona erdi" });
      }
    }

    if (user.mustChangePassword) {
      const path = req.originalUrl.split("?")[0];
      if (!FORCE_CHANGE_ALLOWED_PATHS.has(path)) {
        return res.status(403).json({ error: "Önce şifrenizi değiştirmeniz gerekiyor", mustChangePassword: true });
      }
    }

    req.user = payload;
    runWithRequestContext({ impersonatedBy: payload.impersonatedBy }, next);
  } catch (err) {
    next(err);
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Giriş yapmanız gerekiyor" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Bu işlem için yetkiniz yok" });
    }
    next();
  };
}

/** OWNER always passes. STAFF/TEAM_LEAD/MANAGER pass if their Permission record has key=true. */
export function requirePermission(key: PermissionKey) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Giriş yapmanız gerekiyor" });
    }
    if (req.user.role === Role.OWNER) {
      return next();
    }
    if (await hasPermission(req.user.sub, key)) {
      return next();
    }
    return res.status(403).json({ error: "Bu işlem için yetkiniz yok" });
  };
}

/** Passes for OWNER, any role in `roles`, or a STAFF/TEAM_LEAD granted `key`. An additional layer next to requireRole. */
export function requireRoleOrPermission(roles: Role[], key: PermissionKey) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Giriş yapmanız gerekiyor" });
    }
    if (req.user.role === Role.OWNER || roles.includes(req.user.role)) {
      return next();
    }
    if (await hasPermission(req.user.sub, key)) {
      return next();
    }
    return res.status(403).json({ error: "Bu işlem için yetkiniz yok" });
  };
}

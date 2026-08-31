import type { Request, Response, NextFunction } from "express";
import { Role } from "@prisma/client";
import { verifyToken, type JwtPayload } from "../lib/jwt";
import { hasPermission } from "../lib/access";
import type { PermissionKey } from "../lib/permissions";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Yetkilendirme başlığı eksik veya geçersiz" });
  }

  const token = header.slice("Bearer ".length);
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    return res.status(401).json({ error: "Geçersiz veya süresi dolmuş oturum" });
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

import type { Request, Response } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { idParam } from "../lib/params";
import { resolveSupervisorInfo, wouldCreateSupervisorCycle } from "../lib/access";
import { recordAuditLog } from "../lib/auditLog";

export async function listUsers(req: Request, res: Response) {
  const roleQuery = typeof req.query.role === "string" ? req.query.role : undefined;

  if (roleQuery && !Object.values(Role).includes(roleQuery as Role)) {
    return res.status(400).json({ error: "Geçersiz rol filtresi" });
  }

  const role = (roleQuery as Role) ?? Role.STAFF;
  const linksToStaffRecord = role === Role.STAFF || role === Role.TEAM_LEAD;

  const users = await prisma.user.findMany({
    where: { role, ...(linksToStaffRecord ? { staff: null } : {}) },
    select: { id: true, email: true, fullName: true },
    orderBy: { fullName: "asc" },
  });

  return res.json({ data: users });
}

const demoteSchema = z.object({
  reason: z.string().min(1, "Gerekçe zorunludur"),
  newRole: z.enum(["STAFF", "TEAM_LEAD"]),
  position: z.string().min(1).optional(),
  salaryBase: z.number().nonnegative().optional(),
  supervisorId: z.string().uuid().nullable().optional(),
});

/**
 * MANAGER → STAFF/TEAM_LEAD düşürme. Bu kullanıcının daha önce arşivlenmiş
 * (terfi sırasında) bir Staff kaydı varsa geri açılır (archivedAt=null) —
 * eski maaş/pozisyon/şef bilgisi korunur, yalnızca verilirse üzerine
 * yazılır. Hiç Staff kaydı yoksa (örn. doğrudan MANAGER olarak işe
 * başlamış biri) yenisi oluşturulur — bu durumda position/salaryBase
 * ZORUNLUDUR (yeni bir Staff kaydı bunlar olmadan var olamaz).
 */
export async function demoteFromManager(req: Request, res: Response) {
  const data = demoteSchema.parse(req.body);
  const target = await prisma.user.findUnique({ where: { id: idParam(req) } });
  if (!target) {
    return res.status(404).json({ error: "Kullanıcı bulunamadı" });
  }
  if (target.role !== Role.MANAGER) {
    return res.status(400).json({ error: "Bu kullanıcı Müdür değil" });
  }

  if (data.supervisorId) {
    if (!(await resolveSupervisorInfo(data.supervisorId))) {
      return res.status(400).json({ error: "Geçersiz şef/müdür seçimi" });
    }
    const existingArchivedForCycle = await prisma.staff.findUnique({ where: { userId: target.id } });
    if (existingArchivedForCycle && (await wouldCreateSupervisorCycle(existingArchivedForCycle.id, data.supervisorId))) {
      return res.status(400).json({ error: "Bu atama döngüsel bir hiyerarşi oluşturur" });
    }
  }

  const existingArchived = await prisma.staff.findUnique({ where: { userId: target.id } });

  if (existingArchived) {
    if (!existingArchived.archivedAt) {
      // Teorik olarak imkansız (MANAGER'ın arşivlenmemiş bir Staff kaydı
      // olamaz — ama savunmacı programlama: uydurma veri üretmek yerine hata.
      return res.status(409).json({ error: "Bu kullanıcının zaten aktif bir personel kaydı var" });
    }
    await prisma.staff.update({
      where: { id: existingArchived.id },
      data: {
        archivedAt: null,
        ...(data.position ? { position: data.position } : {}),
        ...(data.salaryBase !== undefined ? { salaryBase: data.salaryBase } : {}),
        ...(data.supervisorId !== undefined ? { supervisorId: data.supervisorId } : {}),
      },
    });
  } else {
    if (!data.position || data.salaryBase === undefined) {
      return res.status(400).json({ error: "Yeni bir personel kaydı için pozisyon ve taban maaş zorunludur" });
    }
    await prisma.staff.create({
      data: {
        userId: target.id,
        position: data.position,
        salaryBase: data.salaryBase,
        supervisorId: data.supervisorId ?? undefined,
      },
    });
  }

  await prisma.user.update({
    where: { id: target.id },
    data: { role: data.newRole, tokenVersion: { increment: 1 } },
  });

  await recordAuditLog({
    actorUserId: req.user!.sub,
    action: "user.demoted_from_manager",
    targetUserId: target.id,
    targetType: "User",
    targetId: target.id,
    detail: `Müdür -> ${data.newRole}: ${data.reason}`,
  });

  return res.json({ ok: true });
}

const terminateSchema = z.object({ reason: z.string().min(1, "Gerekçe zorunludur") });

/**
 * İşten çıkarma — hiçbir veri silinmez. User.isActive=false (login/requireAuth
 * reddeder), tokenVersion++ (mevcut tüm oturumlar anında geçersiz), ilişkili
 * Staff kaydı varsa arşivlenir. OWNER hedef OLAMAZ (kendisi dahil — actor
 * zaten bir OWNER, bu kontrol tek başına her iki durumu da kapsar).
 */
export async function terminateUser(req: Request, res: Response) {
  const { reason } = terminateSchema.parse(req.body);
  const target = await prisma.user.findUnique({ where: { id: idParam(req) }, include: { staff: true } });
  if (!target) {
    return res.status(404).json({ error: "Kullanıcı bulunamadı" });
  }
  if (target.role === Role.OWNER) {
    return res.status(403).json({ error: "Bir OWNER hesabı işten çıkarılamaz" });
  }
  if (!target.isActive) {
    return res.status(409).json({ error: "Bu kullanıcı zaten devre dışı" });
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: target.id },
      data: { isActive: false, tokenVersion: { increment: 1 } },
    }),
    ...(target.staff && !target.staff.archivedAt
      ? [prisma.staff.update({ where: { id: target.staff.id }, data: { archivedAt: new Date() } })]
      : []),
  ]);

  await recordAuditLog({
    actorUserId: req.user!.sub,
    action: "user.terminated",
    targetUserId: target.id,
    targetType: "User",
    targetId: target.id,
    detail: reason,
  });

  return res.json({ ok: true });
}

const reactivateSchema = z.object({ reason: z.string().min(1, "Gerekçe zorunludur") });

/** İşten çıkarılmış bir kullanıcıyı geri aktif eder — Staff kaydı varsa (terminate sırasında arşivlenmişti) geri açılır. */
export async function reactivateUser(req: Request, res: Response) {
  const { reason } = reactivateSchema.parse(req.body);
  const target = await prisma.user.findUnique({ where: { id: idParam(req) }, include: { staff: true } });
  if (!target) {
    return res.status(404).json({ error: "Kullanıcı bulunamadı" });
  }
  if (target.isActive) {
    return res.status(409).json({ error: "Bu kullanıcı zaten aktif" });
  }

  // MANAGER/OWNER için Staff kavramı yok — arşivlenmiş bir Staff kaydı
  // varsa bile (ör. önce terfi edip SONRA terminate edilmiş biri) rolü hâlâ
  // MANAGER'sa geri açılmaz; yalnızca STAFF/TEAM_LEAD'e döner (terminate
  // sırasında arşivlenmiş gerçek personel kaydı).
  const shouldUnarchiveStaff =
    target.staff?.archivedAt && (target.role === Role.STAFF || target.role === Role.TEAM_LEAD);

  await prisma.$transaction([
    prisma.user.update({ where: { id: target.id }, data: { isActive: true } }),
    ...(shouldUnarchiveStaff
      ? [prisma.staff.update({ where: { id: target.staff!.id }, data: { archivedAt: null } })]
      : []),
  ]);

  await recordAuditLog({
    actorUserId: req.user!.sub,
    action: "user.reactivated",
    targetUserId: target.id,
    targetType: "User",
    targetId: target.id,
    detail: reason,
  });

  return res.json({ ok: true });
}

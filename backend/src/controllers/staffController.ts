import type { Request, Response } from "express";
import { z } from "zod";
import { Role, type Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getPagination, paginatedResponse } from "../lib/pagination";
import { idParam } from "../lib/params";
import { getTeamStaffIds } from "../lib/access";
import { PERMISSION_KEYS, isPermissionKey } from "../lib/permissions";
import { recordAuditLog } from "../lib/auditLog";

const createSchema = z.object({
  userId: z.string().uuid(),
  position: z.string().min(1),
  salaryBase: z.number().nonnegative(),
  supervisorId: z.string().uuid().nullable().optional(),
});

const updateSchema = z.object({
  position: z.string().min(1).optional(),
  salaryBase: z.number().nonnegative().optional(),
  supervisorId: z.string().uuid().nullable().optional(),
});

const staffInclude = {
  user: { select: { id: true, fullName: true, email: true, phone: true, role: true } },
};

export async function listStaff(req: Request, res: Response) {
  const { skip, take, page, limit } = getPagination(req);
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const roleFilter = typeof req.query.role === "string" ? req.query.role : undefined;
  const user = req.user!;

  const conditions: Prisma.StaffWhereInput[] = [];

  if (search) {
    conditions.push({
      OR: [
        { position: { contains: search, mode: "insensitive" as const } },
        { user: { is: { fullName: { contains: search, mode: "insensitive" as const } } } },
      ],
    });
  }

  if (roleFilter && Object.values(Role).includes(roleFilter as Role)) {
    conditions.push({ user: { is: { role: roleFilter as Role } } });
  }

  if (user.role === Role.TEAM_LEAD) {
    const teamIds = await getTeamStaffIds(user.sub);
    conditions.push({ id: { in: teamIds } });
  }

  const where: Prisma.StaffWhereInput = conditions.length > 0 ? { AND: conditions } : {};

  const [data, total] = await Promise.all([
    prisma.staff.findMany({ where, skip, take, orderBy: { createdAt: "desc" }, include: staffInclude }),
    prisma.staff.count({ where }),
  ]);

  return res.json(paginatedResponse(data, total, page, limit));
}

export async function getStaff(req: Request, res: Response) {
  const staff = await prisma.staff.findUnique({ where: { id: idParam(req) }, include: staffInclude });
  if (!staff) {
    return res.status(404).json({ error: "Personel bulunamadı" });
  }

  if (req.user!.role === Role.TEAM_LEAD) {
    const teamIds = await getTeamStaffIds(req.user!.sub);
    if (!teamIds.includes(staff.id)) {
      return res.status(403).json({ error: "Bu personele erişim yetkiniz yok" });
    }
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const todaysJobs = await prisma.job.findMany({
    where: { assignedStaffId: staff.id, scheduledAt: { gte: startOfDay, lte: endOfDay } },
    orderBy: { scheduledAt: "asc" },
  });

  return res.json({ ...staff, todaysJobs });
}

export async function createStaff(req: Request, res: Response) {
  const data = createSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { id: data.userId } });
  if (!user) {
    return res.status(404).json({ error: "Kullanıcı bulunamadı" });
  }
  if (user.role !== Role.STAFF && user.role !== Role.TEAM_LEAD) {
    return res.status(400).json({ error: "Personel olarak bağlanabilmesi için kullanıcının rolü STAFF veya TEAM_LEAD olmalıdır" });
  }

  const existing = await prisma.staff.findUnique({ where: { userId: data.userId } });
  if (existing) {
    return res.status(409).json({ error: "Kullanıcı zaten bir personel kaydına bağlı" });
  }

  const staff = await prisma.staff.create({ data, include: staffInclude });
  return res.status(201).json(staff);
}

export async function updateStaff(req: Request, res: Response) {
  const data = updateSchema.parse(req.body);

  const existing = await prisma.staff.findUnique({ where: { id: idParam(req) } });
  if (!existing) {
    return res.status(404).json({ error: "Personel bulunamadı" });
  }

  const staff = await prisma.staff.update({ where: { id: idParam(req) }, data, include: staffInclude });

  await recordAuditLog({
    actorUserId: req.user!.sub,
    action: "staff.update",
    targetUserId: staff.userId,
    targetType: "Staff",
    targetId: staff.id,
    detail: JSON.stringify(data),
  });

  return res.json(staff);
}

export async function deleteStaff(req: Request, res: Response) {
  const existing = await prisma.staff.findUnique({ where: { id: idParam(req) } });
  if (!existing) {
    return res.status(404).json({ error: "Personel bulunamadı" });
  }

  await prisma.staff.delete({ where: { id: idParam(req) } });

  await recordAuditLog({
    actorUserId: req.user!.sub,
    action: "staff.delete",
    targetUserId: existing.userId,
    targetType: "Staff",
    targetId: existing.id,
  });

  return res.status(204).send();
}

const permissionsUpdateSchema = z.object(
  Object.fromEntries(PERMISSION_KEYS.map((key) => [key, z.boolean().optional()]))
);

export async function getStaffPermissions(req: Request, res: Response) {
  const staff = await prisma.staff.findUnique({ where: { id: idParam(req) } });
  if (!staff) {
    return res.status(404).json({ error: "Personel bulunamadı" });
  }

  const existing = await prisma.permission.findMany({ where: { staffId: staff.id } });
  const existingByKey = new Map(existing.map((p) => [p.key, p.value]));

  const permissions = PERMISSION_KEYS.map((key) => ({
    key,
    value: existingByKey.get(key) ?? false,
  }));

  return res.json({ data: permissions });
}

export async function updateStaffPermissions(req: Request, res: Response) {
  const staff = await prisma.staff.findUnique({ where: { id: idParam(req) } });
  if (!staff) {
    return res.status(404).json({ error: "Personel bulunamadı" });
  }

  const data = permissionsUpdateSchema.parse(req.body);

  const updates = Object.entries(data).filter(
    (entry): entry is [string, boolean] => isPermissionKey(entry[0]) && entry[1] !== undefined
  );

  await prisma.$transaction(
    updates.map(([key, value]) =>
      prisma.permission.upsert({
        where: { staffId_key: { staffId: staff.id, key } },
        create: { staffId: staff.id, key, value },
        update: { value },
      })
    )
  );

  const permissions = await prisma.permission.findMany({ where: { staffId: staff.id } });

  await recordAuditLog({
    actorUserId: req.user!.sub,
    action: "staff.permissions.update",
    targetUserId: staff.userId,
    targetType: "Staff",
    targetId: staff.id,
    detail: JSON.stringify(data),
  });

  return res.json({ data: permissions });
}

export async function getStaffLeaderboard(req: Request, res: Response) {
  const user = req.user!;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const where: Prisma.StaffWhereInput = {};
  if (user.role === Role.TEAM_LEAD) {
    const teamIds = await getTeamStaffIds(user.sub);
    where.id = { in: teamIds };
  }

  const staffList = await prisma.staff.findMany({
    where,
    include: {
      user: { select: { fullName: true } },
      jobs: {
        where: { status: "COMPLETED", completedAt: { gte: monthStart } },
        select: { rating: true },
      },
    },
  });

  const leaderboard = staffList.map((staff) => {
    const ratedJobs = staff.jobs.filter((j) => j.rating !== null);
    const averageRating =
      ratedJobs.length > 0
        ? ratedJobs.reduce((sum, j) => sum + (j.rating ?? 0), 0) / ratedJobs.length
        : null;

    return {
      staffId: staff.id,
      fullName: staff.user.fullName,
      position: staff.position,
      completedJobsThisMonth: staff.jobs.length,
      averageRating,
    };
  });

  leaderboard.sort((a, b) => b.completedJobsThisMonth - a.completedJobsThisMonth);

  return res.json({ data: leaderboard });
}

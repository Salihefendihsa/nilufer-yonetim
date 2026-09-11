import type { Request, Response } from "express";
import { z } from "zod";
import { Role, StaffStatus, type Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getPagination, paginatedResponse } from "../lib/pagination";
import { idParam } from "../lib/params";
import { getTeamStaffIds, getStaffIdForUser, resolveSupervisorInfo, resolveSupervisorInfoBatch, wouldCreateSupervisorCycle } from "../lib/access";
import { PERMISSION_KEYS, isPermissionKey } from "../lib/permissions";
import { recordAuditLog } from "../lib/auditLog";
import { resetExpiredStaffStatuses } from "../lib/cron";
import { getMonthlyJobTarget } from "../lib/targets";

const createSchema = z.object({
  userId: z.string().uuid(),
  position: z.string().min(1),
  salaryBase: z.number().nonnegative(),
  supervisorId: z.string().uuid().nullable().optional(),
  vehiclePlate: z.string().min(1).nullable().optional(),
  dailyJobCapacity: z.number().int().positive().nullable().optional(),
});

const updateSchema = z.object({
  position: z.string().min(1).optional(),
  salaryBase: z.number().nonnegative().optional(),
  supervisorId: z.string().uuid().nullable().optional(),
  vehiclePlate: z.string().nullable().optional(),
  dailyJobCapacity: z.number().int().positive().nullable().optional(),
});

const staffInclude = {
  user: { select: { id: true, fullName: true, email: true, phone: true, role: true } },
};

/**
 * Maaş yalnızca OWNER/MANAGER'a (personel yönetimi web sayfası da yalnızca bu
 * iki role açık) gösterilir. TEAM_LEAD, ekibindeki personeli GET /staff ile
 * görebiliyor (iş yeniden atama seçicisi için — bkz. StaffApi.list() kullanımı
 * mobile/lib/features/jobs/job_detail_screen.dart) ama bu, ekip üyelerinin
 * maaşını da yanıt gövdesinde sızdırıyordu; STAFF de yalnızca kendi kaydını
 * görüyor olsa da aynı kısıtlama STAFF için de tutarlılık amacıyla uygulanır.
 */
function redactSalaryForRole<T extends { salaryBase: unknown }>(staff: T, role: Role): Omit<T, "salaryBase"> | T {
  if (role === Role.OWNER || role === Role.MANAGER) {
    return staff;
  }
  const { salaryBase: _salaryBase, ...rest } = staff;
  return rest;
}

export async function listStaff(req: Request, res: Response) {
  // Cron her 5 dakikada bir çalışır; iki tetik arasında bayat "Molada/İzinli"
  // görünmesin diye her listelemede de süresi dolanları anında düzeltiyoruz.
  await resetExpiredStaffStatuses();

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
  } else if (user.role === Role.STAFF) {
    // STAFF'ın personel yönetimi yetkisi yok (bkz. docs/STITCH_FEATURE_MATRIX.md
    // Faz 9 → Yetki Çelişkileri); bu uç yalnızca kendi kaydını döndürür —
    // maaş/pozisyon gibi diğer personel bilgileri sızdırılmaz. Mobil
    // istemcide STAFF için bu ucu çağıran hiçbir ekran yok (Ekibim/Personel
    // sekmesi StaffShell'de bulunmuyor); bu, ileride gerekirse "kendi
    // profilim" amaçlı kullanılabilecek güvenli bir varsayılan.
    const ownStaffId = await getStaffIdForUser(user.sub);
    conditions.push({ id: ownStaffId ?? "" });
  }

  const where: Prisma.StaffWhereInput = conditions.length > 0 ? { AND: conditions } : {};

  const [data, total] = await Promise.all([
    prisma.staff.findMany({ where, skip, take, orderBy: { createdAt: "desc" }, include: staffInclude }),
    prisma.staff.count({ where }),
  ]);

  // Bugünkü iş yükü ve yaklaşan sertifika uyarısı tek sorguda hesaplanır —
  // web'in daha önce personel başına ayrı /jobs çağrısı yapan N+1 deseninin
  // yerini alır (Stitch Müdür → Personel: "Günlük İş Yükü 4/5 İş",
  // "Sertifika Uyarısı (2)" filtresi).
  const staffIds = data.map((s) => s.id);
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);
  const in30Days = new Date();
  in30Days.setDate(in30Days.getDate() + 30);

  const [todaysJobs, expiringCerts, ratings] = await Promise.all([
    staffIds.length
      ? prisma.job.groupBy({
          by: ["assignedStaffId"],
          _count: { _all: true },
          where: { assignedStaffId: { in: staffIds }, scheduledAt: { gte: startOfDay, lte: endOfDay } },
        })
      : Promise.resolve([]),
    staffIds.length
      ? prisma.staffCertification.groupBy({
          by: ["staffId"],
          _count: { _all: true },
          where: { staffId: { in: staffIds }, expiryDate: { lte: in30Days } },
        })
      : Promise.resolve([]),
    staffIds.length
      ? prisma.job.groupBy({
          by: ["assignedStaffId"],
          _avg: { rating: true },
          _count: { rating: true },
          where: { assignedStaffId: { in: staffIds }, rating: { not: null } },
        })
      : Promise.resolve([]),
  ]);

  const supervisorInfoById = await resolveSupervisorInfoBatch(data.map((s) => s.supervisorId));

  const enriched = data.map((staff) => {
    const rating = ratings.find((r) => r.assignedStaffId === staff.id);
    return {
      ...redactSalaryForRole(staff, user.role),
      todaysJobsCount: todaysJobs.find((j) => j.assignedStaffId === staff.id)?._count._all ?? 0,
      expiringCertificationCount: expiringCerts.find((c) => c.staffId === staff.id)?._count._all ?? 0,
      averageRating: rating?._avg.rating ?? null,
      ratedJobsCount: rating?._count.rating ?? 0,
      supervisor: staff.supervisorId ? (supervisorInfoById.get(staff.supervisorId) ?? null) : null,
    };
  });

  return res.json(paginatedResponse(enriched, total, page, limit));
}

export async function getStaff(req: Request, res: Response) {
  await resetExpiredStaffStatuses();
  const staff = await prisma.staff.findUnique({ where: { id: idParam(req) }, include: staffInclude });
  if (!staff) {
    return res.status(404).json({ error: "Personel bulunamadı" });
  }

  if (req.user!.role === Role.TEAM_LEAD) {
    const teamIds = await getTeamStaffIds(req.user!.sub);
    if (!teamIds.includes(staff.id)) {
      return res.status(403).json({ error: "Bu personele erişim yetkiniz yok" });
    }
  } else if (req.user!.role === Role.STAFF) {
    const ownStaffId = await getStaffIdForUser(req.user!.sub);
    if (ownStaffId !== staff.id) {
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

  const supervisor = await resolveSupervisorInfo(staff.supervisorId);

  return res.json({ ...redactSalaryForRole(staff, req.user!.role), todaysJobs, supervisor });
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

  if (data.supervisorId && !(await resolveSupervisorInfo(data.supervisorId))) {
    return res.status(400).json({ error: "Geçersiz şef/müdür seçimi" });
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

  if (data.supervisorId && !(await resolveSupervisorInfo(data.supervisorId))) {
    return res.status(400).json({ error: "Geçersiz şef/müdür seçimi" });
  }
  if (data.supervisorId && (await wouldCreateSupervisorCycle(existing.id, data.supervisorId))) {
    return res.status(400).json({ error: "Bu atama döngüsel bir hiyerarşi oluşturur" });
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

interface OrgChartNode {
  id: string;
  userId: string;
  fullName: string;
  role: Role;
  position: string | null;
  status: StaffStatus | null;
  assignedCustomers: { id: string; fullName: string }[];
  children: OrgChartNode[];
}

const ACTIVE_JOB_STATUSES = ["PENDING", "SCHEDULED", "IN_PROGRESS"] as const;

/**
 * Organizasyon şeması: OWNER(ler) en tepede, altında MANAGER'lar, onların
 * altında (varsa) TEAM_LEAD'ler, onların altında STAFF — ama zincir
 * `Staff.supervisorId`nin polimorfik doğası gereği (bkz. resolveSupervisorInfo)
 * kısayolları da destekler: bir STAFF/TEAM_LEAD doğrudan bir MANAGER'a veya
 * hatta OWNER'a bağlanabilir. `supervisorId` çözülemeyen (silinmiş/geçersiz)
 * kayıtlar ayrı bir "unassigned" listesinde döner — ağaçta uydurma bir yere
 * eklenmez.
 */
export async function getOrgChart(_req: Request, res: Response) {
  const [owners, managers, allStaff] = await Promise.all([
    prisma.user.findMany({ where: { role: Role.OWNER }, select: { id: true, fullName: true } }),
    prisma.user.findMany({ where: { role: Role.MANAGER }, select: { id: true, fullName: true } }),
    prisma.staff.findMany({
      include: { user: { select: { id: true, fullName: true, role: true } } },
    }),
  ]);

  const staffIds = allStaff.map((s) => s.id);
  const jobs =
    staffIds.length > 0
      ? await prisma.job.findMany({
          where: { assignedStaffId: { in: staffIds }, status: { in: [...ACTIVE_JOB_STATUSES] } },
          select: { assignedStaffId: true, customer: { select: { id: true, fullName: true } } },
        })
      : [];

  const customersByStaffId = new Map<string, Map<string, { id: string; fullName: string }>>();
  for (const job of jobs) {
    if (!job.assignedStaffId) continue;
    const bucket = customersByStaffId.get(job.assignedStaffId) ?? new Map();
    bucket.set(job.customer.id, job.customer);
    customersByStaffId.set(job.assignedStaffId, bucket);
  }

  // supervisorId -> doğrudan raporlayan Staff kayıtları (bkz. şemadaki yorum:
  // bu bir Staff.id VEYA bir User.id olabilir, iki durumu da tek bir map ile ele alıyoruz).
  const childrenBySupervisorId = new Map<string, typeof allStaff>();
  const unassigned: typeof allStaff = [];
  const knownIds = new Set([...owners.map((o) => o.id), ...managers.map((m) => m.id), ...staffIds]);

  for (const staff of allStaff) {
    if (!staff.supervisorId || !knownIds.has(staff.supervisorId)) {
      // Ya hiç şef atanmamış, ya da geçersiz/silinmiş bir id'ye işaret ediyor.
      unassigned.push(staff);
      continue;
    }
    const bucket = childrenBySupervisorId.get(staff.supervisorId) ?? [];
    bucket.push(staff);
    childrenBySupervisorId.set(staff.supervisorId, bucket);
  }

  function buildStaffNode(staff: (typeof allStaff)[number]): OrgChartNode {
    return {
      id: staff.id,
      userId: staff.user.id,
      fullName: staff.user.fullName,
      role: staff.user.role,
      position: staff.position,
      status: staff.status,
      assignedCustomers: [...(customersByStaffId.get(staff.id)?.values() ?? [])],
      children: (childrenBySupervisorId.get(staff.id) ?? []).map(buildStaffNode),
    };
  }

  function buildManagerNode(manager: { id: string; fullName: string }): OrgChartNode {
    return {
      id: manager.id,
      userId: manager.id,
      fullName: manager.fullName,
      role: Role.MANAGER,
      position: null,
      status: null,
      assignedCustomers: [],
      children: (childrenBySupervisorId.get(manager.id) ?? []).map(buildStaffNode),
    };
  }

  const tree = owners.map((owner) => ({
    id: owner.id,
    userId: owner.id,
    fullName: owner.fullName,
    role: Role.OWNER,
    position: null,
    status: null,
    assignedCustomers: [],
    children: [
      ...managers.map(buildManagerNode),
      // OWNER'a doğrudan bağlanan (aradaki MÜDÜR'ü atlayan) STAFF/TEAM_LEAD.
      ...(childrenBySupervisorId.get(owner.id) ?? []).map(buildStaffNode),
    ],
  }));

  return res.json({
    tree,
    unassigned: unassigned.map((staff) => ({
      id: staff.id,
      userId: staff.user.id,
      fullName: staff.user.fullName,
      role: staff.user.role,
      position: staff.position,
      status: staff.status,
      assignedCustomers: [...(customersByStaffId.get(staff.id)?.values() ?? [])],
    })),
  });
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

const statusUpdateSchema = z.object({
  status: z.enum(StaffStatus),
  statusUntil: z.coerce.date().nullable().optional(),
});

/**
 * Personelin KENDİ KENDİNE seçebileceği durumlar — bunlar bir onay
 * gerektirmeyen, anlık/kendi bildirdiği durumlardır (mola başlat/bitir,
 * çevrimdışı işaretle, müsait olduğunu bildir).
 *
 * ON_LEAVE (izin) kasıtlı olarak burada YOK: izin, personelin tek taraflı
 * işaretleyebileceği bir şey değil, bir onay süreci gerektirir. Bu sistemde
 * henüz ayrı bir izin talebi/onayı modeli (LeaveRequest) yok — yalnızca
 * parasal AdvanceRequest var (bkz. docs/STITCH_FEATURE_MATRIX.md Açık
 * Sorular). Bu yüzden ON_LEAVE'i yalnızca yönetim (OWNER/MANAGER/TEAM_LEAD)
 * işaretleyebilir; gerçek bir dijital izin talebi/onay akışı ayrı bir
 * özellik olarak tasarlanmalı, burada UYDURULMADI.
 *
 * ON_JOB de kendi kendine seçilemez: bu durum, personelin IN_PROGRESS
 * durumundaki bir işi olup olmadığından türetilmesi gereken bir sistem
 * durumudur, kişisel bir tercih değildir (bkz. Açık Sorular).
 */
const SELF_SERVICE_STAFF_STATUSES: StaffStatus[] = [StaffStatus.AVAILABLE, StaffStatus.ON_BREAK, StaffStatus.OFFLINE];

/** STAFF may only update their own status (and only to a self-service value); OWNER/MANAGER/TEAM_LEAD (within their team) may set anyone's, including ON_LEAVE/ON_JOB. */
export async function updateStaffStatus(req: Request, res: Response) {
  const user = req.user!;
  const staff = await prisma.staff.findUnique({ where: { id: idParam(req) } });
  if (!staff) {
    return res.status(404).json({ error: "Personel bulunamadı" });
  }

  const data = statusUpdateSchema.parse(req.body);

  if (data.statusUntil && data.statusUntil.getTime() <= Date.now()) {
    return res.status(400).json({ error: "Durum bitiş tarihi geçmiş bir tarih olamaz" });
  }

  if (user.role === Role.STAFF) {
    const ownStaffId = await getStaffIdForUser(user.sub);
    if (ownStaffId !== staff.id) {
      return res.status(403).json({ error: "Bu işlem için yetkiniz yok" });
    }
    if (!SELF_SERVICE_STAFF_STATUSES.includes(data.status)) {
      return res.status(403).json({
        error: "Bu durumu yalnızca yöneticiniz ayarlayabilir (izin, onay gerektirir)",
      });
    }
  } else if (user.role === Role.TEAM_LEAD) {
    const teamIds = await getTeamStaffIds(user.sub);
    if (!teamIds.includes(staff.id)) {
      return res.status(403).json({ error: "Bu işlem için yetkiniz yok" });
    }
  } else if (user.role !== Role.OWNER && user.role !== Role.MANAGER) {
    return res.status(403).json({ error: "Bu işlem için yetkiniz yok" });
  }

  const previousStatus = staff.status;
  const updated = await prisma.staff.update({
    where: { id: staff.id },
    data: { status: data.status, statusUntil: data.statusUntil ?? null },
  });

  // İzin/mola gibi durum değişiklikleri denetim izinde görünür olmalı —
  // özellikle yönetimin bir personeli izinli işaretlemesi (bkz. madde 4).
  if (previousStatus !== updated.status) {
    await recordAuditLog({
      actorUserId: user.sub,
      action: "staff.status.update",
      targetUserId: staff.userId,
      targetType: "Staff",
      targetId: staff.id,
      detail: `${previousStatus} -> ${updated.status}`,
    });
  }

  return res.json(updated);
}

/**
 * Bir işin "zamanında" sayılma kuralı — Stitch Şef → Ekip Performansı
 * tablosundaki "Zamanında %98" sütunu.
 *
 * - Randevu bitişi (`scheduledEndAt`) tanımlıysa: `completedAt <= scheduledEndAt`.
 * - Değilse: `completedAt`, `scheduledAt` ile AYNI TAKVİM GÜNÜNDE ise zamanında
 *   sayılır (yalnızca başlangıç saatini son tarih kabul etmek, saat 09:00'a
 *   planlanmış bir işi 09:05'te bitirince "geciken" gösterirdi).
 * - Hiç `scheduledAt` yoksa iş bu ölçüme HİÇ dahil edilmez (paydada da yoktur) —
 *   planı olmayan iş için gecikme tanımlanamaz.
 *
 * Bu tanım Stitch'te belirtilmediği için burada açıkça belgelenmiştir
 * (bkz. docs/STITCH_FEATURE_MATRIX.md Faz 8).
 */
function isOnTime(job: {
  completedAt: Date | null;
  scheduledAt: Date | null;
  scheduledEndAt: Date | null;
}): boolean | null {
  if (!job.completedAt || !job.scheduledAt) return null;
  if (job.scheduledEndAt) return job.completedAt <= job.scheduledEndAt;
  return job.completedAt.toDateString() === job.scheduledAt.toDateString();
}

type LeaderboardPeriod = "this_month" | "last_month" | "this_year";

/** İstenen dönemin ve onunla karşılaştırılacak bir önceki dönemin sınırları. */
function periodBounds(period: LeaderboardPeriod, now: Date) {
  if (period === "last_month") {
    return {
      start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      end: new Date(now.getFullYear(), now.getMonth(), 1),
      previousStart: new Date(now.getFullYear(), now.getMonth() - 2, 1),
      previousEnd: new Date(now.getFullYear(), now.getMonth() - 1, 1),
    };
  }
  if (period === "this_year") {
    return {
      start: new Date(now.getFullYear(), 0, 1),
      end: new Date(now.getFullYear() + 1, 0, 1),
      previousStart: new Date(now.getFullYear() - 1, 0, 1),
      previousEnd: new Date(now.getFullYear(), 0, 1),
    };
  }
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 1),
    previousStart: new Date(now.getFullYear(), now.getMonth() - 1, 1),
    previousEnd: new Date(now.getFullYear(), now.getMonth(), 1),
  };
}

export async function getStaffLeaderboard(req: Request, res: Response) {
  const user = req.user!;

  const periodParam = typeof req.query.period === "string" ? req.query.period : "this_month";
  const period: LeaderboardPeriod = ["this_month", "last_month", "this_year"].includes(periodParam)
    ? (periodParam as LeaderboardPeriod)
    : "this_month";

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const bounds = periodBounds(period, now);

  const where: Prisma.StaffWhereInput = {};
  if (user.role === Role.TEAM_LEAD) {
    // Tek seviyeli ekip kapsamı: yalnızca doğrudan raporlayanlar + şefin kendisi.
    const teamIds = await getTeamStaffIds(user.sub);
    where.id = { in: teamIds };
  }

  // Hem dönem hem de (geriye dönük uyumluluk için) bu ay/geçen ay alanlarını
  // hesaplayabilmek için en erken sınırdan itibaren çekilir.
  const earliest = new Date(Math.min(bounds.previousStart.getTime(), lastMonthStart.getTime()));

  const [staffList, monthlyTarget] = await Promise.all([
    prisma.staff.findMany({
      where,
      include: {
        user: { select: { fullName: true } },
        jobs: {
          where: { status: "COMPLETED", completedAt: { gte: earliest } },
          select: { rating: true, completedAt: true, scheduledAt: true, scheduledEndAt: true },
        },
      },
    }),
    getMonthlyJobTarget(),
  ]);

  const inRange = (d: Date | null, start: Date, end: Date) => d !== null && d >= start && d < end;

  const leaderboard = staffList.map((staff) => {
    const thisMonthJobs = staff.jobs.filter((j) => j.completedAt && j.completedAt >= monthStart);
    const lastMonthJobs = staff.jobs.filter((j) =>
      inRange(j.completedAt, lastMonthStart, monthStart)
    );
    const periodJobs = staff.jobs.filter((j) => inRange(j.completedAt, bounds.start, bounds.end));
    const previousPeriodJobs = staff.jobs.filter((j) =>
      inRange(j.completedAt, bounds.previousStart, bounds.previousEnd)
    );

    const ratedPeriodJobs = periodJobs.filter((j) => j.rating !== null);
    const averageRating =
      ratedPeriodJobs.length > 0
        ? ratedPeriodJobs.reduce((sum, j) => sum + (j.rating ?? 0), 0) / ratedPeriodJobs.length
        : null;

    const timed = periodJobs.map(isOnTime).filter((v): v is boolean => v !== null);
    const onTimeCount = timed.filter(Boolean).length;

    return {
      staffId: staff.id,
      fullName: staff.user.fullName,
      position: staff.position,
      // Geriye dönük uyumluluk (Müdür/Patron ekranları bu adları kullanıyor):
      completedJobsThisMonth: thisMonthJobs.length,
      completedJobsLastMonth: lastMonthJobs.length,
      // Dönem bazlı alanlar (Şef → Ekip Performansı: Bu Ay / Geçen Ay / Bu Yıl):
      completedJobsInPeriod: periodJobs.length,
      completedJobsPreviousPeriod: previousPeriodJobs.length,
      averageRating,
      /// Stitch "174 geri bildirim" / "(42 değerlendirme)" göstergesi.
      ratedJobsCount: ratedPeriodJobs.length,
      /// Planı olan tamamlanmış iş yoksa null — oran uydurulmaz.
      onTimeRate: timed.length > 0 ? (onTimeCount / timed.length) * 100 : null,
      onTimeMeasuredJobs: timed.length,
      /// Hedef tanımlıysa doluluk yüzdesi, değilse null (hedef uydurulmaz).
      targetCompletionPercent: monthlyTarget ? (thisMonthJobs.length / monthlyTarget) * 100 : null,
    };
  });

  leaderboard.sort((a, b) => b.completedJobsInPeriod - a.completedJobsInPeriod);

  const totalCompletedThisMonth = leaderboard.reduce((sum, s) => sum + s.completedJobsThisMonth, 0);
  const totalCompletedLastMonth = leaderboard.reduce((sum, s) => sum + s.completedJobsLastMonth, 0);
  const totalInPeriod = leaderboard.reduce((sum, s) => sum + s.completedJobsInPeriod, 0);
  const totalPreviousPeriod = leaderboard.reduce(
    (sum, s) => sum + s.completedJobsPreviousPeriod,
    0
  );
  const totalRated = leaderboard.reduce((sum, s) => sum + s.ratedJobsCount, 0);
  const weightedRating = leaderboard.reduce(
    (sum, s) => sum + (s.averageRating ?? 0) * s.ratedJobsCount,
    0
  );
  const totalOnTimeMeasured = leaderboard.reduce((sum, s) => sum + s.onTimeMeasuredJobs, 0);
  const weightedOnTime = leaderboard.reduce(
    (sum, s) => sum + (s.onTimeRate ?? 0) * s.onTimeMeasuredJobs,
    0
  );

  return res.json({
    data: leaderboard,
    period,
    /**
     * Hedef `Setting` tablosundaki `monthly_job_target` anahtarından gelir ve
     * YALNIZCA OWNER tarafından düzenlenebilir; MANAGER /settings ucuna
     * erişemediği için hedef burada gömülü olarak sunulur (bkz. lib/targets.ts).
     */
    monthlyTarget,
    summary: {
      totalCompletedThisMonth,
      totalCompletedLastMonth,
      totalCompletedInPeriod: totalInPeriod,
      totalCompletedPreviousPeriod: totalPreviousPeriod,
      staffCount: leaderboard.length,
      averageRating: totalRated > 0 ? weightedRating / totalRated : null,
      ratedJobsCount: totalRated,
      onTimeRate: totalOnTimeMeasured > 0 ? weightedOnTime / totalOnTimeMeasured : null,
      jobsPerStaff: leaderboard.length > 0 ? totalCompletedThisMonth / leaderboard.length : 0,
    },
  });
}

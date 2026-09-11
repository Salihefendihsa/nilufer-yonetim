import { Role } from "@prisma/client";
import { prisma } from "./prisma";
import type { PermissionKey } from "./permissions";

const MANAGEMENT_ROLES: Role[] = [Role.OWNER, Role.MANAGER];

export async function canAccessJob(
  user: { sub: string; role: Role },
  job: { customerId: string; assignedStaffId: string | null }
): Promise<boolean> {
  if (MANAGEMENT_ROLES.includes(user.role)) return true;
  if (user.role === Role.TEAM_LEAD) {
    const teamIds = await getTeamStaffIds(user.sub);
    return job.assignedStaffId !== null && teamIds.includes(job.assignedStaffId);
  }
  if (user.role === Role.STAFF) {
    const staffId = await getStaffIdForUser(user.sub);
    return staffId !== null && staffId === job.assignedStaffId;
  }
  const customerId = await getCustomerIdForUser(user.sub);
  return customerId !== null && customerId === job.customerId;
}

export async function getCustomerIdForUser(userId: string): Promise<string | null> {
  const customer = await prisma.customer.findUnique({ where: { userId } });
  return customer?.id ?? null;
}

export async function getStaffIdForUser(userId: string): Promise<string | null> {
  const staff = await prisma.staff.findUnique({ where: { userId } });
  return staff?.id ?? null;
}

export async function getStaffRecordForUser(userId: string) {
  return prisma.staff.findUnique({ where: { userId } });
}

/** Returns the staff IDs of everyone reporting to this team lead's own staff record, including the lead. */
export async function getTeamStaffIds(userId: string): Promise<string[]> {
  const leadStaff = await getStaffRecordForUser(userId);
  if (!leadStaff) return [];

  const teamMembers = await prisma.staff.findMany({
    where: { supervisorId: leadStaff.id, archivedAt: null },
    select: { id: true },
  });

  return [leadStaff.id, ...teamMembers.map((m) => m.id)];
}

export interface SupervisorInfo {
  userId: string;
  fullName: string;
  role: Role;
}

/**
 * Organizasyon zinciri STAFF → TEAM_LEAD → MANAGER → OWNER şeklinde ama
 * yalnızca STAFF/TEAM_LEAD'in gerçek bir Staff kaydı var — MANAGER/OWNER'ın
 * yok. Bu yüzden `Staff.supervisorId` polimorfik: önce bir Staff.id olarak
 * denenir (TEAM_LEAD'e bağlıysa), bulunamazsa bir User.id olarak denenir
 * (MANAGER'a doğrudan bağlıysa — bkz. schema.prisma Staff.supervisorId
 * yorumu). Geçersiz/silinmiş bir id ise null döner (uydurma veri yok).
 */
export async function resolveSupervisorInfo(
  supervisorId: string | null | undefined
): Promise<SupervisorInfo | null> {
  if (!supervisorId) return null;

  const asStaff = await prisma.staff.findUnique({
    where: { id: supervisorId },
    select: { user: { select: { id: true, fullName: true, role: true } } },
  });
  if (asStaff) {
    return { userId: asStaff.user.id, fullName: asStaff.user.fullName, role: asStaff.user.role };
  }

  const asUser = await prisma.user.findUnique({
    where: { id: supervisorId },
    select: { id: true, fullName: true, role: true },
  });
  if (asUser && (asUser.role === Role.MANAGER || asUser.role === Role.OWNER)) {
    return { userId: asUser.id, fullName: asUser.fullName, role: asUser.role };
  }

  return null;
}

/**
 * `resolveSupervisorInfo`'nun çoklu id için toplu (N+1 sorgu yapmayan)
 * karşılığı — personel listesi gibi çok satırlı yanıtlarda kullanılır.
 */
export async function resolveSupervisorInfoBatch(
  supervisorIds: (string | null | undefined)[]
): Promise<Map<string, SupervisorInfo>> {
  const ids = [...new Set(supervisorIds.filter((id): id is string => !!id))];
  const result = new Map<string, SupervisorInfo>();
  if (ids.length === 0) return result;

  const staffMatches = await prisma.staff.findMany({
    where: { id: { in: ids } },
    select: { id: true, user: { select: { id: true, fullName: true, role: true } } },
  });
  for (const s of staffMatches) {
    result.set(s.id, { userId: s.user.id, fullName: s.user.fullName, role: s.user.role });
  }

  const remainingIds = ids.filter((id) => !result.has(id));
  if (remainingIds.length > 0) {
    const userMatches = await prisma.user.findMany({
      where: { id: { in: remainingIds }, role: { in: [Role.MANAGER, Role.OWNER] } },
      select: { id: true, fullName: true, role: true },
    });
    for (const u of userMatches) {
      result.set(u.id, { userId: u.id, fullName: u.fullName, role: u.role });
    }
  }

  return result;
}

export async function hasPermission(userId: string, key: PermissionKey): Promise<boolean> {
  const staff = await getStaffRecordForUser(userId);
  if (!staff) return false;

  const permission = await prisma.permission.findUnique({
    where: { staffId_key: { staffId: staff.id, key } },
  });

  return permission?.value ?? false;
}

/**
 * Bir Staff'ın supervisorId'sini `candidateSupervisorId`'ye çekmek döngüsel
 * bir hiyerarşi yaratır mı? (Örn. A, B'nin şefiyken B'yi A'ya şef yapmak.)
 * Yalnızca Staff→Staff (TEAM_LEAD) bağlantılarında döngü mümkün — bir
 * MANAGER/OWNER'a (User.id) ulaşan zincir orada sonlanır, MANAGER/OWNER'ın
 * kendi Staff kaydı yok. Kendi kendine şef olmak da bir döngü sayılır.
 */
export async function wouldCreateSupervisorCycle(
  staffId: string,
  candidateSupervisorId: string
): Promise<boolean> {
  let currentId: string | null = candidateSupervisorId;
  const visited = new Set<string>();

  while (currentId) {
    if (currentId === staffId) return true;
    if (visited.has(currentId)) return false; // farklı bir döngüye girdik, staffId'yi etkilemiyor
    visited.add(currentId);

    const current: { supervisorId: string | null } | null = await prisma.staff.findUnique({
      where: { id: currentId },
      select: { supervisorId: true },
    });
    if (!current) return false; // bir User.id'ye (MANAGER/OWNER) ulaşıldı — zincir sonlandı
    currentId = current.supervisorId;
  }

  return false;
}

/** Finds the staff member currently assigned to a customer's most recent job, if any. */
export async function getCustomerAssignedStaffUserId(customerId: string): Promise<string | null> {
  const job = await prisma.job.findFirst({
    where: { customerId, assignedStaffId: { not: null } },
    orderBy: { createdAt: "desc" },
    include: { assignedStaff: { select: { userId: true } } },
  });

  return job?.assignedStaff?.userId ?? null;
}

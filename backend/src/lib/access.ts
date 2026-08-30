import { prisma } from "./prisma";
import type { PermissionKey } from "./permissions";

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
    where: { supervisorId: leadStaff.id },
    select: { id: true },
  });

  return [leadStaff.id, ...teamMembers.map((m) => m.id)];
}

export async function hasPermission(userId: string, key: PermissionKey): Promise<boolean> {
  const staff = await getStaffRecordForUser(userId);
  if (!staff) return false;

  const permission = await prisma.permission.findUnique({
    where: { staffId_key: { staffId: staff.id, key } },
  });

  return permission?.value ?? false;
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

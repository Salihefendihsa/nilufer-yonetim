import { Role } from "@prisma/client";
import { getCustomerIdForUser, getStaffIdForUser, getTeamStaffIds, getCustomerAssignedStaffUserId } from "./access";

interface RoleUser {
  id: string;
  role: Role;
}

function pairKey(a: Role, b: Role): string {
  return [a, b].sort().join("-");
}

const ALWAYS_ALLOWED_PAIRS = new Set([
  pairKey(Role.OWNER, Role.MANAGER),
  pairKey(Role.OWNER, Role.TEAM_LEAD),
  pairKey(Role.OWNER, Role.STAFF),
  pairKey(Role.MANAGER, Role.TEAM_LEAD),
  pairKey(Role.MANAGER, Role.STAFF),
]);

export async function canUsersMessage(a: RoleUser, b: RoleUser): Promise<boolean> {
  if (a.id === b.id) return false;

  const key = pairKey(a.role, b.role);

  if (ALWAYS_ALLOWED_PAIRS.has(key)) {
    return true;
  }

  if (key === pairKey(Role.TEAM_LEAD, Role.STAFF)) {
    const lead = a.role === Role.TEAM_LEAD ? a : b;
    const staffUser = a.role === Role.STAFF ? a : b;
    const teamIds = await getTeamStaffIds(lead.id);
    const staffId = await getStaffIdForUser(staffUser.id);
    return staffId !== null && teamIds.includes(staffId);
  }

  if (key === pairKey(Role.CUSTOMER, Role.STAFF)) {
    const customerUser = a.role === Role.CUSTOMER ? a : b;
    const staffUser = a.role === Role.STAFF ? a : b;
    const customerId = await getCustomerIdForUser(customerUser.id);
    if (!customerId) return false;
    const assignedStaffUserId = await getCustomerAssignedStaffUserId(customerId);
    return assignedStaffUserId === staffUser.id;
  }

  return false;
}

/** Canonical ordering so A-B and B-A always resolve to the same conversation row. */
export function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

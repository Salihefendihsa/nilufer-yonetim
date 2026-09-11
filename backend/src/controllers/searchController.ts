import type { Request, Response } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getCustomerIdForUser, getStaffIdForUser, getTeamStaffIds } from "../lib/access";

const MAX_RESULTS = 5;

interface SearchResult {
  id: string;
  label: string;
  sublabel: string;
}

export async function search(req: Request, res: Response) {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const user = req.user!;

  if (!q) {
    return res.json({ customers: [], staff: [], jobs: [] });
  }

  const [customers, staff, jobs] = await Promise.all([
    searchCustomers(q, user),
    searchStaff(q, user),
    searchJobs(q, user),
  ]);

  return res.json({ customers, staff, jobs });
}

async function searchCustomers(q: string, user: { role: Role; sub: string }): Promise<SearchResult[]> {
  if (user.role === Role.STAFF || user.role === Role.CUSTOMER) {
    if (user.role === Role.CUSTOMER) {
      const customerId = await getCustomerIdForUser(user.sub);
      if (!customerId) return [];
      const customer = await prisma.customer.findUnique({ where: { id: customerId } });
      if (!customer) return [];
      const matches = customer.fullName.toLowerCase().includes(q.toLowerCase()) || customer.phone.includes(q);
      return matches ? [{ id: customer.id, label: customer.fullName, sublabel: customer.phone }] : [];
    }
    return [];
  }

  const customers = await prisma.customer.findMany({
    where: {
      OR: [
        { fullName: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
      ],
    },
    take: MAX_RESULTS,
  });

  return customers.map((c) => ({ id: c.id, label: c.fullName, sublabel: c.phone }));
}

async function searchStaff(q: string, user: { role: Role; sub: string }): Promise<SearchResult[]> {
  if (user.role === Role.CUSTOMER || user.role === Role.STAFF) {
    return [];
  }

  const where =
    user.role === Role.TEAM_LEAD
      ? {
          id: { in: await getTeamStaffIds(user.sub) },
          user: { fullName: { contains: q, mode: "insensitive" as const } },
        }
      : { archivedAt: null, user: { fullName: { contains: q, mode: "insensitive" as const } } };

  const staff = await prisma.staff.findMany({
    where,
    include: { user: true },
    take: MAX_RESULTS,
  });

  return staff.map((s) => ({ id: s.id, label: s.user.fullName, sublabel: s.position }));
}

async function searchJobs(q: string, user: { role: Role; sub: string }): Promise<SearchResult[]> {
  const where: Record<string, unknown> = {
    OR: [
      { serviceType: { contains: q, mode: "insensitive" } },
      { customer: { fullName: { contains: q, mode: "insensitive" } } },
    ],
  };

  if (user.role === Role.CUSTOMER) {
    const customerId = await getCustomerIdForUser(user.sub);
    if (!customerId) return [];
    where.customerId = customerId;
  } else if (user.role === Role.STAFF) {
    const staffId = await getStaffIdForUser(user.sub);
    if (!staffId) return [];
    where.assignedStaffId = staffId;
  } else if (user.role === Role.TEAM_LEAD) {
    where.assignedStaffId = { in: await getTeamStaffIds(user.sub) };
  }

  const jobs = await prisma.job.findMany({
    where,
    include: { customer: true },
    take: MAX_RESULTS,
    orderBy: { createdAt: "desc" },
  });

  return jobs.map((j) => ({ id: j.id, label: j.serviceType, sublabel: j.customer.fullName }));
}

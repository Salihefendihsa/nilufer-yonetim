import type { Request, Response } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";

export async function listUsers(req: Request, res: Response) {
  const roleQuery = typeof req.query.role === "string" ? req.query.role : undefined;

  if (roleQuery && !Object.values(Role).includes(roleQuery as Role)) {
    return res.status(400).json({ error: "Invalid role filter" });
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

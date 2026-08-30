import type { Request, Response } from "express";
import { z } from "zod";
import { AdvanceStatus, Role, type Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getPagination, paginatedResponse } from "../lib/pagination";
import { getStaffIdForUser } from "../lib/access";
import { idParam } from "../lib/params";
import { recordAuditLog } from "../lib/auditLog";
import { notifyManagement } from "../lib/notify";

const createSchema = z.object({
  amount: z.number().positive(),
  reason: z.string().min(1),
});

const updateSchema = z.object({
  status: z.enum(AdvanceStatus),
});

export async function createAdvanceRequest(req: Request, res: Response) {
  const user = req.user!;
  const staffId = await getStaffIdForUser(user.sub);
  if (!staffId) {
    return res.status(400).json({ error: "No staff record linked to this account" });
  }

  const data = createSchema.parse(req.body);
  const advance = await prisma.advanceRequest.create({ data: { ...data, staffId } });

  await notifyManagement("Yeni avans talebi", `${data.amount}₺ - ${data.reason}`);

  return res.status(201).json(advance);
}

export async function listAdvanceRequests(req: Request, res: Response) {
  const { skip, take, page, limit } = getPagination(req);
  const user = req.user!;

  const where: Prisma.AdvanceRequestWhereInput = {};

  if (user.role === Role.STAFF) {
    const staffId = await getStaffIdForUser(user.sub);
    if (!staffId) {
      return res.json(paginatedResponse([], 0, page, limit));
    }
    where.staffId = staffId;
  } else if (typeof req.query.status === "string") {
    where.status = req.query.status as AdvanceStatus;
  }

  const [data, total] = await Promise.all([
    prisma.advanceRequest.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: { staff: { include: { user: { select: { fullName: true } } } } },
    }),
    prisma.advanceRequest.count({ where }),
  ]);

  return res.json(paginatedResponse(data, total, page, limit));
}

export async function updateAdvanceRequest(req: Request, res: Response) {
  const existing = await prisma.advanceRequest.findUnique({
    where: { id: idParam(req) },
    include: { staff: { select: { userId: true } } },
  });
  if (!existing) {
    return res.status(404).json({ error: "Advance request not found" });
  }

  const data = updateSchema.parse(req.body);
  const advance = await prisma.advanceRequest.update({ where: { id: idParam(req) }, data });

  const actionByStatus: Record<AdvanceStatus, string> = {
    APPROVED: "advance.approve",
    REJECTED: "advance.reject",
    PENDING: "advance.status_update",
  };

  await recordAuditLog({
    actorUserId: req.user!.sub,
    action: actionByStatus[data.status],
    targetUserId: existing.staff.userId,
    targetType: "AdvanceRequest",
    targetId: advance.id,
    detail: `status -> ${advance.status}`,
  });

  return res.json(advance);
}

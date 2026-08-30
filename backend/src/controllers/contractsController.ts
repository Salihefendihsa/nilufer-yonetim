import type { Request, Response } from "express";
import { z } from "zod";
import { Role, type Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getPagination, paginatedResponse } from "../lib/pagination";
import { getCustomerIdForUser } from "../lib/access";
import { idParam } from "../lib/params";

const createSchema = z.object({
  customerId: z.string().uuid(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  durationMonths: z.number().int().positive(),
  status: z.string().min(1),
  pdfUrl: z.string().optional(),
});

const updateSchema = createSchema.partial();

export async function listContracts(req: Request, res: Response) {
  const { skip, take, page, limit } = getPagination(req);
  const user = req.user!;

  const where: Prisma.ContractWhereInput = {};

  if (user.role === Role.CUSTOMER) {
    const customerId = await getCustomerIdForUser(user.sub);
    if (!customerId) {
      return res.json(paginatedResponse([], 0, page, limit));
    }
    where.customerId = customerId;
  } else if (typeof req.query.customerId === "string") {
    where.customerId = req.query.customerId;
  }

  if (typeof req.query.status === "string") {
    where.status = req.query.status;
  }

  const [data, total] = await Promise.all([
    prisma.contract.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
    prisma.contract.count({ where }),
  ]);

  return res.json(paginatedResponse(data, total, page, limit));
}

export async function getExpiringContracts(_req: Request, res: Response) {
  const now = new Date();
  const in30Days = new Date();
  in30Days.setDate(now.getDate() + 30);

  const contracts = await prisma.contract.findMany({
    where: { endDate: { gte: now, lte: in30Days } },
    orderBy: { endDate: "asc" },
    include: { customer: true },
  });

  return res.json({ data: contracts });
}

export async function getContract(req: Request, res: Response) {
  const contract = await prisma.contract.findUnique({ where: { id: idParam(req) } });
  if (!contract) {
    return res.status(404).json({ error: "Contract not found" });
  }

  const user = req.user!;
  if (user.role === Role.CUSTOMER) {
    const customerId = await getCustomerIdForUser(user.sub);
    if (customerId !== contract.customerId) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
  }

  return res.json(contract);
}

export async function createContract(req: Request, res: Response) {
  const data = createSchema.parse(req.body);
  const contract = await prisma.contract.create({ data });
  return res.status(201).json(contract);
}

export async function updateContract(req: Request, res: Response) {
  const data = updateSchema.parse(req.body);

  const existing = await prisma.contract.findUnique({ where: { id: idParam(req) } });
  if (!existing) {
    return res.status(404).json({ error: "Contract not found" });
  }

  const contract = await prisma.contract.update({ where: { id: idParam(req) }, data });
  return res.json(contract);
}

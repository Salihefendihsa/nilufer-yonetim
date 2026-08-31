import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { idParam } from "../lib/params";
import { getPagination, paginatedResponse } from "../lib/pagination";
import { recordAuditLog } from "../lib/auditLog";

const createSchema = z.object({
  fullName: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().optional(),
  address: z.string().optional(),
  district: z.string().optional(),
  userId: z.string().uuid().optional(),
});

const updateSchema = createSchema.partial();

export async function listCustomers(req: Request, res: Response) {
  const { skip, take, page, limit } = getPagination(req);
  const search = typeof req.query.search === "string" ? req.query.search : undefined;

  const where = search
    ? {
        OR: [
          { fullName: { contains: search, mode: "insensitive" as const } },
          { phone: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
          { district: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [data, total] = await Promise.all([
    prisma.customer.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
    prisma.customer.count({ where }),
  ]);

  return res.json(paginatedResponse(data, total, page, limit));
}

export async function getCustomer(req: Request, res: Response) {
  const customer = await prisma.customer.findUnique({
    where: { id: idParam(req) },
    include: {
      jobs: { orderBy: { createdAt: "desc" } },
      payments: { orderBy: { createdAt: "desc" } },
      contracts: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!customer) {
    return res.status(404).json({ error: "Müşteri bulunamadı" });
  }

  const totalPriced = customer.jobs.reduce((sum, job) => sum + Number(job.price ?? 0), 0);
  const totalPaid = customer.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const outstandingBalance = totalPriced - totalPaid;

  return res.json({ ...customer, outstandingBalance });
}

export async function createCustomer(req: Request, res: Response) {
  const data = createSchema.parse(req.body);
  const customer = await prisma.customer.create({ data });
  return res.status(201).json(customer);
}

export async function updateCustomer(req: Request, res: Response) {
  const data = updateSchema.parse(req.body);

  const existing = await prisma.customer.findUnique({ where: { id: idParam(req) } });
  if (!existing) {
    return res.status(404).json({ error: "Müşteri bulunamadı" });
  }

  const customer = await prisma.customer.update({ where: { id: idParam(req) }, data });
  return res.json(customer);
}

export async function deleteCustomer(req: Request, res: Response) {
  const existing = await prisma.customer.findUnique({ where: { id: idParam(req) } });
  if (!existing) {
    return res.status(404).json({ error: "Müşteri bulunamadı" });
  }

  await prisma.customer.delete({ where: { id: idParam(req) } });

  // Only logged when the customer has a linked account — an audit entry always needs an
  // unambiguous target user, and a walk-in customer without a User record has none.
  await recordAuditLog({
    actorUserId: req.user!.sub,
    action: "customer.delete",
    targetUserId: existing.userId,
    targetType: "Customer",
    targetId: existing.id,
    detail: existing.fullName,
  });

  return res.status(204).send();
}

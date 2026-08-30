import type { Request, Response } from "express";
import { z } from "zod";
import { JobStatus, Role, type Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getPagination, paginatedResponse } from "../lib/pagination";
import { getCustomerIdForUser, getStaffIdForUser, getTeamStaffIds } from "../lib/access";
import { idParam } from "../lib/params";
import { notifyUser } from "../lib/notify";

const MANAGEMENT_ROLES: Role[] = [Role.OWNER, Role.MANAGER];

const createSchema = z.object({
  customerId: z.string().uuid(),
  assignedStaffId: z.string().uuid().optional(),
  serviceType: z.string().min(1),
  scheduledAt: z.coerce.date().optional(),
  notes: z.string().optional(),
  price: z.number().nonnegative().optional(),
});

const managementUpdateSchema = z.object({
  customerId: z.string().uuid().optional(),
  assignedStaffId: z.string().uuid().nullable().optional(),
  serviceType: z.string().min(1).optional(),
  status: z.enum(JobStatus).optional(),
  scheduledAt: z.coerce.date().optional(),
  notes: z.string().optional(),
  price: z.number().nonnegative().optional(),
});

const staffUpdateSchema = z.object({
  status: z.enum(JobStatus),
});

const teamLeadUpdateSchema = z.object({
  assignedStaffId: z.string().uuid(),
});

const reportSchema = z.object({
  productsUsed: z.string().min(1),
  dosage: z.string().min(1),
  notes: z.string().optional(),
  signatureUrl: z.string().optional(),
  pdfUrl: z.string().optional(),
});

const rateSchema = z.object({
  rating: z.number().int().min(1).max(5),
  ratingComment: z.string().optional(),
});

export async function listJobs(req: Request, res: Response) {
  const { skip, take, page, limit } = getPagination(req);
  const user = req.user!;

  const where: Prisma.JobWhereInput = {};

  if (MANAGEMENT_ROLES.includes(user.role)) {
    if (typeof req.query.staffId === "string") where.assignedStaffId = req.query.staffId;
    if (typeof req.query.customerId === "string") where.customerId = req.query.customerId;
  } else if (user.role === Role.TEAM_LEAD) {
    const teamIds = await getTeamStaffIds(user.sub);
    if (teamIds.length === 0) {
      return res.json(paginatedResponse([], 0, page, limit));
    }
    where.assignedStaffId = { in: teamIds };
  } else if (user.role === Role.STAFF) {
    const staffId = await getStaffIdForUser(user.sub);
    if (!staffId) {
      return res.json(paginatedResponse([], 0, page, limit));
    }
    where.assignedStaffId = staffId;
  } else {
    const customerId = await getCustomerIdForUser(user.sub);
    if (!customerId) {
      return res.json(paginatedResponse([], 0, page, limit));
    }
    where.customerId = customerId;
  }

  if (typeof req.query.status === "string") {
    where.status = req.query.status as JobStatus;
  }

  if (typeof req.query.date === "string") {
    const day = new Date(req.query.date);
    if (!Number.isNaN(day.getTime())) {
      const start = new Date(day);
      start.setHours(0, 0, 0, 0);
      const end = new Date(day);
      end.setHours(23, 59, 59, 999);
      where.scheduledAt = { gte: start, lte: end };
    }
  }

  const [data, total] = await Promise.all([
    prisma.job.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
    prisma.job.count({ where }),
  ]);

  return res.json(paginatedResponse(data, total, page, limit));
}

async function canAccessJob(user: { sub: string; role: Role }, job: { customerId: string; assignedStaffId: string | null }) {
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

export async function getJob(req: Request, res: Response) {
  const job = await prisma.job.findUnique({ where: { id: idParam(req) } });
  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }

  if (!(await canAccessJob(req.user!, job))) {
    return res.status(403).json({ error: "Insufficient permissions" });
  }

  return res.json(job);
}

export async function createJob(req: Request, res: Response) {
  const data = createSchema.parse(req.body);
  const job = await prisma.job.create({ data });
  return res.status(201).json(job);
}

async function notifyJobCompleted(jobId: string, customerId: string) {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (customer?.userId) {
    await notifyUser(customer.userId, "İşiniz tamamlandı", "Uygulama tamamlandı, geçmiş işlemler bölümünden değerlendirebilirsiniz.");
  }
}

export async function updateJob(req: Request, res: Response) {
  const existing = await prisma.job.findUnique({ where: { id: idParam(req) } });
  if (!existing) {
    return res.status(404).json({ error: "Job not found" });
  }

  const user = req.user!;

  if (MANAGEMENT_ROLES.includes(user.role)) {
    const data = managementUpdateSchema.parse(req.body);
    const completedAt = data.status === JobStatus.COMPLETED ? new Date() : undefined;
    const job = await prisma.job.update({ where: { id: idParam(req) }, data: { ...data, ...(completedAt && { completedAt }) } });
    if (completedAt) await notifyJobCompleted(job.id, job.customerId);
    return res.json(job);
  }

  if (user.role === Role.TEAM_LEAD) {
    const teamIds = await getTeamStaffIds(user.sub);
    if (!existing.assignedStaffId || !teamIds.includes(existing.assignedStaffId)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    const data = teamLeadUpdateSchema.parse(req.body);
    if (!teamIds.includes(data.assignedStaffId)) {
      return res.status(400).json({ error: "Can only reassign to a member of your own team" });
    }
    const job = await prisma.job.update({ where: { id: idParam(req) }, data });
    return res.json(job);
  }

  if (user.role === Role.STAFF) {
    const staffId = await getStaffIdForUser(user.sub);
    if (!staffId || staffId !== existing.assignedStaffId) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    const data = staffUpdateSchema.parse(req.body);
    const completedAt = data.status === JobStatus.COMPLETED ? new Date() : undefined;
    const job = await prisma.job.update({ where: { id: idParam(req) }, data: { ...data, ...(completedAt && { completedAt }) } });
    if (completedAt) await notifyJobCompleted(job.id, job.customerId);
    return res.json(job);
  }

  return res.status(403).json({ error: "Insufficient permissions" });
}

export async function deleteJob(req: Request, res: Response) {
  const existing = await prisma.job.findUnique({ where: { id: idParam(req) } });
  if (!existing) {
    return res.status(404).json({ error: "Job not found" });
  }

  await prisma.job.delete({ where: { id: idParam(req) } });
  return res.status(204).send();
}

export async function createJobReport(req: Request, res: Response) {
  const user = req.user!;
  const job = await prisma.job.findUnique({ where: { id: idParam(req) } });
  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }

  const staffId = await getStaffIdForUser(user.sub);
  if (!staffId || staffId !== job.assignedStaffId) {
    return res.status(403).json({ error: "Insufficient permissions" });
  }

  const data = reportSchema.parse(req.body);
  const report = await prisma.jobReport.create({
    data: { ...data, jobId: job.id, staffId },
  });

  return res.status(201).json(report);
}

export async function getJobReport(req: Request, res: Response) {
  const job = await prisma.job.findUnique({ where: { id: idParam(req) } });
  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }

  if (!(await canAccessJob(req.user!, job))) {
    return res.status(403).json({ error: "Insufficient permissions" });
  }

  const report = await prisma.jobReport.findFirst({ where: { jobId: job.id } });
  if (!report) {
    return res.status(404).json({ error: "Job report not found" });
  }

  return res.json(report);
}

export async function rateJob(req: Request, res: Response) {
  const user = req.user!;
  const job = await prisma.job.findUnique({ where: { id: idParam(req) } });
  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }

  const customerId = await getCustomerIdForUser(user.sub);
  if (!customerId || customerId !== job.customerId) {
    return res.status(403).json({ error: "Insufficient permissions" });
  }

  if (job.status !== JobStatus.COMPLETED) {
    return res.status(400).json({ error: "Only completed jobs can be rated" });
  }

  const data = rateSchema.parse(req.body);
  const updated = await prisma.job.update({ where: { id: job.id }, data });
  return res.json(updated);
}

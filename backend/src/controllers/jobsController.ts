import type { Request, Response } from "express";
import { z } from "zod";
import { JobStatus, Role, StockMovementType, type Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getPagination, paginatedResponse } from "../lib/pagination";
import { getCustomerIdForUser, getStaffIdForUser, getTeamStaffIds, canAccessJob } from "../lib/access";
import { idParam } from "../lib/params";
import { notifyUser } from "../lib/notify";
import { buildGoogleCalendarLink } from "../lib/googleCalendar";
import { checkLowStockAndNotify } from "../lib/reminders";
import { saveBase64Image } from "../lib/upload";

const MANAGEMENT_ROLES: Role[] = [Role.OWNER, Role.MANAGER];

// Liste/detay sorgularına gömülen minimal ilişki verisi — web tarafı bu sayede
// müşteri/personel adını göstermek için ayrıca /customers veya /staff çağırmak
// zorunda kalmıyor (STAFF/CUSTOMER zaten bu uçlara tam erişemiyor).
const JOB_NAME_INCLUDE = {
  customer: { select: { fullName: true } },
  assignedStaff: { select: { user: { select: { fullName: true } } } },
} satisfies Prisma.JobInclude;

function withCalendarLink<T extends { serviceType: string; scheduledAt: Date | null; notes: string | null }>(
  job: T
): T & { calendarLink: string | null } {
  return { ...job, calendarLink: buildGoogleCalendarLink(job) };
}

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
  productId: z.string().uuid().optional(),
  quantity: z.number().positive().optional(),
  productsUsed: z.string().min(1).optional(),
  dosage: z.string().min(1),
  notes: z.string().optional(),
  signatureUrl: z.string().optional(),
  signatureBase64: z.string().optional(),
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
  } else if (typeof req.query.from === "string" || typeof req.query.to === "string") {
    const range: { gte?: Date; lte?: Date } = {};
    if (typeof req.query.from === "string") {
      const from = new Date(req.query.from);
      if (!Number.isNaN(from.getTime())) range.gte = from;
    }
    if (typeof req.query.to === "string") {
      const to = new Date(req.query.to);
      if (!Number.isNaN(to.getTime())) range.lte = to;
    }
    if (range.gte || range.lte) where.scheduledAt = range;
  }

  const [data, total] = await Promise.all([
    prisma.job.findMany({ where, skip, take, orderBy: { createdAt: "desc" }, include: JOB_NAME_INCLUDE }),
    prisma.job.count({ where }),
  ]);

  return res.json(paginatedResponse(data.map(withCalendarLink), total, page, limit));
}

export async function getJob(req: Request, res: Response) {
  const job = await prisma.job.findUnique({ where: { id: idParam(req) }, include: JOB_NAME_INCLUDE });
  if (!job) {
    return res.status(404).json({ error: "İş bulunamadı" });
  }

  if (!(await canAccessJob(req.user!, job))) {
    return res.status(403).json({ error: "Bu işlem için yetkiniz yok" });
  }

  return res.json(withCalendarLink(job));
}

export async function createJob(req: Request, res: Response) {
  const data = createSchema.parse(req.body);
  const job = await prisma.job.create({ data });
  return res.status(201).json(withCalendarLink(job));
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
    return res.status(404).json({ error: "İş bulunamadı" });
  }

  const user = req.user!;

  if (MANAGEMENT_ROLES.includes(user.role)) {
    const data = managementUpdateSchema.parse(req.body);
    const completedAt = data.status === JobStatus.COMPLETED ? new Date() : undefined;
    const job = await prisma.job.update({ where: { id: idParam(req) }, data: { ...data, ...(completedAt && { completedAt }) } });
    if (completedAt) await notifyJobCompleted(job.id, job.customerId);
    return res.json(withCalendarLink(job));
  }

  if (user.role === Role.TEAM_LEAD) {
    const teamIds = await getTeamStaffIds(user.sub);
    if (!existing.assignedStaffId || !teamIds.includes(existing.assignedStaffId)) {
      return res.status(403).json({ error: "Bu işlem için yetkiniz yok" });
    }
    const data = teamLeadUpdateSchema.parse(req.body);
    if (!teamIds.includes(data.assignedStaffId)) {
      return res.status(400).json({ error: "Sadece kendi ekibinizden birine atama yapabilirsiniz" });
    }
    const job = await prisma.job.update({ where: { id: idParam(req) }, data });
    return res.json(withCalendarLink(job));
  }

  if (user.role === Role.STAFF) {
    const staffId = await getStaffIdForUser(user.sub);
    if (!staffId || staffId !== existing.assignedStaffId) {
      return res.status(403).json({ error: "Bu işlem için yetkiniz yok" });
    }
    const data = staffUpdateSchema.parse(req.body);
    const completedAt = data.status === JobStatus.COMPLETED ? new Date() : undefined;
    const job = await prisma.job.update({ where: { id: idParam(req) }, data: { ...data, ...(completedAt && { completedAt }) } });
    if (completedAt) await notifyJobCompleted(job.id, job.customerId);
    return res.json(withCalendarLink(job));
  }

  return res.status(403).json({ error: "Bu işlem için yetkiniz yok" });
}

export async function deleteJob(req: Request, res: Response) {
  const existing = await prisma.job.findUnique({ where: { id: idParam(req) } });
  if (!existing) {
    return res.status(404).json({ error: "İş bulunamadı" });
  }

  await prisma.job.delete({ where: { id: idParam(req) } });
  return res.status(204).send();
}

export async function createJobReport(req: Request, res: Response) {
  const user = req.user!;
  const job = await prisma.job.findUnique({ where: { id: idParam(req) } });
  if (!job) {
    return res.status(404).json({ error: "İş bulunamadı" });
  }

  const staffId = await getStaffIdForUser(user.sub);
  if (!staffId || staffId !== job.assignedStaffId) {
    return res.status(403).json({ error: "Bu işlem için yetkiniz yok" });
  }

  const { signatureBase64, ...data } = reportSchema.parse(req.body);

  if (data.productId && !data.quantity) {
    return res.status(400).json({ error: "productId belirtildiğinde miktar zorunludur" });
  }

  if (data.productId && data.quantity) {
    const product = await prisma.product.findUnique({ where: { id: data.productId } });
    if (!product) {
      return res.status(404).json({ error: "Ürün bulunamadı" });
    }
  }

  if (signatureBase64) {
    data.signatureUrl = saveBase64Image(signatureBase64, "imza");
  }

  const report = await prisma.$transaction(async (tx) => {
    const created = await tx.jobReport.create({
      data: { ...data, jobId: job.id, staffId },
    });

    if (data.productId && data.quantity) {
      await tx.product.update({
        where: { id: data.productId },
        data: { currentStock: { decrement: data.quantity } },
      });
      await tx.stockMovement.create({
        data: {
          productId: data.productId,
          type: StockMovementType.OUT,
          quantity: data.quantity,
          relatedJobReportId: created.id,
          note: `İş raporu: ${job.serviceType}`,
        },
      });
    }

    return created;
  });

  if (data.productId && data.quantity) {
    await checkLowStockAndNotify(data.productId);
  }

  return res.status(201).json(report);
}

export async function getJobReport(req: Request, res: Response) {
  const job = await prisma.job.findUnique({ where: { id: idParam(req) } });
  if (!job) {
    return res.status(404).json({ error: "İş bulunamadı" });
  }

  if (!(await canAccessJob(req.user!, job))) {
    return res.status(403).json({ error: "Bu işlem için yetkiniz yok" });
  }

  const report = await prisma.jobReport.findFirst({ where: { jobId: job.id } });
  if (!report) {
    return res.status(404).json({ error: "İş raporu bulunamadı" });
  }

  return res.json(report);
}

export async function rateJob(req: Request, res: Response) {
  const user = req.user!;
  const job = await prisma.job.findUnique({ where: { id: idParam(req) } });
  if (!job) {
    return res.status(404).json({ error: "İş bulunamadı" });
  }

  const customerId = await getCustomerIdForUser(user.sub);
  if (!customerId || customerId !== job.customerId) {
    return res.status(403).json({ error: "Bu işlem için yetkiniz yok" });
  }

  if (job.status !== JobStatus.COMPLETED) {
    return res.status(400).json({ error: "Sadece tamamlanmış işler değerlendirilebilir" });
  }

  const data = rateSchema.parse(req.body);
  const updated = await prisma.job.update({ where: { id: job.id }, data });
  return res.json(updated);
}

import type { Request, Response } from "express";
import { z } from "zod";
import { ComplaintPriority, ComplaintStatus, Role, type Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getPagination, paginatedResponse } from "../lib/pagination";
import { getCustomerIdForUser } from "../lib/access";
import { idParam } from "../lib/params";
import { recordAuditLog } from "../lib/auditLog";
import { notifyUser, notifyManagement } from "../lib/notify";

/**
 * Bölüm AO (9. tur): Müşteri şikayet/sorun bildirimi ve çözüm takibi.
 *
 * Akış: CUSTOMER → POST (OPEN, MEDIUM) → OWNER/MANAGER PATCH ile durum /
 * öncelik / atama / çözüm notu günceller. RESOLVED veya CLOSED'a geçişte
 * resolvedAt damgalanır ve müşteriye bildirim gider; yeniden açılırsa
 * (RESOLVED→IN_PROGRESS gibi) resolvedAt sıfırlanır. Job.rating'den
 * (basit puanlama) tamamen ayrı bir kayıttır.
 */

const createSchema = z.object({
  subject: z.string().trim().min(3).max(200),
  description: z.string().trim().min(10).max(4000),
  jobId: z.string().uuid().optional(),
  priority: z.enum(ComplaintPriority).optional(),
});

const updateSchema = z
  .object({
    status: z.enum(ComplaintStatus).optional(),
    priority: z.enum(ComplaintPriority).optional(),
    assignedToUserId: z.string().uuid().nullable().optional(),
    resolutionNote: z.string().trim().max(4000).nullable().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "Güncellenecek alan yok" });

const complaintInclude = {
  customer: { select: { id: true, fullName: true, phone: true } },
  job: { select: { id: true, sequenceNo: true, serviceType: true, scheduledAt: true, status: true } },
  assignedTo: { select: { id: true, fullName: true, role: true } },
} as const;

const STATUS_LABELS: Record<ComplaintStatus, string> = {
  OPEN: "Açık",
  IN_PROGRESS: "İşlemde",
  RESOLVED: "Çözüldü",
  CLOSED: "Kapatıldı",
};

const RESOLVED_STATUSES: ComplaintStatus[] = [ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED];

export async function createComplaint(req: Request, res: Response) {
  const user = req.user!;
  const customerId = await getCustomerIdForUser(user.sub);
  if (!customerId) {
    return res.status(400).json({ error: "Bu hesaba bağlı bir müşteri kaydı yok" });
  }

  const data = createSchema.parse(req.body);

  // İş bağlanıyorsa MÜŞTERİNİN KENDİ işi olmalı — başkasının işine şikayet bağlanamaz.
  if (data.jobId) {
    const job = await prisma.job.findUnique({ where: { id: data.jobId }, select: { customerId: true } });
    if (!job || job.customerId !== customerId) {
      return res.status(400).json({ error: "Geçersiz iş" });
    }
  }

  const complaint = await prisma.customerComplaint.create({
    data: { ...data, customerId },
    include: complaintInclude,
  });

  await recordAuditLog({
    actorUserId: user.sub,
    action: "complaint.created",
    targetUserId: user.sub,
    targetType: "CustomerComplaint",
    targetId: complaint.id,
    detail: data.subject,
  });

  await notifyManagement(
    "Yeni müşteri şikayeti",
    `${complaint.customer.fullName} · ${data.subject}`,
    { type: "complaint", relatedType: "CustomerComplaint", relatedId: complaint.id }
  );

  return res.status(201).json(complaint);
}

export async function listComplaints(req: Request, res: Response) {
  const { skip, take, page, limit } = getPagination(req);
  const user = req.user!;

  const where: Prisma.CustomerComplaintWhereInput = {};

  if (user.role === Role.CUSTOMER) {
    const customerId = await getCustomerIdForUser(user.sub);
    if (!customerId) {
      return res.json(paginatedResponse([], 0, page, limit));
    }
    where.customerId = customerId;
  }

  if (typeof req.query.status === "string" && (Object.values(ComplaintStatus) as string[]).includes(req.query.status)) {
    where.status = req.query.status as ComplaintStatus;
  }
  if (typeof req.query.priority === "string" && (Object.values(ComplaintPriority) as string[]).includes(req.query.priority)) {
    where.priority = req.query.priority as ComplaintPriority;
  }

  const [data, total] = await Promise.all([
    prisma.customerComplaint.findMany({
      where,
      skip,
      take,
      // Açık ve yüksek öncelikli olanlar üstte; sonra en yeni.
      orderBy: [{ status: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
      include: complaintInclude,
    }),
    prisma.customerComplaint.count({ where }),
  ]);

  return res.json(paginatedResponse(data, total, page, limit));
}

export async function getComplaint(req: Request, res: Response) {
  const user = req.user!;
  const complaint = await prisma.customerComplaint.findUnique({ where: { id: idParam(req) }, include: complaintInclude });
  if (!complaint) {
    return res.status(404).json({ error: "Şikayet bulunamadı" });
  }
  if (user.role === Role.CUSTOMER) {
    const customerId = await getCustomerIdForUser(user.sub);
    // Kayıt var ama başkasının — varlığını sızdırmamak için 404.
    if (!customerId || complaint.customerId !== customerId) {
      return res.status(404).json({ error: "Şikayet bulunamadı" });
    }
  }
  return res.json(complaint);
}

export async function updateComplaint(req: Request, res: Response) {
  const user = req.user!;
  const data = updateSchema.parse(req.body);

  const existing = await prisma.customerComplaint.findUnique({
    where: { id: idParam(req) },
    include: { customer: { select: { userId: true, fullName: true } } },
  });
  if (!existing) {
    return res.status(404).json({ error: "Şikayet bulunamadı" });
  }

  if (data.assignedToUserId) {
    const assignee = await prisma.user.findUnique({ where: { id: data.assignedToUserId }, select: { role: true, isActive: true } });
    // Şikayet yalnızca personele (OWNER/MANAGER/TEAM_LEAD/STAFF) atanabilir.
    if (!assignee || !assignee.isActive || assignee.role === Role.CUSTOMER) {
      return res.status(400).json({ error: "Geçersiz atanan kullanıcı" });
    }
  }

  const nextStatus = data.status ?? existing.status;
  const becomesResolved = RESOLVED_STATUSES.includes(nextStatus) && !RESOLVED_STATUSES.includes(existing.status);
  const reopened = !RESOLVED_STATUSES.includes(nextStatus) && RESOLVED_STATUSES.includes(existing.status);

  const complaint = await prisma.customerComplaint.update({
    where: { id: existing.id },
    data: {
      ...data,
      ...(becomesResolved ? { resolvedAt: new Date() } : {}),
      ...(reopened ? { resolvedAt: null } : {}),
    },
    include: complaintInclude,
  });

  await recordAuditLog({
    actorUserId: user.sub,
    action: "complaint.updated",
    targetUserId: existing.customer.userId ?? user.sub,
    targetType: "CustomerComplaint",
    targetId: complaint.id,
    detail: Object.entries(data)
      .map(([k, v]) => `${k}=${v ?? "null"}`)
      .join(", "),
  });

  // Durum değişince müşteriye haber ver (özellikle çözüm/kapanış).
  if (data.status && data.status !== existing.status && existing.customer.userId) {
    const title = becomesResolved ? "Şikayetiniz sonuçlandı" : "Şikayetiniz güncellendi";
    const body = `"${existing.subject}" · ${STATUS_LABELS[data.status]}${complaint.resolutionNote && becomesResolved ? ` — ${complaint.resolutionNote}` : ""}`;
    await notifyUser(existing.customer.userId, title, body, {
      type: "complaint",
      relatedType: "CustomerComplaint",
      relatedId: complaint.id,
    });
  }

  return res.json(complaint);
}

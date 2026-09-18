import type { Request, Response } from "express";
import { z } from "zod";
import { AppointmentRequestStatus, Role, type Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getPagination, paginatedResponse } from "../lib/pagination";
import { getCustomerIdForUser } from "../lib/access";
import { idParam } from "../lib/params";
import { recordAuditLog } from "../lib/auditLog";
import { notifyUser, notifyManagement } from "../lib/notify";
import { findActiveWarranties } from "../lib/warranty";

/**
 * Bölüm J (3. tur): Müşterinin kendi hesabından randevu talebi.
 *
 * Akış: CUSTOMER → POST (PENDING) → OWNER/MANAGER ya var olan bir Job'a
 * bağlayarak planlar (SCHEDULED + resultingJobId) ya da gerekçeyle reddeder
 * (DECLINED). Her karar müşteriye bildirim olarak gider; yeni talep yönetime
 * bildirilir (leaveRequests ile aynı desen).
 */

const createSchema = z
  .object({
    serviceTypeId: z.string().uuid(),
    preferredDateStart: z.coerce.date(),
    preferredDateEnd: z.coerce.date(),
    note: z.string().trim().max(1000).optional(),
  })
  .refine((d) => d.preferredDateStart < d.preferredDateEnd, {
    message: "Başlangıç tarihi bitiş tarihinden önce olmalıdır",
    path: ["preferredDateEnd"],
  })
  .refine((d) => d.preferredDateStart.getTime() > Date.now(), {
    message: "Tercih edilen tarih gelecekte olmalıdır",
    path: ["preferredDateStart"],
  });

const appointmentRequestInclude = {
  customer: { select: { id: true, fullName: true, phone: true } },
  serviceType: { select: { id: true, name: true } },
  respondedByUser: { select: { id: true, fullName: true } },
  resultingJob: { select: { id: true, sequenceNo: true, scheduledAt: true, status: true } },
} as const;

/**
 * Müşterinin talep formunda seçeceği aktif hizmet türleri. /service-types
 * CUSTOMER'a kapalı (yönetim ayarı); burada yalnızca id+name sızdırılır.
 */
export async function listServiceTypesForCustomer(_req: Request, res: Response) {
  const data = await prisma.serviceType.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return res.json({ data });
}

export async function createAppointmentRequest(req: Request, res: Response) {
  const user = req.user!;
  const customerId = await getCustomerIdForUser(user.sub);
  if (!customerId) {
    return res.status(400).json({ error: "Bu hesaba bağlı bir müşteri kaydı yok" });
  }

  const data = createSchema.parse(req.body);

  const serviceType = await prisma.serviceType.findUnique({ where: { id: data.serviceTypeId } });
  if (!serviceType || !serviceType.isActive) {
    return res.status(400).json({ error: "Geçersiz hizmet türü" });
  }

  const request = await prisma.appointmentRequest.create({
    data: { ...data, note: data.note || null, customerId },
    include: appointmentRequestInclude,
  });

  await recordAuditLog({
    actorUserId: user.sub,
    action: "appointment_request.created",
    targetUserId: user.sub,
    targetType: "AppointmentRequest",
    targetId: request.id,
    detail: `${serviceType.name} · ${data.preferredDateStart.toISOString()} – ${data.preferredDateEnd.toISOString()}`,
  });

  await notifyManagement(
    "Yeni randevu talebi",
    `${request.customer.fullName} · ${serviceType.name}`,
    { type: "appointment_request", relatedType: "AppointmentRequest", relatedId: request.id }
  );

  return res.status(201).json(request);
}

export async function listAppointmentRequests(req: Request, res: Response) {
  const { skip, take, page, limit } = getPagination(req);
  const user = req.user!;

  const where: Prisma.AppointmentRequestWhereInput = {};

  if (user.role === Role.CUSTOMER) {
    const customerId = await getCustomerIdForUser(user.sub);
    if (!customerId) {
      return res.json(paginatedResponse([], 0, page, limit));
    }
    where.customerId = customerId;
  }

  if (typeof req.query.status === "string" && (Object.values(AppointmentRequestStatus) as string[]).includes(req.query.status)) {
    where.status = req.query.status as AppointmentRequestStatus;
  }

  const [data, total] = await Promise.all([
    prisma.appointmentRequest.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: appointmentRequestInclude,
    }),
    prisma.appointmentRequest.count({ where }),
  ]);

  // Bölüm Y (6. tur): yönetim için, talebin müşterisinin aynı hizmet türünde
  // geçerli garantisi varsa satıra eklenir (Bekleyen Onaylar'da uyarı).
  if (user.role !== Role.CUSTOMER) {
    const enriched = await Promise.all(
      data.map(async (r) => {
        const active = r.status === AppointmentRequestStatus.PENDING ? await findActiveWarranties(r.customerId, r.serviceType.name) : [];
        return { ...r, activeWarranty: active[0] ?? null };
      })
    );
    return res.json(paginatedResponse(enriched, total, page, limit));
  }

  return res.json(paginatedResponse(data, total, page, limit));
}

async function loadPendingRequest(req: Request, res: Response) {
  const existing = await prisma.appointmentRequest.findUnique({
    where: { id: idParam(req) },
    include: { customer: { select: { userId: true, fullName: true } }, serviceType: { select: { name: true } } },
  });
  if (!existing) {
    res.status(404).json({ error: "Randevu talebi bulunamadı" });
    return null;
  }
  if (existing.status !== AppointmentRequestStatus.PENDING) {
    res.status(409).json({ error: "Bu talep zaten yanıtlanmış" });
    return null;
  }
  return existing;
}

const scheduleSchema = z.object({ jobId: z.string().uuid() });

export async function scheduleAppointmentRequest(req: Request, res: Response) {
  const user = req.user!;
  const existing = await loadPendingRequest(req, res);
  if (!existing) return;

  const { jobId } = scheduleSchema.parse(req.body);
  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { id: true, customerId: true, scheduledAt: true } });
  if (!job) {
    return res.status(404).json({ error: "İş bulunamadı" });
  }
  // Talebi başka bir müşterinin işine bağlamak veri tutarsızlığı yaratır.
  if (job.customerId !== existing.customerId) {
    return res.status(400).json({ error: "Seçilen iş bu müşteriye ait değil" });
  }

  const updated = await prisma.appointmentRequest.update({
    where: { id: existing.id },
    data: {
      status: AppointmentRequestStatus.SCHEDULED,
      resultingJobId: job.id,
      respondedByUserId: user.sub,
      respondedAt: new Date(),
    },
    include: appointmentRequestInclude,
  });

  if (existing.customer.userId) {
    await recordAuditLog({
      actorUserId: user.sub,
      action: "appointment_request.scheduled",
      targetUserId: existing.customer.userId,
      targetType: "AppointmentRequest",
      targetId: existing.id,
      detail: `job=${job.id}`,
    });
    await notifyUser(
      existing.customer.userId,
      "Randevu talebiniz planlandı",
      job.scheduledAt
        ? `${existing.serviceType.name} · ${job.scheduledAt.toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })}`
        : existing.serviceType.name,
      { type: "appointment_request_scheduled", relatedType: "Job", relatedId: job.id }
    );
  }

  return res.json(updated);
}

const declineSchema = z.object({ reason: z.string().trim().min(1, "Gerekçe zorunludur").max(1000) });

export async function declineAppointmentRequest(req: Request, res: Response) {
  const user = req.user!;
  const existing = await loadPendingRequest(req, res);
  if (!existing) return;

  const { reason } = declineSchema.parse(req.body);

  const updated = await prisma.appointmentRequest.update({
    where: { id: existing.id },
    data: {
      status: AppointmentRequestStatus.DECLINED,
      declineReason: reason,
      respondedByUserId: user.sub,
      respondedAt: new Date(),
    },
    include: appointmentRequestInclude,
  });

  if (existing.customer.userId) {
    await recordAuditLog({
      actorUserId: user.sub,
      action: "appointment_request.declined",
      targetUserId: existing.customer.userId,
      targetType: "AppointmentRequest",
      targetId: existing.id,
      detail: reason,
    });
    await notifyUser(existing.customer.userId, "Randevu talebiniz reddedildi", reason, {
      type: "appointment_request_declined",
      relatedType: "AppointmentRequest",
      relatedId: existing.id,
    });
  }

  return res.json(updated);
}

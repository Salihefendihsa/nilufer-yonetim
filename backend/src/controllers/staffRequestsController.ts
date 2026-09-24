import type { Request, Response } from "express";
import { z } from "zod";
import { Role, StaffRequestCategory, StaffRequestPriority, StaffRequestStatus, type Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getPagination, paginatedResponse } from "../lib/pagination";
import { idParam } from "../lib/params";
import { recordAuditLog } from "../lib/auditLog";
import { notifyOwners, notifyUser } from "../lib/notify";

/**
 * Personel talepleri — CustomerComplaint akışının tersi: MANAGER/TEAM_LEAD/
 * STAFF Patron'a genel talep (ekipman, öneri, şikayet, diğer) açar.
 *
 * Akış: personel → POST (OPEN) → yalnızca OWNER PATCH ile durum / öncelik /
 * yanıt notu günceller. RESOLVED veya REJECTED'a geçişte resolvedAt
 * damgalanır ve talep sahibine bildirim gider; yeniden açılırsa sıfırlanır.
 * Personel yalnızca kendi taleplerini görür; başkasınınkine erişim 404.
 */

const createSchema = z.object({
  subject: z.string().trim().min(3).max(200),
  description: z.string().trim().min(10).max(4000),
  category: z.enum(StaffRequestCategory).optional(),
  priority: z.enum(StaffRequestPriority).optional(),
});

const updateSchema = z
  .object({
    status: z.enum(StaffRequestStatus).optional(),
    priority: z.enum(StaffRequestPriority).optional(),
    responseNote: z.string().trim().max(4000).nullable().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "Güncellenecek alan yok" });

const staffRequestInclude = {
  staffUser: { select: { id: true, fullName: true, role: true } },
  respondedBy: { select: { id: true, fullName: true, role: true } },
} as const;

const STATUS_LABELS: Record<StaffRequestStatus, string> = {
  OPEN: "Açık",
  IN_PROGRESS: "İşlemde",
  RESOLVED: "Çözüldü",
  REJECTED: "Reddedildi",
};

const CLOSED_STATUSES: StaffRequestStatus[] = [StaffRequestStatus.RESOLVED, StaffRequestStatus.REJECTED];

export async function createStaffRequest(req: Request, res: Response) {
  const user = req.user!;
  const data = createSchema.parse(req.body);

  const request = await prisma.staffRequest.create({
    data: { ...data, staffUserId: user.sub },
    include: staffRequestInclude,
  });

  await recordAuditLog({
    actorUserId: user.sub,
    action: "staff_request.created",
    targetUserId: user.sub,
    targetType: "StaffRequest",
    targetId: request.id,
    detail: data.subject,
  });

  // Talepler yalnızca Patron'a gider (Müdür de talep açabildiği için yönetime değil).
  await notifyOwners("Yeni personel talebi", `${request.staffUser.fullName} · ${data.subject}`, {
    type: "staff_request",
    relatedType: "StaffRequest",
    relatedId: request.id,
  });


  return res.status(201).json(request);
}

export async function listStaffRequests(req: Request, res: Response) {
  const { skip, take, page, limit } = getPagination(req);
  const user = req.user!;

  const where: Prisma.StaffRequestWhereInput = {};
  if (user.role !== Role.OWNER) {
    where.staffUserId = user.sub;
  }

  if (typeof req.query.status === "string" && (Object.values(StaffRequestStatus) as string[]).includes(req.query.status)) {
    where.status = req.query.status as StaffRequestStatus;
  }
  if (typeof req.query.category === "string" && (Object.values(StaffRequestCategory) as string[]).includes(req.query.category)) {
    where.category = req.query.category as StaffRequestCategory;
  }
  if (typeof req.query.priority === "string" && (Object.values(StaffRequestPriority) as string[]).includes(req.query.priority)) {
    where.priority = req.query.priority as StaffRequestPriority;
  }

  const [data, total] = await Promise.all([
    prisma.staffRequest.findMany({
      where,
      skip,
      take,
      // Açık ve yüksek öncelikli olanlar üstte; sonra en yeni.
      orderBy: [{ status: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
      include: staffRequestInclude,
    }),
    prisma.staffRequest.count({ where }),
  ]);

  return res.json(paginatedResponse(data, total, page, limit));
}

export async function getStaffRequest(req: Request, res: Response) {
  const user = req.user!;
  const request = await prisma.staffRequest.findUnique({ where: { id: idParam(req) }, include: staffRequestInclude });
  // Kayıt var ama başkasının — varlığını sızdırmamak için 404.
  if (!request || (user.role !== Role.OWNER && request.staffUserId !== user.sub)) {
    return res.status(404).json({ error: "Talep bulunamadı" });
  }
  return res.json(request);
}

export async function updateStaffRequest(req: Request, res: Response) {
  const user = req.user!;
  const data = updateSchema.parse(req.body);

  const existing = await prisma.staffRequest.findUnique({ where: { id: idParam(req) } });
  if (!existing) {
    return res.status(404).json({ error: "Talep bulunamadı" });
  }

  const nextStatus = data.status ?? existing.status;
  const becomesClosed = CLOSED_STATUSES.includes(nextStatus) && !CLOSED_STATUSES.includes(existing.status);
  const reopened = !CLOSED_STATUSES.includes(nextStatus) && CLOSED_STATUSES.includes(existing.status);

  const request = await prisma.staffRequest.update({
    where: { id: existing.id },
    data: {
      ...data,
      respondedByUserId: user.sub,
      ...(becomesClosed ? { resolvedAt: new Date() } : {}),
      ...(reopened ? { resolvedAt: null } : {}),
    },
    include: staffRequestInclude,
  });

  await recordAuditLog({
    actorUserId: user.sub,
    action: "staff_request.updated",
    targetUserId: existing.staffUserId,
    targetType: "StaffRequest",
    targetId: request.id,
    detail: Object.entries(data)
      .map(([k, v]) => `${k}=${v ?? "null"}`)
      .join(", "),
  });

  // Durum değişince ya da yanıt yazılınca talep sahibine haber ver.
  const statusChanged = data.status !== undefined && data.status !== existing.status;
  const noteChanged = data.responseNote !== undefined && data.responseNote !== existing.responseNote;
  if (statusChanged || noteChanged) {
    const title = becomesClosed ? "Talebiniz sonuçlandı" : "Talebiniz yanıtlandı";
    const body = `"${existing.subject}" · ${STATUS_LABELS[request.status]}${request.responseNote ? ` — ${request.responseNote}` : ""}`;
    await notifyUser(existing.staffUserId, title, body, {
      type: "staff_request",
      relatedType: "StaffRequest",
      relatedId: request.id,
    });
  }

  return res.json(request);
}

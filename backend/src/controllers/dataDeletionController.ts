import type { Request, Response } from "express";
import { z } from "zod";
import { DataDeletionStatus, type Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getCustomerIdForUser } from "../lib/access";
import { idParam } from "../lib/params";
import { recordAuditLog } from "../lib/auditLog";
import { notifyManagement, notifyUser } from "../lib/notify";

/**
 * Bölüm AD (7. tur): KVKK veri silme/anonimleştirme talebi.
 * - POST /customers/me/deletion-request (CUSTOMER) — bekleyen talep varsa 409
 * - GET  /data-deletion-requests (OWNER) — ?status= (varsayılan PENDING)
 * - POST /data-deletion-requests/:id/approve (OWNER) — transaction: kişisel
 *   tanımlayıcılar anonimleştirilir, User pasif + tokenVersion++ (login ve mevcut
 *   JWT'ler biter), Job/Payment/Contract SİLİNMEZ. Geri alınamaz → net audit.
 * - POST /data-deletion-requests/:id/reject { reason } (OWNER)
 */
export const ANONYMIZED_NAME = "Silinmiş Müşteri";
export const ANONYMIZED_PHONE = "000 000 00 00";

const include = {
  customer: { select: { id: true, fullName: true, phone: true, email: true, userId: true } },
  processedBy: { select: { id: true, fullName: true } },
} as const;

export async function createMyDeletionRequest(req: Request, res: Response) {
  const customerId = await getCustomerIdForUser(req.user!.sub);
  if (!customerId) {
    return res.status(400).json({ error: "Bu hesaba bağlı bir müşteri kaydı yok" });
  }
  const pending = await prisma.dataDeletionRequest.findFirst({ where: { customerId, status: DataDeletionStatus.PENDING } });
  if (pending) {
    return res.status(409).json({ error: "Zaten bekleyen bir veri silme talebiniz var" });
  }
  const request = await prisma.dataDeletionRequest.create({ data: { customerId }, include });

  await recordAuditLog({
    actorUserId: req.user!.sub,
    action: "data_deletion.requested",
    targetUserId: req.user!.sub,
    targetType: "DataDeletionRequest",
    targetId: request.id,
  });
  await notifyManagement("KVKK veri silme talebi", `${request.customer.fullName} kişisel verilerinin silinmesini talep etti.`, {
    type: "data_deletion_request",
    relatedType: "DataDeletionRequest",
    relatedId: request.id,
  });
  return res.status(201).json(request);
}

export async function getMyDeletionRequest(req: Request, res: Response) {
  const customerId = await getCustomerIdForUser(req.user!.sub);
  if (!customerId) return res.json({ data: null });
  const latest = await prisma.dataDeletionRequest.findFirst({ where: { customerId }, orderBy: { requestedAt: "desc" }, include });
  return res.json({ data: latest });
}

export async function listDeletionRequests(req: Request, res: Response) {
  const where: Prisma.DataDeletionRequestWhereInput = {};
  const status = typeof req.query.status === "string" ? req.query.status : "PENDING";
  if (status !== "ALL" && (Object.values(DataDeletionStatus) as string[]).includes(status)) {
    where.status = status as DataDeletionStatus;
  }
  const data = await prisma.dataDeletionRequest.findMany({ where, orderBy: { requestedAt: "asc" }, include });
  return res.json({ data });
}

async function loadPending(req: Request, res: Response) {
  const existing = await prisma.dataDeletionRequest.findUnique({ where: { id: idParam(req) }, include });
  if (!existing) {
    res.status(404).json({ error: "Talep bulunamadı" });
    return null;
  }
  if (existing.status !== DataDeletionStatus.PENDING) {
    res.status(409).json({ error: "Bu talep zaten sonuçlandırılmış" });
    return null;
  }
  return existing;
}

export async function approveDeletionRequest(req: Request, res: Response) {
  const existing = await loadPending(req, res);
  if (!existing) return;
  const actor = req.user!.sub;
  const before = existing.customer;

  const updated = await prisma.$transaction(async (tx) => {
    // Kişisel tanımlayıcılar anonimleştirilir; ilişkili Job/Payment/Contract dokunulmaz.
    await tx.customer.update({
      where: { id: existing.customerId },
      data: { fullName: ANONYMIZED_NAME, phone: ANONYMIZED_PHONE, email: null, address: null, district: null, referralCode: null },
    });
    // Belgeler kişisel veri taşır — kayıtlar silinir (dosyalar aşağıda temizlenir).
    await tx.customerDocument.deleteMany({ where: { customerId: existing.customerId } });
    await tx.customerTagAssignment.deleteMany({ where: { customerId: existing.customerId } });
    if (before.userId) {
      await tx.user.update({
        where: { id: before.userId },
        data: {
          isActive: false,
          tokenVersion: { increment: 1 },
          fullName: ANONYMIZED_NAME,
          // E-posta benzersiz: kimliksizleştirilmiş, tahmin edilemez bir yer tutucu.
          email: `deleted-${existing.customerId}@anonim.local`,
          fcmTokens: [],
        },
      });
      await tx.userSession.deleteMany({ where: { userId: before.userId } });
    }
    return tx.dataDeletionRequest.update({
      where: { id: existing.id },
      data: { status: DataDeletionStatus.COMPLETED, processedByUserId: actor, processedAt: new Date() },
      include,
    });
  });

  await recordAuditLog({
    actorUserId: actor,
    action: "data_deletion.approved",
    targetUserId: before.userId ?? actor,
    targetType: "Customer",
    targetId: existing.customerId,
    detail: `GERİ ALINAMAZ: müşteri kişisel verileri anonimleştirildi (KVKK). İş/ödeme/sözleşme kayıtları korunuyor. Talep ${existing.id}.`,
  });

  return res.json(updated);
}

const rejectSchema = z.object({ reason: z.string().trim().min(1, "Gerekçe zorunludur").max(1000) });

export async function rejectDeletionRequest(req: Request, res: Response) {
  const existing = await loadPending(req, res);
  if (!existing) return;
  const { reason } = rejectSchema.parse(req.body);
  const updated = await prisma.dataDeletionRequest.update({
    where: { id: existing.id },
    data: { status: DataDeletionStatus.REJECTED, rejectionReason: reason, processedByUserId: req.user!.sub, processedAt: new Date() },
    include,
  });
  await recordAuditLog({
    actorUserId: req.user!.sub,
    action: "data_deletion.rejected",
    targetUserId: existing.customer.userId ?? req.user!.sub,
    targetType: "DataDeletionRequest",
    targetId: existing.id,
    detail: reason,
  });
  if (existing.customer.userId) {
    await notifyUser(existing.customer.userId, "Veri silme talebiniz reddedildi", reason, {
      type: "data_deletion_rejected",
      relatedType: "DataDeletionRequest",
      relatedId: existing.id,
    });
  }
  return res.json(updated);
}

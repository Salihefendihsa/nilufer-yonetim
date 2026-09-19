import type { Request, Response } from "express";
import { z } from "zod";
import { Role, VehicleMaintenanceType } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getStaffIdForUser } from "../lib/access";
import { idParam } from "../lib/params";
import { recordAuditLog } from "../lib/auditLog";

/**
 * Bölüm AQ (9. tur): araç bakım/muayene takibi —
 * GET/POST/PATCH/DELETE /staff/:id/vehicle-maintenance.
 * OWNER/MANAGER tam yetki; STAFF/TEAM_LEAD yalnızca KENDİ kaydını salt-okunur
 * (route: GET tüm roller, yazma OWNER/MANAGER). Backend vehiclePlate şartı
 * koymaz — plaka sonradan kaldırılsa geçmiş kayıtlar okunabilir kalır;
 * bölümü yalnızca plakası dolu personelde göstermek arayüzün işi.
 */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih YYYY-AA-GG biçiminde olmalı");

const createSchema = z
  .object({
    maintenanceType: z.enum(VehicleMaintenanceType),
    lastServiceDate: isoDate,
    nextDueDate: isoDate,
    note: z.string().trim().max(500).optional(),
  })
  .refine((d) => d.nextDueDate >= d.lastServiceDate, {
    message: "Sonraki bakım tarihi son bakım tarihinden önce olamaz",
    path: ["nextDueDate"],
  });

const updateSchema = z
  .object({
    maintenanceType: z.enum(VehicleMaintenanceType).optional(),
    lastServiceDate: isoDate.optional(),
    nextDueDate: isoDate.optional(),
    note: z.string().trim().max(500).nullable().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "Güncellenecek alan yok" });

export const MAINTENANCE_TYPE_LABELS: Record<VehicleMaintenanceType, string> = {
  INSPECTION: "Muayene",
  OIL_CHANGE: "Yağ Değişimi",
  TIRE: "Lastik",
  OTHER: "Diğer",
};

/** Tarih-only alanlar (@db.Date) UTC gece yarısı olarak yazılır — bkz. productBatches.ts. */
function toDateOnly(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

function daysUntil(due: Date, now = new Date()): number {
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const target = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

export function decorateMaintenance<T extends { nextDueDate: Date }>(row: T, now = new Date()) {
  const daysLeft = daysUntil(row.nextDueDate, now);
  return { ...row, daysLeft, isOverdue: daysLeft < 0 };
}

async function loadStaffOr404(req: Request, res: Response) {
  const staffId = idParam(req);
  const staff = await prisma.staff.findUnique({ where: { id: staffId }, select: { id: true, vehiclePlate: true } });
  if (!staff) {
    res.status(404).json({ error: "Personel bulunamadı" });
    return null;
  }
  return staff;
}

export async function listVehicleMaintenance(req: Request, res: Response) {
  const user = req.user!;
  const staff = await loadStaffOr404(req, res);
  if (!staff) return;

  if (user.role === Role.STAFF || user.role === Role.TEAM_LEAD) {
    const ownId = await getStaffIdForUser(user.sub);
    if (ownId !== staff.id) {
      return res.status(403).json({ error: "Yalnızca kendi araç bakım kayıtlarınızı görebilirsiniz" });
    }
  }

  const rows = await prisma.vehicleMaintenance.findMany({
    where: { staffId: staff.id },
    orderBy: { nextDueDate: "asc" },
  });
  return res.json({ vehiclePlate: staff.vehiclePlate, data: rows.map((r) => decorateMaintenance(r)) });
}

export async function createVehicleMaintenance(req: Request, res: Response) {
  const staff = await loadStaffOr404(req, res);
  if (!staff) return;

  const data = createSchema.parse(req.body);
  const row = await prisma.vehicleMaintenance.create({
    data: {
      staffId: staff.id,
      maintenanceType: data.maintenanceType,
      lastServiceDate: toDateOnly(data.lastServiceDate),
      nextDueDate: toDateOnly(data.nextDueDate),
      note: data.note || null,
    },
  });

  await recordAuditLog({
    actorUserId: req.user!.sub,
    action: "vehicle_maintenance.create",
    targetUserId: req.user!.sub,
    targetType: "VehicleMaintenance",
    targetId: row.id,
    detail: `${staff.vehiclePlate ?? "plakasız"} · ${MAINTENANCE_TYPE_LABELS[data.maintenanceType]} · sonraki ${data.nextDueDate}`,
  });

  return res.status(201).json(decorateMaintenance(row));
}

async function loadRowOr404(req: Request, res: Response) {
  const staffId = idParam(req);
  const rowId = String(req.params.maintenanceId);
  const row = await prisma.vehicleMaintenance.findUnique({ where: { id: rowId } });
  // Kayıt başka personele aitse de 404 — URL'deki :id ile tutarlı olmalı.
  if (!row || row.staffId !== staffId) {
    res.status(404).json({ error: "Bakım kaydı bulunamadı" });
    return null;
  }
  return row;
}

export async function updateVehicleMaintenance(req: Request, res: Response) {
  const existing = await loadRowOr404(req, res);
  if (!existing) return;

  const data = updateSchema.parse(req.body);
  const lastServiceDate = data.lastServiceDate ? toDateOnly(data.lastServiceDate) : existing.lastServiceDate;
  const nextDueDate = data.nextDueDate ? toDateOnly(data.nextDueDate) : existing.nextDueDate;
  if (nextDueDate < lastServiceDate) {
    return res.status(400).json({ error: "Sonraki bakım tarihi son bakım tarihinden önce olamaz" });
  }

  const row = await prisma.vehicleMaintenance.update({
    where: { id: existing.id },
    data: {
      ...(data.maintenanceType ? { maintenanceType: data.maintenanceType } : {}),
      lastServiceDate,
      nextDueDate,
      ...(data.note !== undefined ? { note: data.note || null } : {}),
      // Vade ileri alındıysa bir sonraki pencerede yeniden bildirim gitsin.
      ...(data.nextDueDate && nextDueDate.getTime() !== existing.nextDueDate.getTime() ? { lastDueAlertAt: null } : {}),
    },
  });
  return res.json(decorateMaintenance(row));
}

export async function deleteVehicleMaintenance(req: Request, res: Response) {
  const existing = await loadRowOr404(req, res);
  if (!existing) return;
  await prisma.vehicleMaintenance.delete({ where: { id: existing.id } });
  return res.status(204).send();
}

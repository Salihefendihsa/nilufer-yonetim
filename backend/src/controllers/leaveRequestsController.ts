import type { Request, Response } from "express";
import { z } from "zod";
import { LeaveRequestStatus, Role, StaffStatus, type Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getPagination, paginatedResponse } from "../lib/pagination";
import { getStaffIdForUser, getTeamStaffIds } from "../lib/access";
import { idParam } from "../lib/params";
import { recordAuditLog } from "../lib/auditLog";
import { notifyUser, notifyManagement } from "../lib/notify";
import { computeLeaveBalance, leaveDaysInYear } from "../lib/leaveBalance";

/**
 * Bölüm AH (7. tur): talebin gün sayısı ve o yılın kalan bakiyesine göre aşım
 * bayrağı — REDDETMEZ, yalnızca bilgi (yönetim yine onaylayabilir).
 */
async function withBalanceFlag<T extends { staffId: string; startDate: Date; endDate: Date; status: LeaveRequestStatus }>(rows: T[]) {
  const cache = new Map<string, Awaited<ReturnType<typeof computeLeaveBalance>>>();
  const out = [];
  for (const r of rows) {
    const year = r.startDate.getFullYear();
    const key = `${r.staffId}:${year}`;
    if (!cache.has(key)) cache.set(key, await computeLeaveBalance(r.staffId, year));
    const balance = cache.get(key) ?? null;
    const requestedDays = leaveDaysInYear(r.startDate, r.endDate, year);
    // Bekleyen talep için "onaylanırsa aşar mı"; onaylanmış talep zaten bakiyeye dahil.
    const exceedsBalance = balance !== null && r.status === LeaveRequestStatus.PENDING ? requestedDays > balance.remainingDays : false;
    out.push({ ...r, requestedDays, remainingDays: balance?.remainingDays ?? null, exceedsBalance });
  }
  return out;
}

const createSchema = z
  .object({
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    reason: z.string().min(1),
  })
  .refine((data) => data.startDate < data.endDate, {
    message: "Başlangıç tarihi bitiş tarihinden önce olmalıdır",
    path: ["endDate"],
  })
  .refine((data) => data.startDate.getTime() >= new Date().setHours(0, 0, 0, 0), {
    message: "Geçmiş bir tarih için izin talep edilemez",
    path: ["startDate"],
  });

export async function createLeaveRequest(req: Request, res: Response) {
  const user = req.user!;
  const staffId = await getStaffIdForUser(user.sub);
  if (!staffId) {
    return res.status(400).json({ error: "Bu hesaba bağlı bir personel kaydı yok" });
  }

  const data = createSchema.parse(req.body);
  const leaveRequest = await prisma.leaveRequest.create({ data: { ...data, staffId } });

  await recordAuditLog({
    actorUserId: user.sub,
    action: "leave_request.created",
    targetUserId: user.sub,
    targetType: "LeaveRequest",
    targetId: leaveRequest.id,
    detail: data.reason,
  });

  await notifyManagement("Yeni izin talebi", data.reason, {
    type: "leave_request",
    relatedType: "LeaveRequest",
    relatedId: leaveRequest.id,
  });

  return res.status(201).json(leaveRequest);
}

const leaveRequestInclude = {
  staff: { include: { user: { select: { fullName: true } } } },
} as const;

export async function listLeaveRequests(req: Request, res: Response) {
  const { skip, take, page, limit } = getPagination(req);
  const user = req.user!;

  const where: Prisma.LeaveRequestWhereInput = {};
  // web/src/app/(dashboard)/izinlerim: "İzin Taleplerim" sayfası TEAM_LEAD
  // için de yalnızca KENDİ taleplerini ister (ekibinin değil) — onay kuyruğu
  // (bekleyen-onaylar) zaten ekibin taleplerini ayrı çekiyor.
  const mineOnly = req.query.mine === "true";

  if (user.role === Role.STAFF || (user.role === Role.TEAM_LEAD && mineOnly)) {
    const staffId = await getStaffIdForUser(user.sub);
    if (!staffId) {
      return res.json(paginatedResponse([], 0, page, limit));
    }
    where.staffId = staffId;
  } else if (user.role === Role.TEAM_LEAD) {
    // Kendi talepleri + onay için ekibinin talepleri (getTeamStaffIds kendi
    // staffId'sini de içerir — bkz. lib/access.ts).
    const teamIds = await getTeamStaffIds(user.sub);
    where.staffId = { in: teamIds };
  } else if (typeof req.query.status === "string") {
    where.status = req.query.status as LeaveRequestStatus;
  }

  const [data, total] = await Promise.all([
    prisma.leaveRequest.findMany({
      where,
      skip,
      take,
      orderBy: { requestedAt: "desc" },
      include: leaveRequestInclude,
    }),
    prisma.leaveRequest.count({ where }),
  ]);

  return res.json(paginatedResponse(await withBalanceFlag(data), total, page, limit));
}

const decideSchema = z.object({
  status: z.enum([LeaveRequestStatus.APPROVED, LeaveRequestStatus.REJECTED]),
  decisionNote: z.string().min(1).optional(),
});

export async function decideLeaveRequest(req: Request, res: Response) {
  const user = req.user!;
  const existing = await prisma.leaveRequest.findUnique({
    where: { id: idParam(req) },
    include: { staff: { select: { id: true, userId: true } } },
  });
  if (!existing) {
    return res.status(404).json({ error: "İzin talebi bulunamadı" });
  }
  if (existing.status !== LeaveRequestStatus.PENDING) {
    return res.status(409).json({ error: "Bu talep zaten karara bağlanmış" });
  }

  if (user.role === Role.TEAM_LEAD) {
    const teamIds = await getTeamStaffIds(user.sub);
    if (!teamIds.includes(existing.staffId)) {
      return res.status(403).json({ error: "Bu talep sizin ekibinize ait değil" });
    }
  }

  const { status, decisionNote } = decideSchema.parse(req.body);

  // Bölüm AH: karar ÖNCESİ bakiye — aşım yalnızca uyarı bayrağı olarak yanıtta.
  const year = existing.startDate.getFullYear();
  const balanceBefore = await computeLeaveBalance(existing.staffId, year);
  const requestedDays = leaveDaysInYear(existing.startDate, existing.endDate, year);
  const exceedsBalance = balanceBefore !== null && requestedDays > balanceBefore.remainingDays;

  const leaveRequest = await prisma.$transaction(async (tx) => {
    const updated = await tx.leaveRequest.update({
      where: { id: existing.id },
      data: { status, decisionNote, decidedAt: new Date(), decidedByUserId: user.sub },
    });
    if (status === LeaveRequestStatus.APPROVED) {
      await tx.staff.update({
        where: { id: existing.staffId },
        data: { status: StaffStatus.ON_LEAVE, statusUntil: existing.endDate },
      });
    }
    return updated;
  });

  await recordAuditLog({
    actorUserId: user.sub,
    action: status === LeaveRequestStatus.APPROVED ? "leave_request.approved" : "leave_request.rejected",
    targetUserId: existing.staff.userId,
    targetType: "LeaveRequest",
    targetId: leaveRequest.id,
    detail: decisionNote,
  });

  await notifyUser(
    existing.staff.userId,
    status === LeaveRequestStatus.APPROVED ? "İzin talebiniz onaylandı" : "İzin talebiniz reddedildi",
    decisionNote,
    { type: "leave_request_decision", relatedType: "LeaveRequest", relatedId: leaveRequest.id }
  );

  return res.json({
    ...leaveRequest,
    requestedDays,
    exceedsBalance,
    remainingDaysAfter: balanceBefore ? balanceBefore.remainingDays - (status === LeaveRequestStatus.APPROVED ? requestedDays : 0) : null,
  });
}

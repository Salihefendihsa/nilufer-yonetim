import type { Request, Response } from "express";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getPagination, paginatedResponse } from "../lib/pagination";
import { getStaffIdForUser, getTeamStaffIds } from "../lib/access";

/**
 * Bölüm J: GET /pest-detections — yapay zekâ haşere analizleri.
 *
 * Kapsam (jobsController.listJobs ile aynı kurallar):
 * - OWNER/MANAGER: tümü
 * - TEAM_LEAD: ekibine (doğrudan raporlayan personel) atanmış işlerin fotoğrafları
 * - STAFF: kendisine atanmış işlerin fotoğrafları
 * (CUSTOMER rotada engellenir.)
 * Fotoğrafın kendisi kimlik doğrulamalı GET /files/job-photo/:id ile alınır.
 */
export async function listPestDetections(req: Request, res: Response) {
  const { skip, take, page, limit } = getPagination(req);
  const user = req.user!;

  const jobWhere: Prisma.JobWhereInput = {};
  if (user.role === Role.TEAM_LEAD) {
    const teamIds = await getTeamStaffIds(user.sub);
    if (teamIds.length === 0) return res.json({ ...paginatedResponse([], 0, page, limit), summary: [] });
    jobWhere.assignedStaffId = { in: teamIds };
  } else if (user.role === Role.STAFF) {
    const staffId = await getStaffIdForUser(user.sub);
    if (!staffId) return res.json({ ...paginatedResponse([], 0, page, limit), summary: [] });
    jobWhere.assignedStaffId = staffId;
  }

  const where: Prisma.PestDetectionWhereInput = { jobPhoto: { job: jobWhere } };
  if (typeof req.query.pestType === "string" && req.query.pestType.trim()) {
    where.detectedPestType = req.query.pestType.trim();
  }

  const [rows, total, grouped] = await Promise.all([
    prisma.pestDetection.findMany({
      where,
      skip,
      take,
      orderBy: { analyzedAt: "desc" },
      include: {
        jobPhoto: {
          select: {
            id: true,
            type: true,
            createdAt: true,
            job: {
              select: {
                id: true,
                sequenceNo: true,
                serviceType: true,
                customer: { select: { fullName: true } },
                assignedStaff: { select: { user: { select: { fullName: true } } } },
              },
            },
          },
        },
      },
    }),
    prisma.pestDetection.count({ where }),
    // Filtre öncesi kapsamdaki tür dağılımı — ekrandaki özet/çip listesi için.
    prisma.pestDetection.groupBy({
      by: ["detectedPestType"],
      where: { jobPhoto: { job: jobWhere } },
      _count: { _all: true },
      _avg: { confidence: true },
    }),
  ]);

  const data = rows.map((d) => ({
    id: d.id,
    detectedPestType: d.detectedPestType,
    confidence: d.confidence,
    description: d.description,
    model: d.model,
    analyzedAt: d.analyzedAt,
    photo: {
      id: d.jobPhoto.id,
      type: d.jobPhoto.type,
      createdAt: d.jobPhoto.createdAt,
      fileUrl: `/files/job-photo/${d.jobPhoto.id}`,
    },
    job: {
      id: d.jobPhoto.job.id,
      sequenceNo: d.jobPhoto.job.sequenceNo,
      serviceType: d.jobPhoto.job.serviceType,
      customerName: d.jobPhoto.job.customer.fullName,
      staffName: d.jobPhoto.job.assignedStaff?.user.fullName ?? null,
    },
  }));

  const summary = grouped
    .map((g) => ({ pestType: g.detectedPestType, count: g._count._all, averageConfidence: g._avg.confidence ?? 0 }))
    .sort((a, b) => b.count - a.count);

  return res.json({ ...paginatedResponse(data, total, page, limit), summary });
}

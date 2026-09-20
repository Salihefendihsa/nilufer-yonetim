import path from "path";
import type { Request, Response } from "express";
import { z } from "zod";
import { JobPhotoType, Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { idParam } from "../lib/params";
import { canAccessJob, getStaffIdForUser } from "../lib/access";
import { uploadedFileUrl } from "../lib/upload";
import { deleteFile } from "../lib/storage";

const MANAGEMENT_ROLES: Role[] = [Role.OWNER, Role.MANAGER];

const typeSchema = z.enum(JobPhotoType);

export async function listJobPhotos(req: Request, res: Response) {
  const job = await prisma.job.findUnique({ where: { id: idParam(req) } });
  if (!job) {
    return res.status(404).json({ error: "İş bulunamadı" });
  }

  if (!(await canAccessJob(req.user!, job))) {
    return res.status(403).json({ error: "Bu işlem için yetkiniz yok" });
  }

  const photos = await prisma.jobPhoto.findMany({ where: { jobId: job.id }, orderBy: { createdAt: "asc" } });
  return res.json({ data: photos });
}

export async function uploadJobPhoto(req: Request, res: Response) {
  const user = req.user!;
  const job = await prisma.job.findUnique({ where: { id: idParam(req) } });
  if (!job) {
    return res.status(404).json({ error: "İş bulunamadı" });
  }

  if (!MANAGEMENT_ROLES.includes(user.role)) {
    const staffId = await getStaffIdForUser(user.sub);
    if (!staffId || staffId !== job.assignedStaffId) {
      return res.status(403).json({ error: "Bu işlem için yetkiniz yok" });
    }
  }

  if (!req.file) {
    return res.status(400).json({ error: "Fotoğraf dosyası gerekli" });
  }

  const typeResult = typeSchema.safeParse(req.body.type ?? req.query.type);
  if (!typeResult.success) {
    return res.status(400).json({ error: "Fotoğraf türü \"BEFORE\" veya \"AFTER\" olmalı" });
  }

  const photo = await prisma.jobPhoto.create({
    data: {
      jobId: job.id,
      url: uploadedFileUrl(req.file.filename),
      type: typeResult.data,
      uploadedByUserId: user.sub,
    },
  });

  return res.status(201).json(photo);
}

export async function deleteJobPhoto(req: Request, res: Response) {
  const user = req.user!;
  const photo = await prisma.jobPhoto.findUnique({ where: { id: req.params.photoId as string } });
  if (!photo || photo.jobId !== idParam(req)) {
    return res.status(404).json({ error: "Fotoğraf bulunamadı" });
  }

  if (!MANAGEMENT_ROLES.includes(user.role) && photo.uploadedByUserId !== user.sub) {
    return res.status(403).json({ error: "Bu işlem için yetkiniz yok" });
  }

  await prisma.jobPhoto.delete({ where: { id: photo.id } });

  deleteFile(path.basename(photo.url)).catch(() => {});

  return res.status(204).send();
}

import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

const createSchema = z.object({
  name: z.string().min(1),
  issuedDate: z.coerce.date(),
  expiryDate: z.coerce.date(),
  documentUrl: z.string().optional(),
});

const updateSchema = createSchema.partial();

export async function listCertifications(req: Request, res: Response) {
  const staffId = req.params.id as string;
  const certifications = await prisma.staffCertification.findMany({
    where: { staffId },
    orderBy: { expiryDate: "asc" },
  });
  return res.json({ data: certifications });
}

export async function createCertification(req: Request, res: Response) {
  const staffId = req.params.id as string;

  const staff = await prisma.staff.findUnique({ where: { id: staffId } });
  if (!staff) {
    return res.status(404).json({ error: "Personel bulunamadı" });
  }

  const data = createSchema.parse(req.body);
  const certification = await prisma.staffCertification.create({ data: { ...data, staffId } });
  return res.status(201).json(certification);
}

export async function updateCertification(req: Request, res: Response) {
  const existing = await prisma.staffCertification.findUnique({ where: { id: req.params.certId as string } });
  if (!existing) {
    return res.status(404).json({ error: "Sertifika bulunamadı" });
  }

  const data = updateSchema.parse(req.body);
  const certification = await prisma.staffCertification.update({ where: { id: existing.id }, data });
  return res.json(certification);
}

export async function deleteCertification(req: Request, res: Response) {
  const existing = await prisma.staffCertification.findUnique({ where: { id: req.params.certId as string } });
  if (!existing) {
    return res.status(404).json({ error: "Sertifika bulunamadı" });
  }

  await prisma.staffCertification.delete({ where: { id: existing.id } });
  return res.status(204).send();
}

export async function getExpiringCertifications(_req: Request, res: Response) {
  const now = new Date();
  const in30Days = new Date();
  in30Days.setDate(now.getDate() + 30);

  const certifications = await prisma.staffCertification.findMany({
    where: { expiryDate: { gte: now, lte: in30Days } },
    orderBy: { expiryDate: "asc" },
    include: { staff: { include: { user: { select: { fullName: true } } } } },
  });

  return res.json({ data: certifications });
}

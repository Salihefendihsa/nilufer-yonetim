import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { idParam } from "../lib/params";

const settingsUpdateSchema = z.record(z.string(), z.string());

export async function listSettings(_req: Request, res: Response) {
  const settings = await prisma.setting.findMany({ orderBy: { key: "asc" } });
  const data = Object.fromEntries(settings.map((s) => [s.key, s.value]));
  return res.json({ data });
}

export async function updateSettings(req: Request, res: Response) {
  const data = settingsUpdateSchema.parse(req.body);

  await prisma.$transaction(
    Object.entries(data).map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      })
    )
  );

  const settings = await prisma.setting.findMany({ orderBy: { key: "asc" } });
  return res.json({ data: Object.fromEntries(settings.map((s) => [s.key, s.value])) });
}

const serviceTypeCreateSchema = z.object({
  name: z.string().min(1),
});

const serviceTypeUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

export async function listServiceTypes(_req: Request, res: Response) {
  const data = await prisma.serviceType.findMany({ orderBy: { name: "asc" } });
  return res.json({ data });
}

export async function createServiceType(req: Request, res: Response) {
  const data = serviceTypeCreateSchema.parse(req.body);
  const serviceType = await prisma.serviceType.create({ data });
  return res.status(201).json(serviceType);
}

export async function updateServiceType(req: Request, res: Response) {
  const data = serviceTypeUpdateSchema.parse(req.body);

  const existing = await prisma.serviceType.findUnique({ where: { id: idParam(req) } });
  if (!existing) {
    return res.status(404).json({ error: "Hizmet türü bulunamadı" });
  }

  const serviceType = await prisma.serviceType.update({ where: { id: idParam(req) }, data });
  return res.json(serviceType);
}

export async function deleteServiceType(req: Request, res: Response) {
  const existing = await prisma.serviceType.findUnique({ where: { id: idParam(req) } });
  if (!existing) {
    return res.status(404).json({ error: "Hizmet türü bulunamadı" });
  }

  await prisma.serviceType.update({ where: { id: idParam(req) }, data: { isActive: false } });
  return res.status(204).send();
}

const districtCreateSchema = z.object({
  name: z.string().min(1),
});

const districtUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

export async function listDistricts(_req: Request, res: Response) {
  const data = await prisma.district.findMany({ orderBy: { name: "asc" } });
  return res.json({ data });
}

export async function createDistrict(req: Request, res: Response) {
  const data = districtCreateSchema.parse(req.body);
  const district = await prisma.district.create({ data });
  return res.status(201).json(district);
}

export async function updateDistrict(req: Request, res: Response) {
  const data = districtUpdateSchema.parse(req.body);

  const existing = await prisma.district.findUnique({ where: { id: idParam(req) } });
  if (!existing) {
    return res.status(404).json({ error: "Bölge bulunamadı" });
  }

  const district = await prisma.district.update({ where: { id: idParam(req) }, data });
  return res.json(district);
}

export async function deleteDistrict(req: Request, res: Response) {
  const existing = await prisma.district.findUnique({ where: { id: idParam(req) } });
  if (!existing) {
    return res.status(404).json({ error: "Bölge bulunamadı" });
  }

  await prisma.district.update({ where: { id: idParam(req) }, data: { isActive: false } });
  return res.status(204).send();
}

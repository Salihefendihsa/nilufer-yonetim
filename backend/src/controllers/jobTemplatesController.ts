import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { idParam } from "../lib/params";

/**
 * Bölüm T (5. tur): İş şablonları CRUD (OWNER/MANAGER). Silme yumuşaktır
 * (isActive=false) — şablondan üretilmiş işler şablona referans tutmaz, bu
 * yüzden geçmiş etkilenmez; ?includeInactive=true ile pasifler de listelenir.
 */
const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  serviceType: z.string().trim().min(1).max(120),
  defaultPrice: z.number().nonnegative().nullable().optional(),
  defaultDurationMinutes: z.number().int().positive().max(24 * 60).nullable().optional(),
  defaultNotes: z.string().trim().max(2000).nullable().optional(),
});

const updateSchema = createSchema.partial().extend({ isActive: z.boolean().optional() });

export async function listJobTemplates(req: Request, res: Response) {
  const includeInactive = req.query.includeInactive === "true";
  const data = await prisma.jobTemplate.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
  return res.json({ data });
}

export async function createJobTemplate(req: Request, res: Response) {
  const data = createSchema.parse(req.body);
  const template = await prisma.jobTemplate.create({ data: { ...data, defaultNotes: data.defaultNotes || null } });
  return res.status(201).json(template);
}

export async function updateJobTemplate(req: Request, res: Response) {
  const data = updateSchema.parse(req.body);
  const existing = await prisma.jobTemplate.findUnique({ where: { id: idParam(req) } });
  if (!existing) {
    return res.status(404).json({ error: "Şablon bulunamadı" });
  }
  const template = await prisma.jobTemplate.update({
    where: { id: existing.id },
    data: { ...data, ...(data.defaultNotes !== undefined ? { defaultNotes: data.defaultNotes || null } : {}) },
  });
  return res.json(template);
}

export async function deleteJobTemplate(req: Request, res: Response) {
  const existing = await prisma.jobTemplate.findUnique({ where: { id: idParam(req) } });
  if (!existing) {
    return res.status(404).json({ error: "Şablon bulunamadı" });
  }
  await prisma.jobTemplate.update({ where: { id: existing.id }, data: { isActive: false } });
  return res.status(204).send();
}

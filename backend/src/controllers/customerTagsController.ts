import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { idParam } from "../lib/params";
import { recordAuditLog } from "../lib/auditLog";

/**
 * Bölüm X (6. tur): Müşteri etiketleri.
 * - /customer-tags CRUD (OWNER/MANAGER). DELETE gerçek silmedir: atamalar
 *   Cascade ile temizlenir (pasifleştirme için PATCH isActive:false).
 * - POST /customers/:id/tags { tagIds } müşterinin etiketlerini tam olarak
 *   verilen kümeye eşitler (ekleme + çıkarma tek çağrıda, transaction).
 */
const HEX = /^#[0-9a-fA-F]{6}$/;

const createSchema = z.object({
  name: z.string().trim().min(1).max(40),
  color: z.string().regex(HEX, "Renk #RRGGBB biçiminde olmalıdır").optional(),
});
const updateSchema = createSchema.partial().extend({ isActive: z.boolean().optional() });

export const customerTagSelect = { id: true, name: true, color: true, isActive: true } as const;

export async function listCustomerTags(req: Request, res: Response) {
  const includeInactive = req.query.includeInactive === "true";
  const data = await prisma.customerTag.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: { _count: { select: { assignments: true } } },
  });
  return res.json({ data: data.map((t) => ({ ...t, customerCount: t._count.assignments, _count: undefined })) });
}

export async function createCustomerTag(req: Request, res: Response) {
  const data = createSchema.parse(req.body);
  const existing = await prisma.customerTag.findUnique({ where: { name: data.name } });
  if (existing) {
    return res.status(409).json({ error: "Bu adda bir etiket zaten var" });
  }
  const tag = await prisma.customerTag.create({ data });
  return res.status(201).json(tag);
}

export async function updateCustomerTag(req: Request, res: Response) {
  const data = updateSchema.parse(req.body);
  const existing = await prisma.customerTag.findUnique({ where: { id: idParam(req) } });
  if (!existing) {
    return res.status(404).json({ error: "Etiket bulunamadı" });
  }
  if (data.name && data.name !== existing.name) {
    const dup = await prisma.customerTag.findUnique({ where: { name: data.name } });
    if (dup) return res.status(409).json({ error: "Bu adda bir etiket zaten var" });
  }
  const tag = await prisma.customerTag.update({ where: { id: existing.id }, data });
  return res.json(tag);
}

export async function deleteCustomerTag(req: Request, res: Response) {
  const existing = await prisma.customerTag.findUnique({ where: { id: idParam(req) } });
  if (!existing) {
    return res.status(404).json({ error: "Etiket bulunamadı" });
  }
  // Cascade: CustomerTagAssignment satırları da silinir.
  await prisma.customerTag.delete({ where: { id: existing.id } });
  await recordAuditLog({
    actorUserId: req.user!.sub,
    action: "customer_tag.deleted",
    targetUserId: req.user!.sub,
    targetType: "CustomerTag",
    targetId: existing.id,
    detail: existing.name,
  });
  return res.status(204).send();
}

const assignSchema = z.object({ tagIds: z.array(z.string().uuid()).max(50) });

export async function setCustomerTags(req: Request, res: Response) {
  const customerId = idParam(req);
  const { tagIds } = assignSchema.parse(req.body);

  const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } });
  if (!customer) {
    return res.status(404).json({ error: "Müşteri bulunamadı" });
  }

  const unique = [...new Set(tagIds)];
  if (unique.length > 0) {
    const found = await prisma.customerTag.count({ where: { id: { in: unique } } });
    if (found !== unique.length) {
      return res.status(400).json({ error: "Geçersiz etiket" });
    }
  }

  const tags = await prisma.$transaction(async (tx) => {
    await tx.customerTagAssignment.deleteMany({ where: { customerId, tagId: { notIn: unique } } });
    if (unique.length > 0) {
      await tx.customerTagAssignment.createMany({
        data: unique.map((tagId) => ({ customerId, tagId })),
        skipDuplicates: true,
      });
    }
    return tx.customerTagAssignment.findMany({ where: { customerId }, include: { tag: { select: customerTagSelect } } });
  });

  return res.json({ customerId, tags: tags.map((a) => a.tag) });
}

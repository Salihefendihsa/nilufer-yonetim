import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { idParam } from "../lib/params";

const createSchema = z.object({
  name: z.string().min(1),
  contactPerson: z.string().min(1).nullable().optional(),
  phone: z.string().min(1).nullable().optional(),
  email: z.string().email().nullable().optional(),
  address: z.string().min(1).nullable().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  contactPerson: z.string().min(1).nullable().optional(),
  phone: z.string().min(1).nullable().optional(),
  email: z.string().email().nullable().optional(),
  address: z.string().min(1).nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function listSuppliers(_req: Request, res: Response) {
  const data = await prisma.supplier.findMany({ orderBy: { name: "asc" } });
  return res.json({ data });
}

export async function createSupplier(req: Request, res: Response) {
  const data = createSchema.parse(req.body);
  const supplier = await prisma.supplier.create({ data });
  return res.status(201).json(supplier);
}

export async function updateSupplier(req: Request, res: Response) {
  const data = updateSchema.parse(req.body);

  const existing = await prisma.supplier.findUnique({ where: { id: idParam(req) } });
  if (!existing) {
    return res.status(404).json({ error: "Tedarikçi bulunamadı" });
  }

  const supplier = await prisma.supplier.update({ where: { id: idParam(req) }, data });
  return res.json(supplier);
}

// ServiceType/District ile aynı desen: DELETE kalıcı silmez, isActive'i
// false yapar — geçmiş satın alma taleplerindeki supplierId referansı
// (StockPurchaseRequest.supplier) bozulmasın diye.
export async function deleteSupplier(req: Request, res: Response) {
  const existing = await prisma.supplier.findUnique({ where: { id: idParam(req) } });
  if (!existing) {
    return res.status(404).json({ error: "Tedarikçi bulunamadı" });
  }

  await prisma.supplier.update({ where: { id: idParam(req) }, data: { isActive: false } });
  return res.status(204).send();
}

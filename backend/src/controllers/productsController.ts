import type { Request, Response } from "express";
import { z } from "zod";
import { StockMovementType } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getPagination, paginatedResponse } from "../lib/pagination";
import { idParam } from "../lib/params";

const createSchema = z.object({
  name: z.string().min(1),
  unit: z.string().min(1),
  currentStock: z.number().nonnegative().default(0),
  criticalThreshold: z.number().nonnegative(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  unit: z.string().min(1).optional(),
  criticalThreshold: z.number().nonnegative().optional(),
});

const restockSchema = z.object({
  quantity: z.number().positive(),
  note: z.string().optional(),
});

export async function listProducts(req: Request, res: Response) {
  const { skip, take, page, limit } = getPagination(req);
  const search = typeof req.query.search === "string" ? req.query.search : undefined;

  const where = search ? { name: { contains: search, mode: "insensitive" as const } } : {};

  const [data, total] = await Promise.all([
    prisma.product.findMany({ where, skip, take, orderBy: { name: "asc" } }),
    prisma.product.count({ where }),
  ]);

  return res.json(paginatedResponse(data, total, page, limit));
}

export async function getLowStockProducts(_req: Request, res: Response) {
  const products = await prisma.product.findMany({ orderBy: { name: "asc" } });
  const lowStock = products.filter((p) => Number(p.currentStock) <= Number(p.criticalThreshold));
  return res.json({ data: lowStock });
}

export async function createProduct(req: Request, res: Response) {
  const data = createSchema.parse(req.body);
  const product = await prisma.product.create({ data });
  return res.status(201).json(product);
}

export async function updateProduct(req: Request, res: Response) {
  const data = updateSchema.parse(req.body);

  const existing = await prisma.product.findUnique({ where: { id: idParam(req) } });
  if (!existing) {
    return res.status(404).json({ error: "Ürün bulunamadı" });
  }

  const product = await prisma.product.update({ where: { id: idParam(req) }, data });
  return res.json(product);
}

export async function deleteProduct(req: Request, res: Response) {
  const existing = await prisma.product.findUnique({ where: { id: idParam(req) } });
  if (!existing) {
    return res.status(404).json({ error: "Ürün bulunamadı" });
  }

  await prisma.product.delete({ where: { id: idParam(req) } });
  return res.status(204).send();
}

export async function restockProduct(req: Request, res: Response) {
  const existing = await prisma.product.findUnique({ where: { id: idParam(req) } });
  if (!existing) {
    return res.status(404).json({ error: "Ürün bulunamadı" });
  }

  const { quantity, note } = restockSchema.parse(req.body);

  const [product] = await prisma.$transaction([
    prisma.product.update({
      where: { id: existing.id },
      data: { currentStock: { increment: quantity } },
    }),
    prisma.stockMovement.create({
      data: { productId: existing.id, type: StockMovementType.IN, quantity, note },
    }),
  ]);

  return res.json(product);
}

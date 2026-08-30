import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { getPagination, paginatedResponse } from "../lib/pagination";
import { idParam } from "../lib/params";
import { notifyManagement } from "../lib/notify";

const createSchema = z.object({
  fullName: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().optional(),
  propertyType: z.string().min(1),
  serviceType: z.string().min(1),
  address: z.string().optional(),
  district: z.string().optional(),
});

const updateSchema = z.object({
  status: z.string().min(1),
});

export async function listQuotes(req: Request, res: Response) {
  const { skip, take, page, limit } = getPagination(req);

  const where = typeof req.query.status === "string" ? { status: req.query.status } : {};

  const [data, total] = await Promise.all([
    prisma.quoteRequest.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
    prisma.quoteRequest.count({ where }),
  ]);

  return res.json(paginatedResponse(data, total, page, limit));
}

export async function createQuote(req: Request, res: Response) {
  const data = createSchema.parse(req.body);
  const quote = await prisma.quoteRequest.create({ data });

  await notifyManagement("Yeni teklif talebi alındı", `${quote.fullName} - ${quote.serviceType}`);

  return res.status(201).json(quote);
}

export async function updateQuote(req: Request, res: Response) {
  const data = updateSchema.parse(req.body);

  const existing = await prisma.quoteRequest.findUnique({ where: { id: idParam(req) } });
  if (!existing) {
    return res.status(404).json({ error: "Quote request not found" });
  }

  const quote = await prisma.quoteRequest.update({ where: { id: idParam(req) }, data });
  return res.json(quote);
}

export async function convertQuote(req: Request, res: Response) {
  const quote = await prisma.quoteRequest.findUnique({ where: { id: idParam(req) } });
  if (!quote) {
    return res.status(404).json({ error: "Quote request not found" });
  }

  const [customer] = await prisma.$transaction([
    prisma.customer.create({
      data: {
        fullName: quote.fullName,
        phone: quote.phone,
        email: quote.email,
        address: quote.address,
        district: quote.district,
      },
    }),
    prisma.quoteRequest.update({ where: { id: quote.id }, data: { status: "CONVERTED" } }),
  ]);

  return res.status(201).json(customer);
}

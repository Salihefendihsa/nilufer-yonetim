import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";

export async function listAuditLogs(_req: Request, res: Response) {
  // Client-side filtering (date range, action, actor) — the whole log is fetched once.
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 1000,
    include: {
      actor: { select: { id: true, fullName: true, email: true } },
      target: { select: { id: true, fullName: true, email: true } },
    },
  });

  return res.json({ data: logs });
}

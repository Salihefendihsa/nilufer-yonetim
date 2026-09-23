import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { getMetrics } from "../lib/metrics";
import { isEmailConfigured } from "../lib/email";

export async function getSystemHealth(_req: Request, res: Response) {
  let databaseHealthy = true;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    databaseHealthy = false;
  }

  const metrics = getMetrics();

  return res.json({
    database: databaseHealthy ? "healthy" : "down",
    api: "healthy",
    uptimeSeconds: metrics.uptimeSeconds,
    totalRequestsToday: metrics.totalRequestsToday,
    errorCount24h: metrics.errorCount24h,
    // Son 60 dakika, dakika başına { minute, requests, errors } — Canlı Trafik.
    trafficPerMinute: metrics.trafficPerMinute,
    emailConfigured: isEmailConfigured(),
  });
}

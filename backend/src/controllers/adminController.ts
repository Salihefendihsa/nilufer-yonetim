import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { recordAuditLog } from "../lib/auditLog";

const clearDemoDataSchema = z.object({
  confirm: z.literal("TEMIZLE"),
});

export async function clearDemoData(req: Request, res: Response) {
  const parsed = clearDemoDataSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Bu işlemi onaylamak için gövdede confirm: \"TEMIZLE\" göndermelisiniz" });
  }

  const result = await prisma.$transaction(async (tx) => {
    const stockMovements = await tx.stockMovement.deleteMany({});
    const jobReports = await tx.jobReport.deleteMany({});
    const jobs = await tx.job.deleteMany({});
    const messages = await tx.message.deleteMany({});
    const conversations = await tx.conversation.deleteMany({});
    const advanceRequests = await tx.advanceRequest.deleteMany({});
    const payments = await tx.payment.deleteMany({});
    const contracts = await tx.contract.deleteMany({});
    const quoteRequests = await tx.quoteRequest.deleteMany({});
    const customers = await tx.customer.deleteMany({});

    return {
      stockMovements: stockMovements.count,
      jobReports: jobReports.count,
      jobs: jobs.count,
      messages: messages.count,
      conversations: conversations.count,
      advanceRequests: advanceRequests.count,
      payments: payments.count,
      contracts: contracts.count,
      quoteRequests: quoteRequests.count,
      customers: customers.count,
    };
  });

  await recordAuditLog({
    actorUserId: req.user!.sub,
    action: "admin.clear_demo_data",
    targetUserId: req.user!.sub,
    detail: JSON.stringify(result),
  });

  return res.json({ message: "Demo veriler silindi, kullanıcı hesapları korundu", deleted: result });
}

export async function getBackup(_req: Request, res: Response) {
  const [
    users,
    customers,
    staff,
    permissions,
    advanceRequests,
    jobs,
    jobReports,
    products,
    stockMovements,
    contracts,
    payments,
    conversations,
    messages,
    quoteRequests,
    notifications,
    auditLogs,
    settings,
    serviceTypes,
    districts,
  ] = await Promise.all([
    prisma.user.findMany(),
    prisma.customer.findMany(),
    prisma.staff.findMany(),
    prisma.permission.findMany(),
    prisma.advanceRequest.findMany(),
    prisma.job.findMany(),
    prisma.jobReport.findMany(),
    prisma.product.findMany(),
    prisma.stockMovement.findMany(),
    prisma.contract.findMany(),
    prisma.payment.findMany(),
    prisma.conversation.findMany(),
    prisma.message.findMany(),
    prisma.quoteRequest.findMany(),
    prisma.notification.findMany(),
    prisma.auditLog.findMany(),
    prisma.setting.findMany(),
    prisma.serviceType.findMany(),
    prisma.district.findMany(),
  ]);

  const backup = {
    generatedAt: new Date().toISOString(),
    users,
    customers,
    staff,
    permissions,
    advanceRequests,
    jobs,
    jobReports,
    products,
    stockMovements,
    contracts,
    payments,
    conversations,
    messages,
    quoteRequests,
    notifications,
    auditLogs,
    settings,
    serviceTypes,
    districts,
  };

  const dateStr = new Date().toISOString().slice(0, 10);
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="nilufer-yedek-${dateStr}.json"`);
  return res.send(JSON.stringify(backup, null, 2));
}

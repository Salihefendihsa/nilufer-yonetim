import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { getCustomerIdForUser } from "../lib/access";
import { recordAuditLog } from "../lib/auditLog";

/**
 * Bölüm AJ (8. tur): KVKK "veri taşınabilirliği" — müşteri KENDİ verisini JSON
 * olarak indirir. Yalnızca CUSTOMER; kapsam req.user → Customer eşlemesiyle
 * sabitlenir, parametre alınmaz (başkasının verisine erişim yolu yok).
 * Belgeler için yalnızca META (ad/tür/boyut/tarih) döner — dosya içeriği
 * GET /files/customer-document/:id kimlik doğrulamalı deseni üzerinden ayrıca alınır.
 */
export async function exportMyData(req: Request, res: Response) {
  const customerId = await getCustomerIdForUser(req.user!.sub);
  if (!customerId) return res.status(404).json({ error: "Müşteri kaydı bulunamadı" });

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, fullName: true, phone: true, email: true, address: true, district: true, referralCode: true, createdAt: true },
  });
  if (!customer) return res.status(404).json({ error: "Müşteri kaydı bulunamadı" });

  const [jobs, contracts, payments, appointmentRequests, documents] = await Promise.all([
    prisma.job.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, sequenceNo: true, serviceType: true, status: true, scheduledAt: true, scheduledEndAt: true,
        completedAt: true, price: true, rating: true, ratingComment: true, feedbackComment: true, createdAt: true,
      },
    }),
    prisma.contract.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      select: { id: true, startDate: true, endDate: true, durationMonths: true, status: true, serviceType: true, amount: true, recurrenceType: true, createdAt: true },
    }),
    prisma.payment.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      select: { id: true, amount: true, paymentType: true, referenceNo: true, createdAt: true },
    }),
    prisma.appointmentRequest.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, preferredDateStart: true, preferredDateEnd: true, note: true, status: true, respondedAt: true,
        declineReason: true, resultingJobId: true, createdAt: true, serviceType: { select: { name: true } },
      },
    }),
    // Yalnızca meta — fileUrl (disk yolu) dışa verilmez.
    prisma.customerDocument.findMany({
      where: { customerId },
      orderBy: { uploadedAt: "desc" },
      select: { id: true, fileName: true, fileType: true, fileSize: true, uploadedAt: true },
    }),
  ]);

  await recordAuditLog({
    actorUserId: req.user!.sub,
    action: "customer.data_export",
    targetUserId: req.user!.sub,
    targetType: "Customer",
    targetId: customerId,
    detail: `${jobs.length} iş, ${contracts.length} sözleşme, ${payments.length} ödeme, ${documents.length} belge`,
  });

  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader("Content-Disposition", `attachment; filename="verilerim-${stamp}.json"`);
  return res.json({
    exportedAt: new Date().toISOString(),
    customer,
    jobs,
    contracts,
    payments,
    appointmentRequests,
    documents,
  });
}

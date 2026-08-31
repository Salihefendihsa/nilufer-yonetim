import type { Request, Response } from "express";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import { prisma } from "../lib/prisma";
import { idParam } from "../lib/params";
import { canAccessJob, getCustomerIdForUser } from "../lib/access";

const COMPANY_NAME = "Nilüfer İlaçlama";

function formatDate(date: Date): string {
  return date.toLocaleDateString("tr-TR");
}

export async function exportJobReportPdf(req: Request, res: Response) {
  const job = await prisma.job.findUnique({
    where: { id: idParam(req) },
    include: { customer: true },
  });
  if (!job) {
    return res.status(404).json({ error: "İş bulunamadı" });
  }

  if (!(await canAccessJob(req.user!, job))) {
    return res.status(403).json({ error: "Bu işlem için yetkiniz yok" });
  }

  const report = await prisma.jobReport.findFirst({
    where: { jobId: job.id },
    include: { product: true },
  });
  if (!report) {
    return res.status(404).json({ error: "İş raporu bulunamadı" });
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="is-raporu-${job.id}.pdf"`);

  const doc = new PDFDocument({ size: "A4", margin: 50 });
  doc.pipe(res);

  doc.rect(0, 0, doc.page.width, 90).fill("#1F5C3D");
  doc.fillColor("#FFFFFF").fontSize(10).text("[LOGO]", 50, 30, { width: 60 });
  doc.fontSize(20).font("Helvetica-Bold").text(COMPANY_NAME, 120, 28);
  doc.fontSize(10).font("Helvetica").text("İlaçlama Hizmeti Uygulama Raporu (EK-1)", 120, 54);

  doc.fillColor("#000000").moveDown(4);
  const startY = 120;
  doc.fontSize(12).font("Helvetica-Bold").text("Müşteri Bilgileri", 50, startY);
  doc.fontSize(10).font("Helvetica");
  doc.text(`Ad Soyad: ${job.customer.fullName}`, 50, startY + 20);
  doc.text(`Telefon: ${job.customer.phone}`, 50, startY + 36);
  doc.text(`Adres: ${job.customer.address ?? "-"}`, 50, startY + 52);
  doc.text(`Tarih: ${formatDate(job.completedAt ?? job.createdAt)}`, 50, startY + 68);
  doc.text(`Hizmet Türü: ${job.serviceType}`, 50, startY + 84);

  const detailY = startY + 120;
  doc.fontSize(12).font("Helvetica-Bold").text("Uygulama Detayları", 50, detailY);
  doc.fontSize(10).font("Helvetica");
  doc.text(`Kullanılan Ürün: ${report.product?.name ?? report.productsUsed ?? "-"}`, 50, detailY + 20);
  doc.text(`Miktar: ${report.quantity ? `${report.quantity} ${report.product?.unit ?? ""}` : "-"}`, 50, detailY + 36);
  doc.text(`Doz: ${report.dosage}`, 50, detailY + 52);
  doc.text(`Notlar: ${report.notes ?? "-"}`, 50, detailY + 68);

  const signY = detailY + 140;
  doc.fontSize(12).font("Helvetica-Bold").text("İmza", 50, signY);
  doc.moveTo(50, signY + 50).lineTo(250, signY + 50).stroke();
  doc.fontSize(9).font("Helvetica").text("Müşteri İmzası", 50, signY + 55);

  doc.end();
}

export async function exportPaymentReceiptPdf(req: Request, res: Response) {
  const payment = await prisma.payment.findUnique({
    where: { id: idParam(req) },
    include: { customer: true },
  });
  if (!payment) {
    return res.status(404).json({ error: "Ödeme bulunamadı" });
  }

  const user = req.user!;
  if (user.role === "CUSTOMER") {
    const customerId = await getCustomerIdForUser(user.sub);
    if (customerId !== payment.customerId) {
      return res.status(403).json({ error: "Bu işlem için yetkiniz yok" });
    }
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="tahsilat-makbuzu-${payment.id}.pdf"`);

  const doc = new PDFDocument({ size: "A4", margin: 50 });
  doc.pipe(res);

  doc.rect(0, 0, doc.page.width, 90).fill("#1F5C3D");
  doc.fillColor("#FFFFFF").fontSize(10).text("[LOGO]", 50, 30, { width: 60 });
  doc.fontSize(20).font("Helvetica-Bold").text(COMPANY_NAME, 120, 28);
  doc.fontSize(10).font("Helvetica").text("Tahsilat Makbuzu", 120, 54);

  doc.fillColor("#000000");
  const startY = 130;
  doc.fontSize(10).font("Helvetica");
  doc.text(`Makbuz No: ${payment.id}`, 50, startY);
  doc.text(`Müşteri: ${payment.customer.fullName}`, 50, startY + 20);
  doc.text(`Telefon: ${payment.customer.phone}`, 50, startY + 36);
  doc.text(`Ödeme Türü: ${payment.paymentType}`, 50, startY + 52);
  doc.text(`Tarih: ${formatDate(payment.createdAt)}`, 50, startY + 68);

  doc.fontSize(16).font("Helvetica-Bold").text(`Tutar: ${Number(payment.amount).toFixed(2)} TL`, 50, startY + 110);

  doc.end();
}

export async function exportCustomersExcel(_req: Request, res: Response) {
  const customers = await prisma.customer.findMany({
    include: { jobs: true, payments: true },
    orderBy: { createdAt: "desc" },
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Müşteriler");
  sheet.columns = [
    { header: "İsim", key: "name", width: 28 },
    { header: "Telefon", key: "phone", width: 18 },
    { header: "Adres", key: "address", width: 36 },
    { header: "Bakiye (TL)", key: "balance", width: 16 },
  ];

  for (const customer of customers) {
    const totalPriced = customer.jobs.reduce((sum, job) => sum + Number(job.price ?? 0), 0);
    const totalPaid = customer.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    sheet.addRow({
      name: customer.fullName,
      phone: customer.phone,
      address: customer.address ?? "-",
      balance: (totalPriced - totalPaid).toFixed(2),
    });
  }

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="musteriler.xlsx"');

  await workbook.xlsx.write(res);
  res.end();
}

export async function exportPaymentsExcel(_req: Request, res: Response) {
  const payments = await prisma.payment.findMany({
    include: { customer: true },
    orderBy: { createdAt: "desc" },
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Ödemeler");
  sheet.columns = [
    { header: "Müşteri", key: "customer", width: 28 },
    { header: "Tutar (TL)", key: "amount", width: 16 },
    { header: "Ödeme Türü", key: "type", width: 18 },
    { header: "Tarih", key: "date", width: 18 },
  ];

  for (const payment of payments) {
    sheet.addRow({
      customer: payment.customer.fullName,
      amount: Number(payment.amount).toFixed(2),
      type: payment.paymentType,
      date: formatDate(payment.createdAt),
    });
  }

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="odemeler.xlsx"');

  await workbook.xlsx.write(res);
  res.end();
}

import type { Request, Response } from "express";
import { getStaffIdForUser } from "../lib/access";
import { computePayslip, parseMonth } from "../lib/payslip";

/**
 * Bölüm AN (9. tur): GET /staff/me/payslip?month=YYYY-MM — yalnızca
 * STAFF/TEAM_LEAD, yalnızca KENDİ kaydı (route seviyesinde OWNER/MANAGER
 * kapalı: yönetim tüm veriyi zaten Finans sayfasından görüyor; bu uç kişisel
 * bordro özetidir). Salt görüntüleme — ödeme tetiklemez.
 * `month` verilmezse içinde bulunulan ay.
 */
export async function getMyPayslip(req: Request, res: Response) {
  const staffId = await getStaffIdForUser(req.user!.sub);
  if (!staffId) {
    return res.status(404).json({ error: "Personel kaydı bulunamadı" });
  }

  let period = parseMonth(req.query.month);
  if (req.query.month !== undefined && !period) {
    return res.status(400).json({ error: "month YYYY-AA biçiminde olmalı" });
  }
  if (!period) {
    const now = new Date();
    period = { year: now.getFullYear(), month: now.getMonth() + 1 };
  }

  const payslip = await computePayslip(staffId, period.year, period.month);
  if (!payslip) {
    return res.status(404).json({ error: "Personel kaydı bulunamadı" });
  }
  return res.json({ staffId, ...payslip });
}

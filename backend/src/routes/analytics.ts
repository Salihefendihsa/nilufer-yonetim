import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth";
import {
  getRevenueTrend,
  getServiceBreakdown,
  getTopDistricts,
  getCustomerRetention,
  getFeedbackSummary,
  getYearOverYear,
  getQuoteResponseTime,
} from "../controllers/analyticsController";
import { exportAnalyticsPdf } from "../controllers/exportController";
import { getExecutiveSummary } from "../controllers/executiveSummaryController";

const router = Router();

router.use(requireAuth, requireRole(Role.OWNER, Role.MANAGER));

router.get("/revenue-trend", getRevenueTrend);
router.get("/service-breakdown", getServiceBreakdown);
router.get("/top-districts", getTopDistricts);
router.get("/customer-retention", getCustomerRetention);
// Bölüm S (5. tur): yapılandırılmış geri bildirim ortalamaları.
router.get("/feedback-summary", getFeedbackSummary);
// Bölüm AA (6. tur): bu yıl / geçen yıl aynı aylar.
router.get("/year-over-year", getYearOverYear);
// Bölüm AE (7. tur): teklif yanıt hızı (SLA).
router.get("/quote-response-time", getQuoteResponseTime);
router.get("/export/pdf", exportAnalyticsPdf);
// Bölüm G (2. tur): yönetici özet paneli — tüm KPI'lar tek çağrıda, drill-down hedefleriyle.
router.get("/executive-summary", getExecutiveSummary);

export default router;

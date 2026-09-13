import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth";
import {
  getRevenueTrend,
  getServiceBreakdown,
  getTopDistricts,
  getCustomerRetention,
} from "../controllers/analyticsController";
import { exportAnalyticsPdf } from "../controllers/exportController";
import { getExecutiveSummary } from "../controllers/executiveSummaryController";

const router = Router();

router.use(requireAuth, requireRole(Role.OWNER, Role.MANAGER));

router.get("/revenue-trend", getRevenueTrend);
router.get("/service-breakdown", getServiceBreakdown);
router.get("/top-districts", getTopDistricts);
router.get("/customer-retention", getCustomerRetention);
router.get("/export/pdf", exportAnalyticsPdf);
// Bölüm G (2. tur): yönetici özet paneli — tüm KPI'lar tek çağrıda, drill-down hedefleriyle.
router.get("/executive-summary", getExecutiveSummary);

export default router;

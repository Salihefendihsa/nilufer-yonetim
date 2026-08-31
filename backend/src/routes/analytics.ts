import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth";
import {
  getRevenueTrend,
  getServiceBreakdown,
  getTopDistricts,
  getCustomerRetention,
} from "../controllers/analyticsController";

const router = Router();

router.use(requireAuth, requireRole(Role.OWNER, Role.MANAGER));

router.get("/revenue-trend", getRevenueTrend);
router.get("/service-breakdown", getServiceBreakdown);
router.get("/top-districts", getTopDistricts);
router.get("/customer-retention", getCustomerRetention);

export default router;

import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth";
import { getDashboardSummary, getActivityFeed } from "../controllers/dashboardController";

const router = Router();

router.get("/summary", requireAuth, requireRole(Role.OWNER, Role.MANAGER), getDashboardSummary);
router.get("/activity-feed", requireAuth, requireRole(Role.OWNER, Role.MANAGER), getActivityFeed);

export default router;

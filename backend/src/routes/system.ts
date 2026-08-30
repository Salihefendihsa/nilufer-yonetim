import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth";
import { getSystemHealth } from "../controllers/systemController";

const router = Router();

router.get("/health", requireAuth, requireRole(Role.OWNER), getSystemHealth);

export default router;

import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth";
import { getSessionsReport } from "../controllers/sessionsController";

const router = Router();

router.use(requireAuth, requireRole(Role.OWNER));

router.get("/report", getSessionsReport);

export default router;

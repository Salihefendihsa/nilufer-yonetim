import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth";
import { listAuditLogs } from "../controllers/auditLogController";

const router = Router();

router.get("/", requireAuth, requireRole(Role.OWNER), listAuditLogs);

export default router;

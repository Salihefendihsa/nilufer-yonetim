import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole, requireRoleOrPermission } from "../middleware/auth";
import { listPayments, createPayment, getPaymentsSummary } from "../controllers/paymentsController";

const router = Router();

router.use(requireAuth);

router.get("/summary", requireRoleOrPermission([Role.MANAGER], "view_finance"), getPaymentsSummary);
router.get("/", requireRole(Role.OWNER, Role.MANAGER, Role.CUSTOMER), listPayments);
router.post("/", requireRole(Role.OWNER, Role.MANAGER), createPayment);

export default router;

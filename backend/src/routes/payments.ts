import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole, requireRoleOrPermission } from "../middleware/auth";
import { listPayments, createPayment, getPaymentsSummary } from "../controllers/paymentsController";
import { exportPaymentReceiptPdf, exportPaymentsExcel } from "../controllers/exportController";

const router = Router();

router.use(requireAuth);

router.get("/summary", requireRoleOrPermission([Role.MANAGER], "view_finance"), getPaymentsSummary);
router.get("/export/excel", requireRole(Role.OWNER, Role.MANAGER), exportPaymentsExcel);
router.get("/", requireRole(Role.OWNER, Role.MANAGER, Role.CUSTOMER), listPayments);
router.post("/", requireRole(Role.OWNER, Role.MANAGER), createPayment);
router.get("/:id/receipt/pdf", requireRole(Role.OWNER, Role.MANAGER, Role.CUSTOMER), exportPaymentReceiptPdf);

export default router;

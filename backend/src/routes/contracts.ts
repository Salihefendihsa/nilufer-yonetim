import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth";
import {
  listContracts,
  getExpiringContracts,
  getContract,
  createContract,
  updateContract,
  getContractsSummary,
  getContractsHealthCheck,
  renewContract,
  pauseContract,
  resumeContract,
} from "../controllers/contractsController";
import { exportContractPdf } from "../controllers/exportController";

const router = Router();

router.use(requireAuth);

router.get("/expiring", requireRole(Role.OWNER, Role.MANAGER), getExpiringContracts);
router.get("/summary", requireRole(Role.OWNER, Role.MANAGER), getContractsSummary);
router.get("/health-check", requireRole(Role.OWNER, Role.MANAGER), getContractsHealthCheck);
router.get("/", requireRole(Role.OWNER, Role.MANAGER, Role.CUSTOMER), listContracts);
router.get("/:id", requireRole(Role.OWNER, Role.MANAGER, Role.CUSTOMER), getContract);
router.get("/:id/pdf", requireRole(Role.OWNER, Role.MANAGER, Role.CUSTOMER), exportContractPdf);
router.post("/", requireRole(Role.OWNER, Role.MANAGER), createContract);
router.patch("/:id", requireRole(Role.OWNER, Role.MANAGER), updateContract);
router.post("/:id/renew", requireRole(Role.OWNER, Role.MANAGER), renewContract);
// Bölüm Q (4. tur): müşteri kendi aktif sözleşmesini duraklatır/devam ettirir (yönetim de yapabilir).
router.post("/:id/pause", requireRole(Role.CUSTOMER, Role.OWNER, Role.MANAGER), pauseContract);
router.post("/:id/resume", requireRole(Role.CUSTOMER, Role.OWNER, Role.MANAGER), resumeContract);

export default router;

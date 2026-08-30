import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth";
import {
  listContracts,
  getExpiringContracts,
  getContract,
  createContract,
  updateContract,
} from "../controllers/contractsController";

const router = Router();

router.use(requireAuth);

router.get("/expiring", requireRole(Role.OWNER, Role.MANAGER), getExpiringContracts);
router.get("/", requireRole(Role.OWNER, Role.MANAGER, Role.CUSTOMER), listContracts);
router.get("/:id", requireRole(Role.OWNER, Role.MANAGER, Role.CUSTOMER), getContract);
router.post("/", requireRole(Role.OWNER, Role.MANAGER), createContract);
router.patch("/:id", requireRole(Role.OWNER, Role.MANAGER), updateContract);

export default router;

import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole, requireRoleOrPermission } from "../middleware/auth";
import {
  listCustomers,
  getCustomer,
  createCustomer,
  getMyReferral,
  updateCustomer,
  deleteCustomer,
} from "../controllers/customersController";
import { exportCustomersExcel } from "../controllers/exportController";

const router = Router();

router.use(requireAuth);

router.get("/export/excel", requireRole(Role.OWNER, Role.MANAGER), exportCustomersExcel);
// Bölüm P (4. tur): müşterinin kendi davet kodu/linki — /:id'den ÖNCE.
router.get("/me/referral", requireRole(Role.CUSTOMER), getMyReferral);
router.get("/", requireRole(Role.OWNER, Role.MANAGER, Role.STAFF), listCustomers);
router.get("/:id", requireRole(Role.OWNER, Role.MANAGER, Role.STAFF), getCustomer);
router.post("/", requireRole(Role.OWNER, Role.MANAGER), createCustomer);
router.patch("/:id", requireRole(Role.OWNER, Role.MANAGER), updateCustomer);
router.delete("/:id", requireRoleOrPermission([Role.MANAGER], "delete_customers"), deleteCustomer);

export default router;

import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole, requireRoleOrPermission } from "../middleware/auth";
import {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from "../controllers/customersController";

const router = Router();

router.use(requireAuth);

router.get("/", requireRole(Role.OWNER, Role.MANAGER, Role.STAFF), listCustomers);
router.get("/:id", requireRole(Role.OWNER, Role.MANAGER, Role.STAFF), getCustomer);
router.post("/", requireRole(Role.OWNER, Role.MANAGER), createCustomer);
router.patch("/:id", requireRole(Role.OWNER, Role.MANAGER), updateCustomer);
router.delete("/:id", requireRoleOrPermission([Role.MANAGER], "delete_customers"), deleteCustomer);

export default router;

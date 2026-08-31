import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth";
import {
  listProducts,
  getLowStockProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  restockProduct,
} from "../controllers/productsController";

const router = Router();

router.use(requireAuth);

// STAFF/TEAM_LEAD need read access to pick a product when filing a job report.
router.get("/low-stock", requireRole(Role.OWNER, Role.MANAGER), getLowStockProducts);
router.get("/", requireRole(Role.OWNER, Role.MANAGER, Role.TEAM_LEAD, Role.STAFF), listProducts);
router.post("/", requireRole(Role.OWNER, Role.MANAGER), createProduct);
router.patch("/:id", requireRole(Role.OWNER, Role.MANAGER), updateProduct);
router.delete("/:id", requireRole(Role.OWNER, Role.MANAGER), deleteProduct);
router.post("/:id/restock", requireRole(Role.OWNER, Role.MANAGER), restockProduct);

export default router;

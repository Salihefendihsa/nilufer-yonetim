import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth";
import { listSuppliers, createSupplier, updateSupplier, deleteSupplier } from "../controllers/suppliersController";

const router = Router();

router.use(requireAuth, requireRole(Role.OWNER, Role.MANAGER));

router.get("/", listSuppliers);
router.post("/", createSupplier);
router.patch("/:id", updateSupplier);
router.delete("/:id", deleteSupplier);

export default router;

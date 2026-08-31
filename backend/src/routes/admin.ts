import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth";
import { clearDemoData, getBackup } from "../controllers/adminController";

const router = Router();

router.use(requireAuth, requireRole(Role.OWNER));

router.post("/clear-demo-data", clearDemoData);
router.get("/backup", getBackup);

export default router;

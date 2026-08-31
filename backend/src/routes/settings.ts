import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth";
import { listSettings, updateSettings } from "../controllers/settingsController";

const router = Router();

router.use(requireAuth, requireRole(Role.OWNER));

router.get("/", listSettings);
router.patch("/", updateSettings);

export default router;

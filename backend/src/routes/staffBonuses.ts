import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth";
import { listStaffBonuses, approveStaffBonus, rejectStaffBonus } from "../controllers/staffBonusesController";

const router = Router();

router.use(requireAuth, requireRole(Role.OWNER, Role.MANAGER));

router.get("/", listStaffBonuses);
router.post("/:id/approve", approveStaffBonus);
router.post("/:id/reject", rejectStaffBonus);

export default router;

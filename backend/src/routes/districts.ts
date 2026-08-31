import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth";
import { listDistricts, createDistrict, updateDistrict, deleteDistrict } from "../controllers/settingsController";

const router = Router();

router.use(requireAuth);

// GET is also needed by MANAGER when creating customers (dynamic district dropdown).
router.get("/", requireRole(Role.OWNER, Role.MANAGER, Role.TEAM_LEAD, Role.STAFF), listDistricts);
router.post("/", requireRole(Role.OWNER), createDistrict);
router.patch("/:id", requireRole(Role.OWNER), updateDistrict);
router.delete("/:id", requireRole(Role.OWNER), deleteDistrict);

export default router;

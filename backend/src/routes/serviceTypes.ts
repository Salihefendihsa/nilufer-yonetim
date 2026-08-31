import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth";
import {
  listServiceTypes,
  createServiceType,
  updateServiceType,
  deleteServiceType,
} from "../controllers/settingsController";

const router = Router();

router.use(requireAuth);

// GET is also needed by MANAGER when creating jobs (dynamic service type dropdown).
router.get("/", requireRole(Role.OWNER, Role.MANAGER, Role.TEAM_LEAD, Role.STAFF), listServiceTypes);
router.post("/", requireRole(Role.OWNER), createServiceType);
router.patch("/:id", requireRole(Role.OWNER), updateServiceType);
router.delete("/:id", requireRole(Role.OWNER), deleteServiceType);

export default router;

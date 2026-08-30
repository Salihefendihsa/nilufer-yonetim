import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth";
import {
  listStaff,
  getStaff,
  createStaff,
  updateStaff,
  deleteStaff,
  getStaffPermissions,
  updateStaffPermissions,
} from "../controllers/staffController";

const router = Router();

router.use(requireAuth);

router.get("/", requireRole(Role.OWNER, Role.MANAGER, Role.TEAM_LEAD, Role.STAFF), listStaff);
router.get("/:id", requireRole(Role.OWNER, Role.MANAGER, Role.TEAM_LEAD, Role.STAFF), getStaff);
router.post("/", requireRole(Role.OWNER, Role.MANAGER), createStaff);
router.patch("/:id", requireRole(Role.OWNER, Role.MANAGER), updateStaff);
router.delete("/:id", requireRole(Role.OWNER, Role.MANAGER), deleteStaff);

router.get("/:id/permissions", requireRole(Role.OWNER), getStaffPermissions);
router.patch("/:id/permissions", requireRole(Role.OWNER), updateStaffPermissions);

export default router;

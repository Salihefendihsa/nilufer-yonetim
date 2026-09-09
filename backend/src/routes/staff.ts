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
  updateStaffStatus,
  getStaffLeaderboard,
} from "../controllers/staffController";
import {
  listCertifications,
  createCertification,
  updateCertification,
  deleteCertification,
  getExpiringCertifications,
} from "../controllers/staffCertificationsController";

const router = Router();

router.use(requireAuth);

router.get("/leaderboard", requireRole(Role.OWNER, Role.MANAGER, Role.TEAM_LEAD), getStaffLeaderboard);
router.get("/certifications/expiring", requireRole(Role.OWNER, Role.MANAGER), getExpiringCertifications);
router.get("/", requireRole(Role.OWNER, Role.MANAGER, Role.TEAM_LEAD, Role.STAFF), listStaff);
router.get("/:id", requireRole(Role.OWNER, Role.MANAGER, Role.TEAM_LEAD, Role.STAFF), getStaff);
router.post("/", requireRole(Role.OWNER, Role.MANAGER), createStaff);
router.patch("/:id", requireRole(Role.OWNER, Role.MANAGER), updateStaff);
router.delete("/:id", requireRole(Role.OWNER, Role.MANAGER), deleteStaff);

router.get("/:id/permissions", requireRole(Role.OWNER), getStaffPermissions);
router.patch("/:id/permissions", requireRole(Role.OWNER), updateStaffPermissions);

router.patch(
  "/:id/status",
  requireRole(Role.OWNER, Role.MANAGER, Role.TEAM_LEAD, Role.STAFF),
  updateStaffStatus
);

router.get("/:id/certifications", requireRole(Role.OWNER, Role.MANAGER), listCertifications);
router.post("/:id/certifications", requireRole(Role.OWNER, Role.MANAGER), createCertification);
router.patch("/:id/certifications/:certId", requireRole(Role.OWNER, Role.MANAGER), updateCertification);
router.delete("/:id/certifications/:certId", requireRole(Role.OWNER, Role.MANAGER), deleteCertification);

export default router;

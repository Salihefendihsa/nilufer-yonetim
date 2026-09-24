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
  getOrgChart,
  promoteToManager,
  changeStaffRole,
} from "../controllers/staffController";
import {
  listCertifications,
  createCertification,
  updateCertification,
  deleteCertification,
  getExpiringCertifications,
} from "../controllers/staffCertificationsController";
import {
  createMyUnavailability,
  deleteMyUnavailability,
  listMyUnavailability,
  listStaffUnavailability,
  listUnavailableStaffOnDate,
} from "../controllers/staffUnavailabilityController";
import { getOnboarding, updateOnboardingItem } from "../controllers/onboardingController";
import { getMyLeaveBalance, getStaffLeaveBalance } from "../controllers/staffController";
import { getMyPayslip } from "../controllers/staffPayslipController";
import {
  listVehicleMaintenance,
  createVehicleMaintenance,
  updateVehicleMaintenance,
  deleteVehicleMaintenance,
} from "../controllers/vehicleMaintenanceController";
import { clockIn, clockOut, getMyAttendanceToday, getStaffAttendance } from "../controllers/attendanceController";
import { getMyCalendarIcs, getMyCalendarToken, rotateMyCalendarToken } from "../controllers/staffCalendarController";

const router = Router();

router.use(requireAuth);

router.get("/leaderboard", requireRole(Role.OWNER, Role.MANAGER, Role.TEAM_LEAD), getStaffLeaderboard);
router.get("/org-chart", requireRole(Role.OWNER), getOrgChart);
router.get("/certifications/expiring", requireRole(Role.OWNER, Role.MANAGER), getExpiringCertifications);
// Bölüm K (3. tur): müsaitlik — sabit yollar /:id'den ÖNCE kayıtlı olmalı.
router.get("/unavailability", requireRole(Role.OWNER, Role.MANAGER, Role.TEAM_LEAD), listUnavailableStaffOnDate);
// Bölüm AN (9. tur): kişisel bordro özeti — yalnızca STAFF/TEAM_LEAD (kendi kaydı).
router.get("/me/payslip", requireRole(Role.STAFF, Role.TEAM_LEAD), getMyPayslip);
router.get("/me/leave-balance", requireRole(Role.STAFF, Role.TEAM_LEAD), getMyLeaveBalance);
// Bölüm AP (9. tur): takvim dışa aktarma — ICS indirme + abonelik token'ı.
router.get("/me/calendar.ics", requireRole(Role.STAFF, Role.TEAM_LEAD), getMyCalendarIcs);
// Bölüm AR (9. tur): puantaj — giriş/çıkış yalnızca personelin kendisi.
router.post("/me/clock-in", requireRole(Role.STAFF, Role.TEAM_LEAD), clockIn);
router.post("/me/clock-out", requireRole(Role.STAFF, Role.TEAM_LEAD), clockOut);
router.get("/me/attendance/today", requireRole(Role.STAFF, Role.TEAM_LEAD), getMyAttendanceToday);
router.get("/me/calendar-token", requireRole(Role.STAFF, Role.TEAM_LEAD), getMyCalendarToken);
router.post("/me/calendar-token/rotate", requireRole(Role.STAFF, Role.TEAM_LEAD), rotateMyCalendarToken);
router.get("/me/unavailability", requireRole(Role.STAFF, Role.TEAM_LEAD), listMyUnavailability);
router.post("/me/unavailability", requireRole(Role.STAFF, Role.TEAM_LEAD), createMyUnavailability);
router.delete("/me/unavailability/:id", requireRole(Role.STAFF, Role.TEAM_LEAD), deleteMyUnavailability);
router.get("/", requireRole(Role.OWNER, Role.MANAGER, Role.TEAM_LEAD, Role.STAFF), listStaff);
router.get("/:id", requireRole(Role.OWNER, Role.MANAGER, Role.TEAM_LEAD, Role.STAFF), getStaff);
router.post("/", requireRole(Role.OWNER, Role.MANAGER), createStaff);
router.patch("/:id", requireRole(Role.OWNER, Role.MANAGER), updateStaff);
router.delete("/:id", requireRole(Role.OWNER, Role.MANAGER), deleteStaff);

router.post("/:id/promote-to-manager", requireRole(Role.OWNER), promoteToManager);
router.patch("/:id/role", requireRole(Role.OWNER), changeStaffRole);

router.get("/:id/permissions", requireRole(Role.OWNER), getStaffPermissions);
router.patch("/:id/permissions", requireRole(Role.OWNER), updateStaffPermissions);

router.patch(
  "/:id/status",
  requireRole(Role.OWNER, Role.MANAGER, Role.TEAM_LEAD, Role.STAFF),
  updateStaffStatus
);

router.get("/:id/unavailability", requireRole(Role.OWNER, Role.MANAGER, Role.TEAM_LEAD, Role.STAFF), listStaffUnavailability);
// Bölüm U (5. tur): işe alım kontrol listesi — STAFF/TEAM_LEAD kendi kaydını salt-okunur görür.
router.get("/:id/onboarding", requireRole(Role.OWNER, Role.MANAGER, Role.TEAM_LEAD, Role.STAFF), getOnboarding);
// Bölüm AH (7. tur): yıllık izin bakiyesi (STAFF/TEAM_LEAD kendi kaydı).
router.get("/:id/leave-balance", requireRole(Role.OWNER, Role.MANAGER, Role.TEAM_LEAD, Role.STAFF), getStaffLeaveBalance);
router.patch("/:id/onboarding/:itemId", requireRole(Role.OWNER, Role.MANAGER), updateOnboardingItem);
// Bölüm AR (9. tur): aylık puantaj — STAFF/TEAM_LEAD kendi kaydı (controller'da kontrol).
router.get("/:id/attendance", requireRole(Role.OWNER, Role.MANAGER, Role.TEAM_LEAD, Role.STAFF), getStaffAttendance);
// Bölüm AQ (9. tur): araç bakım — STAFF/TEAM_LEAD kendi kaydını salt-okunur (controller'da kontrol).
router.get("/:id/vehicle-maintenance", requireRole(Role.OWNER, Role.MANAGER, Role.TEAM_LEAD, Role.STAFF), listVehicleMaintenance);
router.post("/:id/vehicle-maintenance", requireRole(Role.OWNER, Role.MANAGER), createVehicleMaintenance);
router.patch("/:id/vehicle-maintenance/:maintenanceId", requireRole(Role.OWNER, Role.MANAGER), updateVehicleMaintenance);
router.delete("/:id/vehicle-maintenance/:maintenanceId", requireRole(Role.OWNER, Role.MANAGER), deleteVehicleMaintenance);
router.get("/:id/certifications", requireRole(Role.OWNER, Role.MANAGER), listCertifications);
router.post("/:id/certifications", requireRole(Role.OWNER, Role.MANAGER), createCertification);
router.patch("/:id/certifications/:certId", requireRole(Role.OWNER, Role.MANAGER), updateCertification);
router.delete("/:id/certifications/:certId", requireRole(Role.OWNER, Role.MANAGER), deleteCertification);

export default router;

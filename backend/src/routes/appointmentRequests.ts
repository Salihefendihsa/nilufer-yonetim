import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth";
import {
  createAppointmentRequest,
  listAppointmentRequests,
  scheduleAppointmentRequest,
  declineAppointmentRequest,
  listServiceTypesForCustomer,
} from "../controllers/appointmentRequestsController";

const router = Router();

router.use(requireAuth);

// Bölüm J (3. tur): müşteri kendi hesabından randevu talebi açar; yönetim
// planlar (var olan Job'a bağlar) veya reddeder.
router.get("/service-types", requireRole(Role.CUSTOMER, Role.OWNER, Role.MANAGER), listServiceTypesForCustomer);
router.post("/", requireRole(Role.CUSTOMER), createAppointmentRequest);
router.get("/", requireRole(Role.OWNER, Role.MANAGER, Role.CUSTOMER), listAppointmentRequests);
router.post("/:id/schedule", requireRole(Role.OWNER, Role.MANAGER), scheduleAppointmentRequest);
router.post("/:id/decline", requireRole(Role.OWNER, Role.MANAGER), declineAppointmentRequest);

export default router;

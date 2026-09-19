import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth";
import { createComplaint, getComplaint, listComplaints, updateComplaint } from "../controllers/complaintsController";

const router = Router();

router.use(requireAuth);

// Bölüm AO (9. tur): müşteri şikayet/sorun bildirimi — CUSTOMER kendi adına
// açar ve kendi kayıtlarını görür; OWNER/MANAGER tümünü görür ve yönetir.
router.post("/", requireRole(Role.CUSTOMER), createComplaint);
router.get("/", requireRole(Role.OWNER, Role.MANAGER, Role.CUSTOMER), listComplaints);
router.get("/:id", requireRole(Role.OWNER, Role.MANAGER, Role.CUSTOMER), getComplaint);
router.patch("/:id", requireRole(Role.OWNER, Role.MANAGER), updateComplaint);

export default router;

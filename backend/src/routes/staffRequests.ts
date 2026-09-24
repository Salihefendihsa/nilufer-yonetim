import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth";
import { createStaffRequest, getStaffRequest, listStaffRequests, updateStaffRequest } from "../controllers/staffRequestsController";

const router = Router();

router.use(requireAuth);

// Personel talepleri: MANAGER/TEAM_LEAD/STAFF kendi adına açar ve kendi
// kayıtlarını görür; OWNER tümünü görür ve yalnızca OWNER yanıtlar.
router.post("/", requireRole(Role.MANAGER, Role.TEAM_LEAD, Role.STAFF), createStaffRequest);
router.get("/", requireRole(Role.OWNER, Role.MANAGER, Role.TEAM_LEAD, Role.STAFF), listStaffRequests);
router.get("/:id", requireRole(Role.OWNER, Role.MANAGER, Role.TEAM_LEAD, Role.STAFF), getStaffRequest);
router.patch("/:id", requireRole(Role.OWNER), updateStaffRequest);

export default router;

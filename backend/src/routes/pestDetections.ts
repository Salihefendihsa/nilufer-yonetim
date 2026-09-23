import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth";
import { listPestDetections } from "../controllers/pestDetectionsController";

// Bölüm J: yapay zekâ haşere analizleri — tüm çalışan rolleri (kapsam
// controller'da daraltılır); müşteri erişemez.
const router = Router();

router.use(requireAuth);
router.get("/", requireRole(Role.OWNER, Role.MANAGER, Role.TEAM_LEAD, Role.STAFF), listPestDetections);

export default router;

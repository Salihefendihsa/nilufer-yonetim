import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth";
import { getTeamSummary, getTeamCalendar } from "../controllers/teamController";

const router = Router();

router.use(requireAuth);

// Ekip kapsamlı görünüm: TEAM_LEAD'in ana kullanıcısı, OWNER/MANAGER de
// kendi ekibi için çağırabilir. Şirket geneli özet /dashboard/summary'de
// kalır ve TEAM_LEAD'e AÇILMAZ.
router.get("/summary", requireRole(Role.OWNER, Role.MANAGER, Role.TEAM_LEAD), getTeamSummary);
router.get("/calendar", requireRole(Role.OWNER, Role.MANAGER, Role.TEAM_LEAD), getTeamCalendar);

export default router;

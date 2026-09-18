import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth";
import { getTeamSummary, getTeamCalendar, getTeamDailyBriefing } from "../controllers/teamController";
import { broadcastToTeam } from "../controllers/conversationsController";

const router = Router();

router.use(requireAuth);

// Ekip kapsamlı görünüm: TEAM_LEAD'in ana kullanıcısı, OWNER/MANAGER de
// kendi ekibi için çağırabilir. Şirket geneli özet /dashboard/summary'de
// kalır ve TEAM_LEAD'e AÇILMAZ.
router.get("/summary", requireRole(Role.OWNER, Role.MANAGER, Role.TEAM_LEAD), getTeamSummary);
router.get("/calendar", requireRole(Role.OWNER, Role.MANAGER, Role.TEAM_LEAD), getTeamCalendar);
// Bölüm M (4. tur): Şef → "Bugün Ekibim" brifingi (izin + müsaitlik + anlık durum).
router.get("/daily-briefing", requireRole(Role.TEAM_LEAD), getTeamDailyBriefing);
// Bölüm L (4. tur): Şef → ekibe toplu duyuru. /conversations/broadcast ile aynı
// mantık (her üyeye ayrı mesaj + team_broadcast bildirimi + push); bu yol
// yalnızca TEAM_LEAD'e açık ve { message } gövdesini kabul eder.
router.post("/broadcast", requireRole(Role.TEAM_LEAD), broadcastToTeam);

export default router;

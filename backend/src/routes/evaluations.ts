import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth";
import {
  listEvaluationCriteria,
  createEvaluationCriterion,
  updateEvaluationCriterion,
  deleteEvaluationCriterion,
  listEvaluationPeriods,
  createEvaluationPeriod,
  updateEvaluationPeriod,
  listEvaluations,
  getStaffEvaluationHistory,
  getEvaluation,
  createEvaluation,
  updateEvaluation,
  submitEvaluation,
} from "../controllers/evaluationsController";

const router = Router();

router.use(requireAuth);

const MANAGEMENT = [Role.OWNER, Role.MANAGER];
const VIEWERS = [Role.OWNER, Role.MANAGER, Role.TEAM_LEAD, Role.STAFF];

router.get("/", requireRole(...VIEWERS), listEvaluations);
// Bölüm V (5. tur): personelin dönemler arası averageScore geçmişi — /:id'den ÖNCE.
router.get("/staff/:staffId/history", requireRole(...VIEWERS), getStaffEvaluationHistory);
router.post("/", requireRole(...MANAGEMENT), createEvaluation);
router.get("/:id", requireRole(...VIEWERS), getEvaluation);
router.patch("/:id", requireRole(...MANAGEMENT), updateEvaluation);
router.post("/:id/submit", requireRole(...MANAGEMENT), submitEvaluation);

export default router;

export const criteriaRouter = Router();
criteriaRouter.use(requireAuth);
criteriaRouter.get("/", requireRole(...VIEWERS), listEvaluationCriteria);
criteriaRouter.post("/", requireRole(...MANAGEMENT), createEvaluationCriterion);
criteriaRouter.patch("/:id", requireRole(...MANAGEMENT), updateEvaluationCriterion);
criteriaRouter.delete("/:id", requireRole(...MANAGEMENT), deleteEvaluationCriterion);

export const periodsRouter = Router();
periodsRouter.use(requireAuth);
periodsRouter.get("/", requireRole(...VIEWERS), listEvaluationPeriods);
periodsRouter.post("/", requireRole(...MANAGEMENT), createEvaluationPeriod);
periodsRouter.patch("/:id", requireRole(...MANAGEMENT), updateEvaluationPeriod);

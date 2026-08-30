import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth";
import {
  listJobs,
  getJob,
  createJob,
  updateJob,
  deleteJob,
  createJobReport,
  getJobReport,
  rateJob,
} from "../controllers/jobsController";

const router = Router();

router.use(requireAuth);

router.get("/", listJobs);
router.get("/:id", getJob);
router.post("/", requireRole(Role.OWNER, Role.MANAGER), createJob);
router.patch("/:id", updateJob);
router.delete("/:id", requireRole(Role.OWNER, Role.MANAGER), deleteJob);

router.post("/:id/report", requireRole(Role.STAFF), createJobReport);
router.get("/:id/report", getJobReport);
router.patch("/:id/rate", requireRole(Role.CUSTOMER), rateJob);

export default router;

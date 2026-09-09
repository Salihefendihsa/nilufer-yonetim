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
  approveJobReport,
  rateJob,
} from "../controllers/jobsController";
import { exportJobReportPdf } from "../controllers/exportController";
import { listJobPhotos, uploadJobPhoto, deleteJobPhoto } from "../controllers/jobPhotosController";
import { upload } from "../lib/upload";

const router = Router();

router.use(requireAuth);

router.get("/", listJobs);
router.get("/:id", getJob);
router.post("/", requireRole(Role.OWNER, Role.MANAGER), createJob);
router.patch("/:id", updateJob);
router.delete("/:id", requireRole(Role.OWNER, Role.MANAGER), deleteJob);

router.post("/:id/report", requireRole(Role.STAFF), createJobReport);
router.get("/:id/report", getJobReport);
// Saha raporu onayı yönetim yetkisidir (Stitch Müdür → Ayarlar: "Saha Onayları: Yetkili").
router.post("/:id/report/approve", requireRole(Role.OWNER, Role.MANAGER), approveJobReport);
router.get("/:id/report/pdf", exportJobReportPdf);
router.patch("/:id/rate", requireRole(Role.CUSTOMER), rateJob);

router.get("/:id/photos", listJobPhotos);
router.post("/:id/photos", upload.single("photo"), uploadJobPhoto);
router.delete("/:id/photos/:photoId", deleteJobPhoto);

export default router;

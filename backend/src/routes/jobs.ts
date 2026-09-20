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
  updateJobChecklist,
  submitJobFeedback,
} from "../controllers/jobsController";
import { exportJobReportPdf } from "../controllers/exportController";
import { suggestStaff } from "../controllers/staffSuggestionController";
import { listJobPhotos, uploadJobPhoto, deleteJobPhoto } from "../controllers/jobPhotosController";
import { upload, finalizeUpload } from "../lib/upload";

const router = Router();

router.use(requireAuth);

router.get("/", listJobs);
// Bölüm Z (6. tur): personel atama önerisi — /:id'den ÖNCE kayıtlı olmalı.
router.get("/suggest-staff", requireRole(Role.OWNER, Role.MANAGER, Role.TEAM_LEAD), suggestStaff);
router.get("/:id", getJob);
router.post("/", requireRole(Role.OWNER, Role.MANAGER), createJob);
router.patch("/:id", updateJob);
router.delete("/:id", requireRole(Role.OWNER, Role.MANAGER), deleteJob);

// Bölüm N (4. tur): iş öncesi kontrol listesi — yalnızca işin atandığı personel.
router.patch("/:id/checklist", requireRole(Role.STAFF), updateJobChecklist);
router.post("/:id/report", requireRole(Role.STAFF), createJobReport);
router.get("/:id/report", getJobReport);
// Saha raporu onayı yönetim yetkisidir (Stitch Müdür → Ayarlar: "Saha Onayları: Yetkili").
router.post("/:id/report/approve", requireRole(Role.OWNER, Role.MANAGER), approveJobReport);
router.get("/:id/report/pdf", exportJobReportPdf);
router.patch("/:id/rate", requireRole(Role.CUSTOMER), rateJob);
// Bölüm S (5. tur): yapılandırılmış geri bildirim (bir kez, yalnızca COMPLETED).
router.patch("/:id/feedback", requireRole(Role.CUSTOMER), submitJobFeedback);

router.get("/:id/photos", listJobPhotos);
router.post("/:id/photos", upload.single("photo"), finalizeUpload, uploadJobPhoto);
router.delete("/:id/photos/:photoId", deleteJobPhoto);

export default router;

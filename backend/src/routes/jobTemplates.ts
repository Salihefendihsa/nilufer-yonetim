import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth";
import { listJobTemplates, createJobTemplate, updateJobTemplate, deleteJobTemplate } from "../controllers/jobTemplatesController";

const router = Router();

// Bölüm T (5. tur): iş şablonları — yalnızca yönetim.
router.use(requireAuth, requireRole(Role.OWNER, Role.MANAGER));

router.get("/", listJobTemplates);
router.post("/", createJobTemplate);
router.patch("/:id", updateJobTemplate);
router.delete("/:id", deleteJobTemplate);

export default router;

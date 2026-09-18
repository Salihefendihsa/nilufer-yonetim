import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth";
import { listDeletionRequests, approveDeletionRequest, rejectDeletionRequest } from "../controllers/dataDeletionController";

const router = Router();

// Bölüm AD (7. tur): KVKK talepleri yalnızca OWNER sonuçlandırır (geri alınamaz).
router.use(requireAuth, requireRole(Role.OWNER));
router.get("/", listDeletionRequests);
router.post("/:id/approve", approveDeletionRequest);
router.post("/:id/reject", rejectDeletionRequest);

export default router;

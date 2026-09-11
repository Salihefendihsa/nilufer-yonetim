import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth";
import { requestObserverAccess, getCurrentObserverAccess } from "../controllers/observerAccessController";

const router = Router();

router.use(requireAuth, requireRole(Role.OWNER));

router.post("/", requestObserverAccess);
router.get("/current", getCurrentObserverAccess);

export default router;

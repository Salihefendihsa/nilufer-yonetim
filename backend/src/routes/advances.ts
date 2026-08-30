import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth";
import { createAdvanceRequest, listAdvanceRequests, updateAdvanceRequest } from "../controllers/advancesController";

const router = Router();

router.use(requireAuth);

router.post("/", requireRole(Role.STAFF), createAdvanceRequest);
router.get("/", requireRole(Role.OWNER, Role.MANAGER, Role.STAFF), listAdvanceRequests);
router.patch("/:id", requireRole(Role.OWNER, Role.MANAGER), updateAdvanceRequest);

export default router;

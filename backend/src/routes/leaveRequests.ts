import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth";
import { createLeaveRequest, listLeaveRequests, decideLeaveRequest } from "../controllers/leaveRequestsController";

const router = Router();

router.use(requireAuth);

router.post("/", requireRole(Role.STAFF, Role.TEAM_LEAD), createLeaveRequest);
router.get("/", requireRole(Role.OWNER, Role.MANAGER, Role.TEAM_LEAD, Role.STAFF), listLeaveRequests);
router.patch("/:id/decide", requireRole(Role.OWNER, Role.MANAGER, Role.TEAM_LEAD), decideLeaveRequest);

export default router;

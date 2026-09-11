import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth";
import { listUsers, demoteFromManager, terminateUser, reactivateUser } from "../controllers/usersController";

const router = Router();

router.get("/", requireAuth, requireRole(Role.OWNER, Role.MANAGER), listUsers);

router.post("/:id/demote-from-manager", requireAuth, requireRole(Role.OWNER), demoteFromManager);
router.post("/:id/terminate", requireAuth, requireRole(Role.OWNER), terminateUser);
router.post("/:id/reactivate", requireAuth, requireRole(Role.OWNER), reactivateUser);

export default router;

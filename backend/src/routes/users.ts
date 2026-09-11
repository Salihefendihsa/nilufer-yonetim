import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth";
import { listUsers, demoteFromManager, terminateUser, reactivateUser, registerFcmToken } from "../controllers/usersController";

const router = Router();

router.get("/", requireAuth, requireRole(Role.OWNER, Role.MANAGER), listUsers);

// Herhangi bir giriş yapmış kullanıcı kendi cihazının push token'ını kaydeder.
router.post("/me/fcm-token", requireAuth, registerFcmToken);

router.post("/:id/demote-from-manager", requireAuth, requireRole(Role.OWNER), demoteFromManager);
router.post("/:id/terminate", requireAuth, requireRole(Role.OWNER), terminateUser);
router.post("/:id/reactivate", requireAuth, requireRole(Role.OWNER), reactivateUser);

export default router;

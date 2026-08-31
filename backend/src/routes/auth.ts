import { Router } from "express";
import { register, login, me, heartbeat, logoutSession } from "../controllers/authController";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", requireAuth, me);
router.post("/heartbeat", requireAuth, heartbeat);
router.post("/logout", requireAuth, logoutSession);

export default router;

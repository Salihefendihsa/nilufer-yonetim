import { Router } from "express";
import { register, login, me, heartbeat, logoutSession } from "../controllers/authController";
import { requireAuth } from "../middleware/auth";
import { loginRateLimiter } from "../middleware/loginRateLimit";

const router = Router();

router.post("/register", register);
router.post("/login", loginRateLimiter, login);
router.get("/me", requireAuth, me);
router.post("/heartbeat", requireAuth, heartbeat);
router.post("/logout", requireAuth, logoutSession);

export default router;

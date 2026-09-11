import { Router } from "express";
import {
  register,
  login,
  me,
  heartbeat,
  logoutSession,
  forgotPassword,
  resetPassword,
  changePassword,
} from "../controllers/authController";
import { requireAuth } from "../middleware/auth";
import { loginRateLimiter, forgotPasswordRateLimiter } from "../middleware/loginRateLimit";

const router = Router();

router.post("/register", register);
router.post("/login", loginRateLimiter, login);
router.get("/me", requireAuth, me);
router.post("/heartbeat", requireAuth, heartbeat);
router.post("/logout", requireAuth, logoutSession);
router.post("/forgot-password", forgotPasswordRateLimiter, forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/change-password", requireAuth, changePassword);

export default router;

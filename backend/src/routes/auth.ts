import { Router } from "express";
import { Role } from "@prisma/client";
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
import {
  setupTwoFactor,
  enableTwoFactor,
  disableTwoFactor,
  verifyTwoFactor,
} from "../controllers/twoFactorController";
import { requireAuth, requireRole } from "../middleware/auth";
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

// İki adımlı doğrulama (yalnızca OWNER/MANAGER) — bkz. docs/NEW_FEATURES_TOUR.md Bölüm D.
router.post("/2fa/setup", requireAuth, requireRole(Role.OWNER, Role.MANAGER), setupTwoFactor);
router.post("/2fa/enable", requireAuth, requireRole(Role.OWNER, Role.MANAGER), enableTwoFactor);
router.post("/2fa/disable", requireAuth, requireRole(Role.OWNER, Role.MANAGER), disableTwoFactor);
// Girişin ikinci adımı — kullanıcı henüz oturum açmadığı için requireAuth YOK,
// kimlik preToken üzerinden doğrulanır (loginRateLimiter ile aynı brute-force korumasını paylaşır).
router.post("/2fa/verify", loginRateLimiter, verifyTwoFactor);

export default router;

import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  getMyNotificationPreferences,
  updateMyNotificationPreferences,
} from "../controllers/notificationPreferencesController";

const router = Router();

router.use(requireAuth);

router.get("/", getMyNotificationPreferences);
router.patch("/", updateMyNotificationPreferences);

export default router;

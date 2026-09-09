import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  getNotificationSummary,
} from "../controllers/notificationsController";

const router = Router();

router.use(requireAuth);

router.get("/unread-count", getUnreadCount);
router.get("/summary", getNotificationSummary);
router.get("/", listNotifications);
router.patch("/read-all", markAllNotificationsRead);
router.patch("/:id/read", markNotificationRead);

export default router;

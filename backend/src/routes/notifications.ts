import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from "../controllers/notificationsController";

const router = Router();

router.use(requireAuth);

router.get("/unread-count", getUnreadCount);
router.get("/", listNotifications);
router.patch("/read-all", markAllNotificationsRead);
router.patch("/:id/read", markNotificationRead);

export default router;

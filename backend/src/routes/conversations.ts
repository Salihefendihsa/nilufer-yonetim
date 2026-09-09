import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth";
import {
  listConversations,
  listAllConversations,
  getMessages,
  createConversation,
  sendMessage,
  markConversationRead,
  listAvailableContacts,
  broadcastToTeam,
} from "../controllers/conversationsController";

const router = Router();

router.use(requireAuth);

router.get("/available-contacts", listAvailableContacts);
router.get("/all", requireRole(Role.OWNER), listAllConversations);
router.get("/", listConversations);
router.post("/", createConversation);
// Toplu ekip duyurusu — yalnızca ekip lideri (ve yönetim kendi ekibi için).
router.post("/broadcast", requireRole(Role.OWNER, Role.MANAGER, Role.TEAM_LEAD), broadcastToTeam);
router.get("/:id/messages", getMessages);
router.post("/:id/messages", sendMessage);
router.patch("/:id/read", markConversationRead);

export default router;

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
} from "../controllers/conversationsController";

const router = Router();

router.use(requireAuth);

router.get("/available-contacts", listAvailableContacts);
router.get("/all", requireRole(Role.OWNER), listAllConversations);
router.get("/", listConversations);
router.post("/", createConversation);
router.get("/:id/messages", getMessages);
router.post("/:id/messages", sendMessage);
router.patch("/:id/read", markConversationRead);

export default router;

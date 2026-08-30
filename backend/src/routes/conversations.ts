import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  listConversations,
  getMessages,
  createConversation,
  sendMessage,
  markConversationRead,
  listAvailableContacts,
} from "../controllers/conversationsController";

const router = Router();

router.use(requireAuth);

router.get("/available-contacts", listAvailableContacts);
router.get("/", listConversations);
router.post("/", createConversation);
router.get("/:id/messages", getMessages);
router.post("/:id/messages", sendMessage);
router.patch("/:id/read", markConversationRead);

export default router;

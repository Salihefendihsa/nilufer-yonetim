import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth";
import {
  listQuotes,
  createQuote,
  updateQuote,
  convertQuote,
  getQuotesSummary,
  getQuoteHistory,
} from "../controllers/quotesController";

const router = Router();

router.post("/", createQuote);

router.get("/summary", requireAuth, requireRole(Role.OWNER, Role.MANAGER), getQuotesSummary);
router.get("/", requireAuth, requireRole(Role.OWNER, Role.MANAGER), listQuotes);
// Yalnizca bu teklife ait denetim kayitlari; /audit-logs OWNER-only kalir.
router.get("/:id/history", requireAuth, requireRole(Role.OWNER, Role.MANAGER), getQuoteHistory);
router.patch("/:id", requireAuth, requireRole(Role.OWNER, Role.MANAGER), updateQuote);
router.post("/:id/convert", requireAuth, requireRole(Role.OWNER, Role.MANAGER), convertQuote);

export default router;

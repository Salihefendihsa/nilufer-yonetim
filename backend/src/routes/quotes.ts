import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth";
import { listQuotes, createQuote, updateQuote, convertQuote } from "../controllers/quotesController";

const router = Router();

router.post("/", createQuote);

router.get("/", requireAuth, requireRole(Role.OWNER), listQuotes);
router.patch("/:id", requireAuth, requireRole(Role.OWNER), updateQuote);
router.post("/:id/convert", requireAuth, requireRole(Role.OWNER), convertQuote);

export default router;

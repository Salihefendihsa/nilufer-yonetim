import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth";
import { listExpenses, createExpense, updateExpense, deleteExpense } from "../controllers/expensesController";

const router = Router();

router.use(requireAuth, requireRole(Role.OWNER, Role.MANAGER));

router.get("/", listExpenses);
router.post("/", createExpense);
router.patch("/:id", updateExpense);
router.delete("/:id", deleteExpense);

export default router;

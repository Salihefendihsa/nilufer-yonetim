import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth";
import { listUsers } from "../controllers/usersController";

const router = Router();

router.get("/", requireAuth, requireRole(Role.OWNER, Role.MANAGER), listUsers);

export default router;

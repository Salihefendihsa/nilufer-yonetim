import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth";
import { createAnnouncement, getActiveAnnouncement, listAnnouncements, deactivateAnnouncement } from "../controllers/announcementsController";

const router = Router();

// Bölüm AK (8. tur): duyuru şeridi — okuma tüm oturumlara, yönetim yalnızca OWNER.
router.use(requireAuth);
router.get("/active", getActiveAnnouncement);
router.get("/", requireRole(Role.OWNER), listAnnouncements);
router.post("/", requireRole(Role.OWNER), createAnnouncement);
router.delete("/:id", requireRole(Role.OWNER), deactivateAnnouncement);

export default router;

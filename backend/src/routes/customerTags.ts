import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth";
import { listCustomerTags, createCustomerTag, updateCustomerTag, deleteCustomerTag } from "../controllers/customerTagsController";

const router = Router();

// Bölüm X (6. tur): müşteri etiketleri — yönetim tanımlar; STAFF listede
// etiketleri görür ama tanım/atama yapamaz.
router.use(requireAuth);
router.get("/", requireRole(Role.OWNER, Role.MANAGER, Role.STAFF), listCustomerTags);
router.post("/", requireRole(Role.OWNER, Role.MANAGER), createCustomerTag);
router.patch("/:id", requireRole(Role.OWNER, Role.MANAGER), updateCustomerTag);
router.delete("/:id", requireRole(Role.OWNER, Role.MANAGER), deleteCustomerTag);

export default router;

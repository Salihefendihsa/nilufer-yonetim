import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole, requireRoleOrPermission } from "../middleware/auth";
import {
  listCustomers,
  getCustomer,
  createCustomer,
  getMyReferral,
  getMyBadges,
  getCustomerActiveWarranties,
  updateCustomer,
  deleteCustomer,
} from "../controllers/customersController";
import { exportCustomersExcel } from "../controllers/exportController";
import { setCustomerTags } from "../controllers/customerTagsController";
import { listCustomerDocuments, uploadCustomerDocument, deleteCustomerDocument } from "../controllers/customerDocumentsController";
import { uploadDocument } from "../lib/upload";

const router = Router();

router.use(requireAuth);

router.get("/export/excel", requireRole(Role.OWNER, Role.MANAGER), exportCustomersExcel);
// Bölüm P (4. tur): müşterinin kendi davet kodu/linki — /:id'den ÖNCE.
router.get("/me/referral", requireRole(Role.CUSTOMER), getMyReferral);
router.get("/me/badges", requireRole(Role.CUSTOMER), getMyBadges);
router.get("/", requireRole(Role.OWNER, Role.MANAGER, Role.STAFF), listCustomers);
router.get("/:id", requireRole(Role.OWNER, Role.MANAGER, Role.STAFF), getCustomer);
router.post("/", requireRole(Role.OWNER, Role.MANAGER), createCustomer);
router.patch("/:id", requireRole(Role.OWNER, Role.MANAGER), updateCustomer);
// Bölüm X (6. tur): müşterinin etiket kümesini tam olarak eşitler.
router.post("/:id/tags", requireRole(Role.OWNER, Role.MANAGER), setCustomerTags);
// Bölüm Y (6. tur): geçerli garantiler (bilgilendirme).
router.get("/:id/active-warranties", requireRole(Role.OWNER, Role.MANAGER), getCustomerActiveWarranties);
// Bölüm AB (6. tur): belge kasası — yükleme JobPhoto ile aynı disk deposu.
router.get("/:id/documents", requireRole(Role.OWNER, Role.MANAGER), listCustomerDocuments);
router.post("/:id/documents", requireRole(Role.OWNER, Role.MANAGER), uploadDocument.single("file"), uploadCustomerDocument);
router.delete("/:id/documents/:docId", requireRole(Role.OWNER, Role.MANAGER), deleteCustomerDocument);
router.delete("/:id", requireRoleOrPermission([Role.MANAGER], "delete_customers"), deleteCustomer);

export default router;

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
import { listCustomerDocuments, uploadCustomerDocument, deleteCustomerDocument, ensureCustomerDocumentTarget } from "../controllers/customerDocumentsController";
import { uploadDocument } from "../lib/upload";
import { createMyDeletionRequest, getMyDeletionRequest } from "../controllers/dataDeletionController";
import { exportMyData } from "../controllers/dataExportController";
import { importCustomersCsv, uploadCsv } from "../controllers/customerImportController";

const router = Router();

router.use(requireAuth);

router.get("/export/excel", requireRole(Role.OWNER, Role.MANAGER), exportCustomersExcel);
// Bölüm P (4. tur): müşterinin kendi davet kodu/linki — /:id'den ÖNCE.
router.get("/me/referral", requireRole(Role.CUSTOMER), getMyReferral);
router.get("/me/badges", requireRole(Role.CUSTOMER), getMyBadges);
// Bölüm AD (7. tur): KVKK veri silme talebi (müşteri kendi adına).
router.post("/me/deletion-request", requireRole(Role.CUSTOMER), createMyDeletionRequest);
router.get("/me/deletion-request", requireRole(Role.CUSTOMER), getMyDeletionRequest);
// Bölüm AJ (8. tur): müşteri kendi verisini JSON indirir (belge META, dosya değil).
router.get("/me/data-export", requireRole(Role.CUSTOMER), exportMyData);
router.get("/", requireRole(Role.OWNER, Role.MANAGER, Role.STAFF), listCustomers);
router.get("/:id", requireRole(Role.OWNER, Role.MANAGER, Role.STAFF), getCustomer);
router.post("/", requireRole(Role.OWNER, Role.MANAGER), createCustomer);
// Bölüm AL (8. tur): CSV toplu içe aktarma — satır bazlı, bellekte, tek transaction değil.
router.post("/import", requireRole(Role.OWNER, Role.MANAGER), uploadCsv.single("file"), importCustomersCsv);
router.patch("/:id", requireRole(Role.OWNER, Role.MANAGER), updateCustomer);
// Bölüm X (6. tur): müşterinin etiket kümesini tam olarak eşitler.
router.post("/:id/tags", requireRole(Role.OWNER, Role.MANAGER), setCustomerTags);
// Bölüm Y (6. tur): geçerli garantiler (bilgilendirme).
router.get("/:id/active-warranties", requireRole(Role.OWNER, Role.MANAGER), getCustomerActiveWarranties);
// Bölüm AB (6. tur): belge kasası — yükleme JobPhoto ile aynı disk deposu.
router.get("/:id/documents", requireRole(Role.OWNER, Role.MANAGER), listCustomerDocuments);
router.post("/:id/documents", requireRole(Role.OWNER, Role.MANAGER), ensureCustomerDocumentTarget, uploadDocument.single("file"), uploadCustomerDocument);
router.delete("/:id/documents/:docId", requireRole(Role.OWNER, Role.MANAGER), deleteCustomerDocument);
router.delete("/:id", requireRoleOrPermission([Role.MANAGER], "delete_customers"), deleteCustomer);

export default router;

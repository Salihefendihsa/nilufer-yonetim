import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth";
import {
  listProducts,
  getLowStockProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  restockProduct,
  listProductMovements,
  getProductForecast,
  adjustProductCount,
  createPurchaseRequest,
  listPurchaseRequests,
  updatePurchaseRequest,
} from "../controllers/productsController";

const router = Router();

router.use(requireAuth);

// STAFF/TEAM_LEAD need read access to pick a product when filing a job report.
router.get("/low-stock", requireRole(Role.OWNER, Role.MANAGER), getLowStockProducts);
router.get("/", requireRole(Role.OWNER, Role.MANAGER, Role.TEAM_LEAD, Role.STAFF), listProducts);
// Satın alma talepleri — sabit yol parçası "/:id" desenlerinden önce tanımlanır.
router.get("/purchase-requests", requireRole(Role.OWNER, Role.MANAGER), listPurchaseRequests);
router.patch("/purchase-requests/:id", requireRole(Role.OWNER, Role.MANAGER), updatePurchaseRequest);
router.post("/", requireRole(Role.OWNER, Role.MANAGER), createProduct);
router.patch("/:id", requireRole(Role.OWNER, Role.MANAGER), updateProduct);
router.delete("/:id", requireRole(Role.OWNER, Role.MANAGER), deleteProduct);
router.post("/:id/restock", requireRole(Role.OWNER, Role.MANAGER), restockProduct);
router.post("/:id/count", requireRole(Role.OWNER, Role.MANAGER), adjustProductCount);
router.get("/:id/movements", requireRole(Role.OWNER, Role.MANAGER), listProductMovements);
// Bölüm W (5. tur): kullanım bazlı tükenme tahmini.
router.get("/:id/forecast", requireRole(Role.OWNER, Role.MANAGER), getProductForecast);
// Ekip lideri yalnızca TALEP AÇABİLİR (Stitch Şef → Bildirimler: "Talep Oluştur").
// Listeleme, mal kabul ve iptal yukarıda OWNER/MANAGER'a kısıtlı KALIR — talebi
// açan kişi kendi talebini sonuçlandıramaz.
router.post(
  "/:id/purchase-requests",
  requireRole(Role.OWNER, Role.MANAGER, Role.TEAM_LEAD),
  createPurchaseRequest
);

export default router;

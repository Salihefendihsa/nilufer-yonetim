import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth";
import {
  clearDemoData,
  getBackup,
  resetUserPassword,
  startImpersonation,
  endImpersonation,
} from "../controllers/adminController";

const router = Router();

router.use(requireAuth);

// impersonate/end, req.user içeriği artık hedef kullanıcıya ait olduğu için
// (impersonation JWT'si) requireRole(OWNER) İLE KORUNAMAZ — yalnızca
// requireAuth + handler içindeki impersonationSessionId kontrolü yeterli.
router.post("/impersonate/end", endImpersonation);

router.use(requireRole(Role.OWNER));

router.post("/clear-demo-data", clearDemoData);
router.get("/backup", getBackup);
router.post("/users/:id/reset-password", resetUserPassword);
router.post("/impersonate", startImpersonation);

export default router;

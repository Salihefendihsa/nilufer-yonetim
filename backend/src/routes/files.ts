import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { serveFile } from "../controllers/filesController";

const router = Router();

// Bölüm AC (7. tur): tüm dosya erişimi kimlik doğrulamalı; yetki kaydın kuralıyla kontrol edilir.
router.use(requireAuth);
router.get("/:type/:id", serveFile);

export default router;

import { Router } from "express";
import { getCalendarByToken } from "../controllers/staffCalendarController";

/**
 * Bölüm AP (9. tur): requireAuth YOK — telefonun takvim uygulaması header
 * gönderemez; `Staff.calendarToken` (tahmin edilemez, yenilenebilir) kimlik
 * doğrulama görevi görür. Bu, "token'sız statik yol açma" yasağının
 * istisnası DEĞİLDİR: yol token'lıdır ve kayıt bazlı doğrulanır.
 */
const router = Router();

router.get("/:token", getCalendarByToken);

export default router;

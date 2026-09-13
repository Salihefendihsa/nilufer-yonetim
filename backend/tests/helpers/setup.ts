import "dotenv/config";

// Testler port'a bağlanmaz ama bazı kütüphaneler (rate limit skip'i vb.)
// NODE_ENV'e bakar.
process.env.NODE_ENV = "test";

// Testler gerçek dış servislere DOKUNMAZ:
// - reCAPTCHA: secret boşken verifyRecaptcha() sessizce geçer (mevcut
//   graceful-degrade davranışı) → web login akışı token'sız test edilebilir.
// - SMTP/Firebase: yapılandırılmamış sayılır → e-posta/push gönderilmez.
// `delete` DEĞİL boş string: @prisma/client import edilirken .env'i yeniden
// yükler ve eksik anahtarları doldurur; var olan (boş) değeri ezmez.
process.env.RECAPTCHA_SECRET_KEY = "";
process.env.SMTP_HOST = "";
process.env.SMTP_USER = "";
process.env.SMTP_PASS = "";
process.env.FIREBASE_SERVICE_ACCOUNT_KEY = "";

// Worker'ın açık Prisma bağlantısı yüzünden takılı kalmaması için.
import { afterAll } from "vitest";
import { prisma } from "../../src/lib/prisma";
afterAll(async () => {
  await prisma.$disconnect();
});

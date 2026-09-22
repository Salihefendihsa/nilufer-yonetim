/**
 * Sentry (ve .env) başlatma — `index.ts`'in İLK import'u olmalıdır. Sentry'nin
 * http/express enstrümantasyonu, `app.ts` üzerinden `express`/`http`
 * yüklenmeden önce `Sentry.init` çağrılmış olmasını gerektirir; CommonJS'te
 * import sırası korunduğu için bu dosyayı ilk sıraya koymak yeterlidir.
 */
import "dotenv/config";
import { initErrorReporting } from "./lib/errorReporting";

initErrorReporting();

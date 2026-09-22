import * as Sentry from "@sentry/node";

/**
 * Hata izleme (opsiyonel) — SENTRY_DSN tanımlıysa her beklenmeyen hata
 * Sentry'ye gönderilir; tanımlı değilse tamamen no-op (SMTP/reCAPTCHA ile
 * aynı "yapılandırılmadıysa sessizce atla" deseni). `initErrorReporting()`
 * uygulama açılışında, DİĞER TÜM MODÜLLERDEN ÖNCE bir kez çağrılır
 * (bkz. src/instrument.ts) — Sentry'nin http/express enstrümantasyonu
 * `express`/`http` require edilmeden önce init edilmiş olmayı gerektirir.
 */
let initialized = false;

/**
 * URL'de taşınan gizli değerleri maskeler. Tek token taşıyan yol Bölüm AP
 * takvim aboneliğidir (`GET /calendar/<token>.ics`, requireAuth yok) — o
 * handler'da beklenmeyen bir hata olursa token sunucu loguna/Sentry'ye
 * düşmesin. Hem pino (errorHandler) hem Sentry `beforeSend` bunu kullanır.
 */
export function redactSensitivePath(url: string): string {
  return url.replace(/(\/calendar\/)[^/?#.]+/g, "$1[REDACTED]");
}

export function initErrorReporting(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    tracesSampleRate: 0,
    beforeSend(event) {
      if (event.request?.url) event.request.url = redactSensitivePath(event.request.url);
      // Sunucu tarafında gövde/cookie zaten varsayılan olarak toplanmıyor
      // (sendDefaultPii kapalı); yine de olası bir sızıntıya karşı düşür.
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
      }
      return event;
    },
  });
  initialized = true;
}

export function captureException(err: unknown): void {
  if (!initialized) return;
  Sentry.captureException(err);
}

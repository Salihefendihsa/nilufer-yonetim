import * as Sentry from "@sentry/node";

/**
 * Hata izleme (opsiyonel) — SENTRY_DSN tanımlıysa her beklenmeyen hata
 * Sentry'ye gönderilir; tanımlı değilse tamamen no-op (SMTP/reCAPTCHA ile
 * aynı "yapılandırılmadıysa sessizce atla" deseni). `initErrorReporting()`
 * uygulama açılışında bir kez çağrılır.
 */
let initialized = false;

export function initErrorReporting(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({ dsn, tracesSampleRate: 0 });
  initialized = true;
}

export function captureException(err: unknown): void {
  if (!initialized) return;
  Sentry.captureException(err);
}

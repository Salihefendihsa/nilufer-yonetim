const VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";
const SCORE_THRESHOLD = 0.5;

interface SiteVerifyResponse {
  success: boolean;
  score?: number;
  action?: string;
  "error-codes"?: string[];
}

export function isRecaptchaConfigured(): boolean {
  return Boolean(process.env.RECAPTCHA_SECRET_KEY);
}

/**
 * Verifies a reCAPTCHA v3 token against Google's siteverify endpoint.
 * Not configured (no secret key) → passes silently, same graceful-degrade
 * pattern as SMTP/WhatsApp elsewhere in this codebase.
 * Configured but Google is unreachable → also passes, so a third-party outage
 * never locks users out of login; an actual "success:false" or low score,
 * however, is a real rejection.
 */
export async function verifyRecaptcha(token: string | undefined, action: string): Promise<boolean> {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;

  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
    });
    const data = (await res.json()) as SiteVerifyResponse;

    if (!data.success) return false;
    if (typeof data.score === "number" && data.score < SCORE_THRESHOLD) return false;
    if (data.action && data.action !== action) return false;

    return true;
  } catch (err) {
    console.error("reCAPTCHA doğrulama isteği başarısız, geçiş serbest bırakıldı:", err);
    return true;
  }
}

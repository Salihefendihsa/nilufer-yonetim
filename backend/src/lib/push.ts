import { initializeApp, cert, type App } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

let app: App | null | undefined;

/** Pure check, no side effects — safe to call from request handlers. */
export function isPushConfigured(): boolean {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
}

/**
 * `FIREBASE_SERVICE_ACCOUNT_KEY` bir servis hesabı JSON'ının TEK SATIRLIK
 * (veya base64) hâli olarak beklenir — Firebase Console → Proje Ayarları →
 * Hizmet Hesapları → "Yeni Özel Anahtar Oluştur" ile indirilen dosyanın
 * içeriği. Adımlar için PROJECT_HANDOFF_TR.md'ye bakın.
 */
function getApp(): App | null {
  if (app !== undefined) return app;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    console.log("Firebase yapılandırılmadı, push bildirimleri atlanıyor.");
    app = null;
    return app;
  }

  try {
    const decoded = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    const serviceAccount = JSON.parse(decoded);
    app = initializeApp({ credential: cert(serviceAccount) });
  } catch (err) {
    console.error("Firebase başlatılamadı, push bildirimleri devre dışı:", err);
    app = null;
  }

  return app;
}

/**
 * Bir kullanıcının kayıtlı cihazlarına push bildirimi gönderir. Firebase
 * yapılandırılmamışsa veya kullanıcının hiç fcmToken'ı yoksa sessizce
 * hiçbir şey yapmaz — sendEmail'deki aynı "graceful no-op" prensibi.
 * Geçersiz/süresi dolmuş token'lar (UNREGISTERED/INVALID_ARGUMENT)
 * çağıran tarafından DB'den temizlenebilsin diye geri döndürülür.
 */
export async function sendPushToTokens(
  tokens: string[],
  title: string,
  body?: string,
  data?: Record<string, string>
): Promise<{ invalidTokens: string[] }> {
  const firebaseApp = getApp();
  if (!firebaseApp || tokens.length === 0) return { invalidTokens: [] };

  try {
    const messaging = getMessaging(firebaseApp);
    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: { title, body },
      data,
    });

    const invalidTokens: string[] = [];
    response.responses.forEach((r, i) => {
      if (
        !r.success &&
        (r.error?.code === "messaging/registration-token-not-registered" ||
          r.error?.code === "messaging/invalid-argument")
      ) {
        invalidTokens.push(tokens[i]);
      }
    });
    return { invalidTokens };
  } catch (err) {
    console.error("Push bildirimi gönderilemedi:", err);
    return { invalidTokens: [] };
  }
}

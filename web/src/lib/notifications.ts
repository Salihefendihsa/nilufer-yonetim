import { AlertTriangle, MessageCircle, Wallet, Wrench, type LucideIcon } from "lucide-react";

/**
 * Bildirim kategorileri tek yerde tanımlı: hem Header'daki çekmece hem de
 * /bildirimler sayfası aynı eşlemeyi kullanır, böylece bir bildirimin ikonu ve
 * rengi nerede görünürse görünsün aynı kalır.
 *
 * Backend bildirimlerde tip alanı tutmuyor; kategori başlıktan çıkarılıyor.
 */
export type NotificationCategory = "isler" | "odemeler" | "mesajlar" | "uyarilar";

export interface NotificationCategoryStyle {
  label: string;
  icon: LucideIcon;
  /** Liste öğesindeki ikon rozeti ve sol kenar çubuğu için Tailwind sınıfları. */
  iconClass: string;
  barClass: string;
  /** Grafik/şerit gibi Tailwind alamayan yerler için ham renk. */
  color: string;
}

export const NOTIFICATION_CATEGORIES: Record<NotificationCategory, NotificationCategoryStyle> = {
  isler: {
    label: "İşler",
    icon: Wrench,
    iconClass: "bg-primary-50 text-primary-600 ring-primary-100",
    barClass: "bg-primary-500",
    color: "#3D8A4E",
  },
  odemeler: {
    label: "Ödemeler",
    icon: Wallet,
    iconClass: "bg-info-50 text-info-500 ring-info-100",
    barClass: "bg-info-500",
    color: "#1F6FA8",
  },
  mesajlar: {
    label: "Mesajlar",
    icon: MessageCircle,
    iconClass: "bg-success-50 text-success-500 ring-success-100",
    barClass: "bg-success-500",
    color: "#15803D",
  },
  uyarilar: {
    label: "Uyarılar",
    icon: AlertTriangle,
    iconClass: "bg-warning-50 text-warning-500 ring-warning-100",
    barClass: "bg-warning-500",
    color: "#B57F13",
  },
};

export const NOTIFICATION_CATEGORY_KEYS = Object.keys(NOTIFICATION_CATEGORIES) as NotificationCategory[];

/**
 * Arayüz kategorisi -> backend kategori anahtarı
 * (backend/src/lib/notificationCategories.ts). Sunucu tarafı `Notification.type`
 * üzerinden sınıflandırır; başlık metnine bakan `categorizeNotification`
 * yalnızca `type` alanı boş olan ESKİ kayıtlar için yedek kalır.
 */
export const CATEGORY_API_KEY: Record<NotificationCategory, string> = {
  isler: "job",
  odemeler: "payment",
  mesajlar: "message",
  uyarilar: "alert",
};

export function categorizeNotification(title: string): NotificationCategory {
  const t = title.toLowerCase();
  if (t.includes("mesaj")) return "mesajlar";
  if (t.includes("tahsilat") || t.includes("ödeme") || t.includes("avans")) return "odemeler";
  if (t.includes("iş")) return "isler";
  return "uyarilar";
}

/**
 * Bildirimdeki relatedType/relatedId'yi ilgili ekrana yönlendiren bir yola
 * çevirir (backend/src/lib/notify.ts:NotificationLink ile birebir). Hedef
 * sayfa kendi API çağrısını kendi yetki/kapsam kurallarıyla yapar — burada
 * ekstra bir erişim kontrolü GEREKMEZ, mevcut kontrol korunur.
 *
 * Not: Şu an ilgili LİSTE ekranına yönlendirir (ör. /isler), kaydı otomatik
 * seçip vurgulamaz — bu daha ince bir iyileştirme olarak açık bırakılmıştır.
 */
export function getNotificationHref(n: { relatedType: string | null; relatedId: string | null }): string | null {
  if (!n.relatedType) return null;
  switch (n.relatedType) {
    case "Job":
      return "/isler";
    case "Product":
      return "/stok";
    case "AdvanceRequest":
      return "/bekleyen-onaylar";
    case "QuoteRequest":
      return "/bekleyen-onaylar";
    case "Conversation":
      return "/mesajlar";
    default:
      return null;
  }
}

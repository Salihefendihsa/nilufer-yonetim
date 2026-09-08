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

export function categorizeNotification(title: string): NotificationCategory {
  const t = title.toLowerCase();
  if (t.includes("mesaj")) return "mesajlar";
  if (t.includes("tahsilat") || t.includes("ödeme") || t.includes("avans")) return "odemeler";
  if (t.includes("iş")) return "isler";
  return "uyarilar";
}

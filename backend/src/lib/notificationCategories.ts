/**
 * Bildirim türlerinin arayüzdeki kategori sekmelerine eşlenmesi
 * (Stitch Şef → Bildirimler: Tümü / İş / Ödeme / Mesaj / Uyarı).
 *
 * `Notification.type` serbest bir string olduğu için eşleme burada TEK yerde
 * tutulur; yeni bir tür eklendiğinde yalnızca bu tablo güncellenir. Hiçbir
 * kategoriye girmeyen türler özet ucunda "other" altında toplanır — sayı
 * kaybolmaz.
 */
export const NOTIFICATION_CATEGORY_TYPES = {
  job: ["job_assigned", "job_completed", "job_report_pending", "job_report_approved", "appointment_request_scheduled"],
  payment: ["advance_request", "payment_received"],
  message: ["new_message", "team_broadcast"],
  alert: ["low_stock", "stock_purchase_request", "quote_request", "appointment_request", "appointment_request_declined", "referral_converted", "data_deletion_request", "data_deletion_rejected", "low_satisfaction"],
} as const;

export type NotificationCategory = keyof typeof NOTIFICATION_CATEGORY_TYPES;

export const NOTIFICATION_CATEGORIES = Object.keys(
  NOTIFICATION_CATEGORY_TYPES
) as NotificationCategory[];

export function typesForCategory(category: NotificationCategory): string[] {
  return [...NOTIFICATION_CATEGORY_TYPES[category]];
}

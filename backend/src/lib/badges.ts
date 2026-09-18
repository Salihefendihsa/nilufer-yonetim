/**
 * Bölüm Q (4. tur): Yalnızca GÖRSEL rozetler — backend'de mevcut sayılardan
 * türetilen computed alanlar, yeni model yok, iş kuralı (indirim/prim) yok.
 */

/** Tamamlanmış iş sayısı bu eşiğe ulaşan müşteri "Sadık Müşteri" rozeti alır. */
export const LOYAL_CUSTOMER_THRESHOLD = 5;

export function isLoyalCustomer(completedJobCount: number): boolean {
  return completedJobCount >= LOYAL_CUSTOMER_THRESHOLD;
}

/**
 * Personel başarı kademesi — değerlendirme ortalaması (1–20 ölçeği,
 * Evaluation.averageScore) üzerinden: ≥18 Altın, ≥15 Gümüş, ≥12 Bronz.
 */
export type AchievementTier = "GOLD" | "SILVER" | "BRONZE";

export const ACHIEVEMENT_TIERS: { tier: AchievementTier; min: number; label: string }[] = [
  { tier: "GOLD", min: 18, label: "Altın" },
  { tier: "SILVER", min: 15, label: "Gümüş" },
  { tier: "BRONZE", min: 12, label: "Bronz" },
];

export function achievementTier(averageScore: number | null | undefined): AchievementTier | null {
  if (averageScore === null || averageScore === undefined || Number.isNaN(averageScore)) return null;
  for (const t of ACHIEVEMENT_TIERS) if (averageScore >= t.min) return t.tier;
  return null;
}

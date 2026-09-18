"use client";

import { Award, Heart } from "lucide-react";
import type { AchievementTier } from "@/lib/types";

/**
 * Bölüm Q (4. tur): yalnızca GÖRSEL rozetler — değerler backend'de hesaplanır
 * (Customer.isLoyal, leaderboard.achievementTier / evaluation.achievementTier).
 */

export function LoyalCustomerBadge({ className = "" }: { className?: string }) {
  return (
    <span
      title="5 veya daha fazla tamamlanmış hizmet"
      className={`inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-2xs font-semibold text-primary-700 ring-1 ring-primary-100 ${className}`}
    >
      <Heart size={11} strokeWidth={2.25} />
      Sadık Müşteri
    </span>
  );
}

export const ACHIEVEMENT_TIER_META: Record<AchievementTier, { label: string; className: string; hint: string }> = {
  GOLD: { label: "Altın", className: "bg-warning-50 text-warning-600 ring-warning-100", hint: "Değerlendirme ortalaması ≥ 18" },
  SILVER: { label: "Gümüş", className: "bg-surface-muted text-text-secondary ring-border", hint: "Değerlendirme ortalaması ≥ 15" },
  BRONZE: { label: "Bronz", className: "bg-danger-50 text-danger-500 ring-danger-100", hint: "Değerlendirme ortalaması ≥ 12" },
};

export function AchievementBadge({ tier, className = "" }: { tier: AchievementTier | null | undefined; className?: string }) {
  if (!tier) return null;
  const meta = ACHIEVEMENT_TIER_META[tier];
  return (
    <span title={meta.hint} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-semibold ring-1 ${meta.className} ${className}`}>
      <Award size={11} strokeWidth={2.25} />
      {meta.label}
    </span>
  );
}

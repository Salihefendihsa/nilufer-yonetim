"use client";

import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from "lucide-react";

export interface StatBadge {
  label: string;
  tone: "critical" | "live";
}

export interface StatTrend {
  /** Yüzde değişim. Pozitif = artış, negatif = azalış, 0 = değişim yok. */
  value: number;
  /** Karşılaştırma etiketi, örn. "geçen aya göre". */
  label?: string;
  /** Artışın kötü olduğu metrikler (iptal, gecikmiş ödeme) için ters çevirir. */
  invert?: boolean;
}

export type StatAccent = "green" | "red" | "gold" | "blue" | "neutral";

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  accent?: StatAccent;
  badge?: StatBadge;
  mono?: boolean;
  trend?: StatTrend;
  /** Kartın altına ince bir doluluk çubuğu ekler (0–100). */
  progress?: number;
  /** Değerin altına ek açıklama satırı. */
  hint?: string;
}

interface AccentStyle {
  iconBg: string;
  iconText: string;
  bar: string;
  ring: string;
}

// Sınıflar Tailwind JIT tarafından taranabilmesi için birebir string olmalı.
const ACCENT_STYLES: Record<StatAccent, AccentStyle> = {
  green: { iconBg: "bg-primary-50", iconText: "text-primary-600", bar: "bg-primary-500", ring: "ring-primary-100" },
  red: { iconBg: "bg-danger-50", iconText: "text-danger-500", bar: "bg-danger-500", ring: "ring-danger-100" },
  gold: { iconBg: "bg-warning-50", iconText: "text-warning-500", bar: "bg-warning-500", ring: "ring-warning-100" },
  blue: { iconBg: "bg-info-50", iconText: "text-info-500", bar: "bg-info-500", ring: "ring-info-100" },
  neutral: { iconBg: "bg-surface-subtle", iconText: "text-text-secondary", bar: "bg-neutral-400", ring: "ring-border" },
};

function TrendPill({ trend }: { trend: StatTrend }) {
  const rounded = Math.round(trend.value * 10) / 10;
  const flat = rounded === 0;
  const rising = rounded > 0;
  // `invert`, artışın olumsuz olduğu metriklerde rengi ters çevirir; ok yönü daima gerçek yönü gösterir.
  const positive = trend.invert ? !rising : rising;

  const Icon = flat ? Minus : rising ? ArrowUpRight : ArrowDownRight;
  const tone = flat
    ? "bg-surface-subtle text-text-faint"
    : positive
      ? "bg-primary-50 text-primary-600"
      : "bg-danger-50 text-danger-500";

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-semibold ${tone}`}>
      <Icon size={12} strokeWidth={2.25} />
      {flat ? "0%" : `${rising ? "+" : ""}${rounded}%`}
    </span>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  accent = "green",
  badge,
  mono = false,
  trend,
  progress,
  hint,
}: StatCardProps) {
  const style = ACCENT_STYLES[accent];
  const isCritical = badge?.tone === "critical";

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className="group relative flex flex-col gap-4 rounded-2xl border border-border bg-surface-card p-5 shadow-card transition-shadow hover:shadow-cardHover"
    >
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ring-1 ${style.iconBg} ${style.iconText} ${style.ring}`}>
          <Icon size={19} strokeWidth={1.75} />
        </div>

        {badge ? (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-2xs font-semibold uppercase tracking-wide ${
              isCritical ? "bg-danger-50 text-danger-500" : "bg-primary-50 text-primary-600"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${isCritical ? "animate-pulse bg-danger-500" : "bg-primary-500"}`} />
            {badge.label}
          </span>
        ) : trend ? (
          <TrendPill trend={trend} />
        ) : null}
      </div>

      <div>
        <p className={`text-3xl font-bold tracking-tight text-text-primary ${mono ? "font-mono" : ""}`}>{value}</p>
        <p className="mt-1 text-sm text-text-secondary">{label}</p>
        {(hint || (trend && trend.label)) && (
          <p className="mt-1 text-xs text-text-faint">{hint ?? trend?.label}</p>
        )}
      </div>

      {progress !== undefined && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
          <div
            className={`h-full origin-left rounded-full ${style.bar} animate-grow-bar`}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
    </motion.div>
  );
}

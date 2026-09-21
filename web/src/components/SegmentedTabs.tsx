"use client";

import type { LucideIcon } from "lucide-react";

export interface SegmentedTab<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
  /** Sağda küçük sayı rozeti (ör. bekleyen talep adedi). */
  badge?: number;
}

/**
 * Sayfa içi sekme/segment seçici — para ve performans sayfalarındaki pill
 * desenini tek bileşene alır (tasarım turu #4: Ayarlar 4 sekme). Sekmeler
 * `role="tablist"` ile erişilebilir; dar ekranda yatay kaydırılır.
 */
export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
  ariaLabel,
}: {
  tabs: SegmentedTab<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-2xl border border-border bg-surface-card p-1 shadow-card"
    >
      {tabs.map((tab) => {
        const active = tab.value === value;
        const Icon = tab.icon;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition ${
              active ? "bg-primary-600 text-white shadow-card" : "text-text-secondary hover:bg-surface-subtle"
            }`}
          >
            {Icon && <Icon size={14} strokeWidth={1.75} />}
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span
                className={`ml-0.5 rounded-full px-1.5 py-0.5 text-2xs font-semibold tabular-nums ${
                  active ? "bg-white/20 text-white" : "bg-danger-50 text-danger-500"
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

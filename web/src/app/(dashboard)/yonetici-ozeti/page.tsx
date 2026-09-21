"use client";

import { useCallback, useEffect, useState } from "react";
import { SectionTitle } from "@/components/SectionTitle";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowUpRight,
  Briefcase,
  HardHat,
  LayoutDashboard,
  RefreshCw,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { RequireRole } from "@/components/RequireRole";
import { PageHeader } from "@/components/PageHeader";
import { AnimatedStatValue } from "@/components/AnimatedStatValue";
import { api, ApiError } from "@/lib/api";
import { currencyFormatter } from "@/lib/format";
import type { ExecutiveKpi, ExecutiveRange, ExecutiveSummary } from "@/lib/types";

/**
 * Bölüm G (2. tur): Yönetici Özet Paneli.
 *
 * Tek endpoint (/analytics/executive-summary) tüm KPI'ları bölüm bölüm
 * getirir; her kart backend'in verdiği `drillDown.href` hedefine bir
 * <Link> — sayfa kendi başına hiçbir hesaplama yapmaz, yalnızca gösterir.
 */

const RANGE_OPTIONS: { value: ExecutiveRange; label: string }[] = [
  { value: "today", label: "Bugün" },
  { value: "week", label: "Bu Hafta" },
  { value: "month", label: "Bu Ay" },
];

interface SectionMeta {
  key: keyof ExecutiveSummary["sections"];
  title: string;
  icon: LucideIcon;
}

const SECTIONS: SectionMeta[] = [
  { key: "alerts", title: "Uyarılar", icon: AlertTriangle },
  { key: "finance", title: "Finans", icon: Wallet },
  { key: "operations", title: "Operasyon", icon: Briefcase },
  { key: "staff", title: "Personel", icon: HardHat },
  { key: "customers", title: "Müşteri", icon: Users },
];

// Sınıflar Tailwind JIT tarafından taranabilmesi için birebir string olmalı.
const TONE_STYLES: Record<ExecutiveKpi["tone"], { value: string; dot: string; ring: string }> = {
  neutral: { value: "text-text-primary", dot: "bg-neutral-400", ring: "hover:ring-border" },
  success: { value: "text-primary-600", dot: "bg-primary-500", ring: "hover:ring-primary-100" },
  warning: { value: "text-warning-600", dot: "bg-warning-500", ring: "hover:ring-warning-100" },
  danger: { value: "text-danger-500", dot: "bg-danger-500", ring: "hover:ring-danger-100" },
  info: { value: "text-info-600", dot: "bg-info-500", ring: "hover:ring-info-100" },
};

function formatKpiValue(kpi: Pick<ExecutiveKpi, "value" | "format">): string {
  if (kpi.value === null || kpi.value === undefined) return "—";
  switch (kpi.format) {
    case "currency":
      return currencyFormatter.format(kpi.value);
    case "percent":
      return `%${kpi.value.toFixed(1)}`;
    case "score":
      return kpi.value.toFixed(1);
    default:
      return kpi.value.toLocaleString("tr-TR");
  }
}

function KpiCard({ kpi }: { kpi: ExecutiveKpi }) {
  const style = TONE_STYLES[kpi.tone];
  return (
    <Link href={kpi.drillDown.href} className="block" aria-label={`${kpi.label} — detaya git`}>
      <motion.div
        whileHover={{ y: -2 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        className={`group flex h-full flex-col justify-between gap-3 rounded-2xl border border-border bg-surface-card p-5 shadow-card ring-1 ring-transparent transition-shadow hover:shadow-cardHover ${style.ring}`}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm text-text-secondary">{kpi.label}</p>
          <span className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${style.dot} ${kpi.tone === "danger" ? "animate-pulse" : ""}`} />
            <ArrowUpRight
              size={14}
              className="text-text-faint opacity-0 transition-opacity group-hover:opacity-100"
            />
          </span>
        </div>
        <div>
          <p className={`text-2xl font-bold tracking-tight ${style.value}`}>
            <AnimatedStatValue value={formatKpiValue(kpi)} />
          </p>
          {kpi.hint && <p className="mt-1 text-xs text-text-faint">{kpi.hint}</p>}
        </div>
      </motion.div>
    </Link>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-28 rounded-2xl border border-border bg-surface-card p-5 shadow-card">
          <div className="skeleton h-4 w-24" />
          <div className="skeleton mt-4 h-8 w-20" />
        </div>
      ))}
    </div>
  );
}

export default function ExecutiveSummaryPage() {
  return (
    <RequireRole roles={["OWNER", "MANAGER"]}>
      <ExecutiveSummaryContent />
    </RequireRole>
  );
}

function ExecutiveSummaryContent() {
  const [range, setRange] = useState<ExecutiveRange>("today");
  const [summary, setSummary] = useState<ExecutiveSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<ExecutiveSummary>(`/analytics/executive-summary?range=${range}`);
      setSummary(res);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Yönetici özeti yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Yönetici Özeti"
        description="Tüm kritik göstergeler tek ekranda — bir karta tıklayarak detaya inin."
        icon={LayoutDashboard}
        actions={
          <>
            <div className="flex rounded-xl bg-surface-subtle p-1">
              {RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRange(opt.value)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    range === opt.value ? "bg-primary-600 text-white shadow-card" : "text-text-secondary hover:bg-surface-card"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-card px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-subtle disabled:opacity-60"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
              Yenile
            </button>
          </>
        }
      />

      {error && (
        <div className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</div>
      )}

      {SECTIONS.map((section) => {
        const Icon = section.icon;
        const kpis = summary?.sections[section.key] ?? [];
        return (
          <section key={section.key} className="space-y-3">
            <SectionTitle size="sm" tone="eyebrow" className="flex items-center gap-2">
              <Icon size={16} strokeWidth={1.75} />
              {section.title}
            </SectionTitle>
            {loading && !summary ? (
              <SkeletonGrid />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {kpis.map((kpi) => (
                  <KpiCard key={kpi.key} kpi={kpi} />
                ))}
              </div>
            )}
          </section>
        );
      })}

      {summary && (
        <p className="text-xs text-text-faint">
          Son güncelleme: {new Date(summary.generatedAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
        </p>
      )}
    </div>
  );
}

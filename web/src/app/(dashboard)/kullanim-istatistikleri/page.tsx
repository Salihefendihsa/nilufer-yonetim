"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { chartPalette } from "@/lib/chartPalette";
import { Activity, Clock3, Timer, TrendingUp, UserCheck, Users2 } from "lucide-react";
import { RequireRole } from "@/components/RequireRole";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { ChartCard, DonutChart, RankBars, TrendChart } from "@/components/ChartCard";
import { Table, type Column } from "@/components/Table";
import { api, ApiError } from "@/lib/api";
import { ROLE_LABELS } from "@/lib/auth";
import type { SessionReportEntry } from "@/lib/types";

const DAY_OPTIONS = [7, 30, 90];

/** Rol renkleri — donut ve rozetlerde aynı eşleme kullanılır. */
const ROLE_COLORS: Record<string, string> = {
  OWNER: chartPalette.primary,
  MANAGER: chartPalette.primaryMid,
  TEAM_LEAD: chartPalette.primaryLight,
  STAFF: chartPalette.primaryFaint,
  CUSTOMER: chartPalette.info,
};

/** Trend grafiğinde gösterilecek gün sayısı üst sınırı (90 günde günlük çizgi okunmaz olur). */
const MAX_TREND_DAYS = 30;

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours === 0) return `${mins} dk`;
  if (mins === 0) return `${hours} sa`;
  return `${hours} sa ${mins} dk`;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function UsageStatsPage() {
  return (
    <RequireRole roles={["OWNER"]}>
      <UsageStatsContent />
    </RequireRole>
  );
}

function UsageStatsContent() {
  const [days, setDays] = useState(30);
  const [rows, setRows] = useState<SessionReportEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: SessionReportEntry[] }>(`/sessions/report?days=${days}`);
      setRows(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kullanım istatistikleri yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  // Tüm görselleştirmeler tek yanıttan türetilir; ek istek yapılmaz.
  const stats = useMemo(() => {
    const totalSessions = rows.reduce((sum, r) => sum + r.totalSessions, 0);
    const weightedMinutes = rows.reduce((sum, r) => sum + r.averageDurationMinutes * r.totalSessions, 0);
    const avgDuration = totalSessions > 0 ? weightedMinutes / totalSessions : 0;

    // "Aktif" = son 7 gün içinde giriş yapmış kullanıcı.
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const activeUsers = rows.filter((r) => new Date(r.lastLoginAt).getTime() >= weekAgo).length;

    const busiest = rows.reduce<SessionReportEntry | null>(
      (best, r) => (best === null || r.totalSessions > best.totalSessions ? r : best),
      null
    );

    return { totalUsers: rows.length, totalSessions, avgDuration, activeUsers, busiest };
  }, [rows]);

  /**
   * Kullanım trendi: kullanıcıların son giriş tarihleri güne göre toplanır.
   * API zaman serisi dönmediği için gösterilen şey "o gün en son giriş yapmış
   * kullanıcı sayısı" — başlıkta da bu şekilde adlandırıldı.
   */
  const trend = useMemo(() => {
    const span = Math.min(days, MAX_TREND_DAYS);
    const buckets = new Map<string, number>();

    for (let i = span - 1; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      buckets.set(d.toISOString().slice(0, 10), 0);
    }

    for (const row of rows) {
      const key = new Date(row.lastLoginAt).toISOString().slice(0, 10);
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }

    return Array.from(buckets.entries()).map(([iso, count]) => ({
      label: new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "short" }),
      count,
    }));
  }, [rows, days]);

  const roleSlices = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows) counts.set(row.role, (counts.get(row.role) ?? 0) + 1);
    return Array.from(counts.entries()).map(([role, value]) => ({
      name: ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role,
      value,
      color: ROLE_COLORS[role] ?? chartPalette.neutralSoft,
    }));
  }, [rows]);

  const topUsers = useMemo(
    () =>
      rows
        .slice()
        .sort((a, b) => b.totalSessions - a.totalSessions)
        .slice(0, 8)
        .map((r) => ({ label: r.fullName, value: r.totalSessions, meta: `${r.totalSessions} oturum` })),
    [rows]
  );

  const columns: Column<SessionReportEntry>[] = [
    {
      header: "Kullanıcı",
      isPrimary: true,
      avatarLabel: (row) => row.fullName,
      accessor: (row) => row.fullName,
    },
    {
      header: "Rol",
      accessor: (row) => (
        <span
          className="inline-flex items-center gap-1.5 rounded-full bg-surface-subtle px-2.5 py-1 text-xs font-medium text-text-secondary"
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: ROLE_COLORS[row.role] ?? chartPalette.neutralSoft }} />
          {ROLE_LABELS[row.role as keyof typeof ROLE_LABELS] ?? row.role}
        </span>
      ),
    },
    {
      header: "Toplam Oturum",
      accessor: (row) => (
        <span className="inline-flex items-center gap-2">
          <span className="font-mono font-semibold text-text-primary">{row.totalSessions}</span>
          <span className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-muted">
            <span
              className="block h-full rounded-full bg-primary-500"
              style={{ width: `${(row.totalSessions / Math.max(1, stats.busiest?.totalSessions ?? 1)) * 100}%` }}
            />
          </span>
        </span>
      ),
    },
    {
      header: "Ortalama Süre",
      accessor: (row) => (
        <span className="font-mono">
          {row.isApproximate && <span className="text-text-faint">~</span>}
          {formatDuration(row.averageDurationMinutes)}
        </span>
      ),
    },
    { header: "Son Giriş", accessor: (row) => formatDateTime(row.lastLoginAt) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Timer}
        title="Kullanım İstatistikleri"
        description="Kullanıcıların sistemde geçirdiği süreler. ~ işaretli değerler kesin çıkış zamanı bilinmediği için yaklaşıktır."
        actions={
          <div className="flex gap-1 rounded-2xl border border-border bg-surface-card p-1 shadow-card">
            {DAY_OPTIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={`rounded-xl px-3.5 py-2 text-sm font-medium transition ${
                  days === d ? "bg-primary-600 text-white shadow-card" : "text-text-secondary hover:bg-surface-subtle"
                }`}
              >
                Son {d} Gün
              </button>
            ))}
          </div>
        }
      />

      {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

      {/* [Özet kartlar] */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Toplam kullanıcı" value={loading ? "—" : String(stats.totalUsers)} icon={Users2} mono />
        <StatCard
          label="Toplam oturum"
          value={loading ? "—" : String(stats.totalSessions)}
          icon={Activity}
          accent="blue"
          mono
          hint={stats.totalUsers > 0 ? `Kişi başı ${(stats.totalSessions / stats.totalUsers).toFixed(1)}` : undefined}
        />
        <StatCard
          label="Son 7 günde aktif"
          value={loading ? "—" : String(stats.activeUsers)}
          icon={UserCheck}
          mono
          progress={stats.totalUsers > 0 ? (stats.activeUsers / stats.totalUsers) * 100 : 0}
          hint={`%${stats.totalUsers > 0 ? Math.round((stats.activeUsers / stats.totalUsers) * 100) : 0} aktif`}
        />
        <StatCard
          label="Ortalama oturum süresi"
          value={loading ? "—" : formatDuration(stats.avgDuration)}
          icon={Clock3}
          accent="gold"
          mono
          hint={stats.busiest ? `En aktif: ${stats.busiest.fullName}` : undefined}
        />
      </div>

      {/* [Grafikler] */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard
          title="Kullanım Trendi"
          description={`Son ${Math.min(days, MAX_TREND_DAYS)} günde en son giriş yapan kullanıcı sayısı`}
          icon={TrendingUp}
          height={240}
          className="lg:col-span-2"
        >
          <TrendChart
            data={trend}
            xKey="label"
            series={[{ key: "count", name: "Kullanıcı" }]}
            area
            loading={loading} emptyLabel="Veri yok"
          />
        </ChartCard>

        <ChartCard title="Rol Dağılımı" description="Oturum açan kullanıcıların rolleri" icon={Users2} height={240}>
          <DonutChart
            data={roleSlices}
            centerValue={loading ? "—" : String(stats.totalUsers)}
            centerLabel="kullanıcı"
            loading={loading} emptyLabel="Veri yok"
          />
        </ChartCard>

        <ChartCard
          title="En Çok Oturum Açanlar"
          description="Seçili aralıktaki oturum sayısına göre"
          icon={Activity}
          height={220}
          className="lg:col-span-3"
        >
          <RankBars rows={topUsers} loading={loading} emptyLabel="Oturum kaydı yok" />
        </ChartCard>
      </div>

      {/* [Detaylı tablo] */}
      <Table
        columns={columns}
        data={rows}
        keyField={(row) => row.userId}
        loading={loading}
        emptyState={<EmptyState icon={Timer} title="Bu aralıkta oturum kaydı yok" />}
      />
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { Trophy, Target, Star, Users2, Award } from "lucide-react";
import { RequireRole } from "@/components/RequireRole";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { ChartCard, RankBars, SimpleBarChart } from "@/components/ChartCard";
import { Table, type Column } from "@/components/Table";
import { api, ApiError } from "@/lib/api";
import type { StaffLeaderboardEntry } from "@/lib/types";

const MEDALS = ["🥇", "🥈", "🥉"];
const PODIUM_TONES = [
  "border-warning-100 bg-warning-50",
  "border-border bg-surface-subtle",
  "border-primary-100 bg-primary-50",
];

export default function PerformancePage() {
  return (
    <RequireRole roles={["OWNER", "MANAGER", "TEAM_LEAD"]}>
      <PerformancePageContent />
    </RequireRole>
  );
}

function PerformancePageContent() {
  const [entries, setEntries] = useState<StaffLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .get<{ data: StaffLeaderboardEntry[] }>("/staff/leaderboard")
      .then((res) => setEntries(res.data))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Liderlik tablosu yüklenemedi"))
      .finally(() => setLoading(false));
  }, []);

  const topThree = entries.slice(0, 3);

  // Özet metrikler tek listeden türetiliyor — ek API çağrısı yok.
  const stats = useMemo(() => {
    const totalJobs = entries.reduce((sum, e) => sum + e.completedJobsThisMonth, 0);
    const rated = entries.filter((e) => e.averageRating !== null);
    const avgRating = rated.length > 0 ? rated.reduce((s, e) => s + (e.averageRating ?? 0), 0) / rated.length : null;
    const avgPerStaff = entries.length > 0 ? totalJobs / entries.length : 0;
    return { totalJobs, avgRating, avgPerStaff, staffCount: entries.length };
  }, [entries]);

  const chartData = useMemo(
    () =>
      entries.slice(0, 8).map((e) => ({
        name: e.fullName.split(" ")[0],
        jobs: e.completedJobsThisMonth,
      })),
    [entries]
  );

  const ratingRows = useMemo(
    () =>
      entries
        .filter((e) => e.averageRating !== null)
        .sort((a, b) => (b.averageRating ?? 0) - (a.averageRating ?? 0))
        .slice(0, 8)
        .map((e) => ({
          label: e.fullName,
          value: e.averageRating ?? 0,
          meta: `⭐ ${(e.averageRating ?? 0).toFixed(1)}`,
        })),
    [entries]
  );

  const columns: Column<StaffLeaderboardEntry>[] = [
    {
      header: "Personel",
      isPrimary: true,
      avatarLabel: (row) => row.fullName,
      accessor: (row) => row.fullName,
    },
    { header: "Pozisyon", accessor: (row) => row.position },
    {
      header: "Tamamlanan İş",
      accessor: (row) => (
        <span className="inline-flex items-center gap-2">
          <span className="font-mono font-semibold text-text-primary">{row.completedJobsThisMonth}</span>
          <span className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-muted">
            <span
              className="block h-full rounded-full bg-primary-500"
              style={{
                width: `${(row.completedJobsThisMonth / Math.max(1, entries[0]?.completedJobsThisMonth ?? 1)) * 100}%`,
              }}
            />
          </span>
        </span>
      ),
    },
    {
      header: "Ortalama Puan",
      accessor: (row) =>
        row.averageRating !== null ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-warning-50 px-2 py-0.5 text-xs font-semibold text-warning-600">
            <Star size={12} strokeWidth={2} className="fill-current" />
            {row.averageRating.toFixed(1)}
          </span>
        ) : (
          <span className="text-text-faint">—</span>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Trophy}
        title="Bu Ayın Performansı"
        description="Tamamlanan iş sayısı ve ortalama müşteri puanına göre sıralama."
      />

      {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

      {/* [Özet kartlar] */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Tamamlanan iş (bu ay)" value={loading ? "—" : String(stats.totalJobs)} icon={Target} mono />
        <StatCard
          label="Ortalama müşteri puanı"
          value={loading || stats.avgRating === null ? "—" : stats.avgRating.toFixed(1)}
          icon={Star}
          accent="gold"
          hint="5 üzerinden"
          progress={stats.avgRating ? (stats.avgRating / 5) * 100 : 0}
        />
        <StatCard label="Aktif personel" value={loading ? "—" : String(stats.staffCount)} icon={Users2} accent="blue" mono />
        <StatCard
          label="Kişi başı ortalama iş"
          value={loading ? "—" : stats.avgPerStaff.toFixed(1)}
          icon={Award}
          accent="neutral"
          mono
        />
      </div>

      {!loading && entries.length === 0 && !error && (
        <EmptyState icon={Trophy} title="Henüz veri yok" description="Bu ay tamamlanmış iş bulunmuyor." />
      )}

      {/* [Podyum] */}
      {topThree.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {topThree.map((entry, i) => (
            <div
              key={entry.staffId}
              className={`flex flex-col items-center gap-1.5 rounded-2xl border p-6 text-center shadow-card ${PODIUM_TONES[i]}`}
            >
              <span className="text-4xl">{MEDALS[i]}</span>
              <p className="text-base font-semibold text-text-primary">{entry.fullName}</p>
              <p className="text-xs text-text-secondary">{entry.position}</p>
              <p className="mt-2 font-mono text-3xl font-bold text-primary-700">{entry.completedJobsThisMonth}</p>
              <p className="text-xs text-text-faint">tamamlanan iş</p>
              {entry.averageRating !== null && (
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-surface-base/80 px-2.5 py-1 text-xs font-semibold text-warning-600">
                  <Star size={12} strokeWidth={2} className="fill-current" />
                  {entry.averageRating.toFixed(1)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* [Grafikler] */}
      {entries.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard
            title="Personel Bazında Tamamlanan İş"
            description="Bu ay içinde kapatılan iş sayısı"
            icon={Target}
            height={260}
          >
            <SimpleBarChart data={chartData} xKey="name" series={[{ key: "jobs", name: "Tamamlanan iş" }]} />
          </ChartCard>

          <ChartCard title="Müşteri Puanı Sıralaması" description="5 üzerinden ortalama" icon={Star} height={260}>
            <RankBars rows={ratingRows} emptyLabel="Henüz puanlanmış iş yok" />
          </ChartCard>
        </div>
      )}

      {/* [Detaylı tablo] */}
      {entries.length > 0 && (
        <Table columns={columns} data={entries} keyField={(row) => row.staffId} loading={loading} />
      )}
    </div>
  );
}

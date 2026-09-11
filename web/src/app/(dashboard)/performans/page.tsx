"use client";

import { useEffect, useMemo, useState } from "react";
import { Trophy, Target, Star, Users2, Award, TrendingUp, Timer, ClipboardList } from "lucide-react";
import { RequireRole } from "@/components/RequireRole";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { ChartCard, RankBars, SimpleBarChart } from "@/components/ChartCard";
import { Table, type Column } from "@/components/Table";
import { api, ApiError } from "@/lib/api";
import type { StaffLeaderboardEntry, StaffLeaderboardSummary, LeaderboardPeriod } from "@/lib/types";
import { EvaluationsTab } from "./EvaluationsTab";

type PageTab = "leaderboard" | "evaluations";

const PERIOD_LABELS: Record<LeaderboardPeriod, string> = {
  this_month: "Bu Ay",
  last_month: "Geçen Ay",
  this_year: "Bu Yıl",
};

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
  const [tab, setTab] = useState<PageTab>("leaderboard");
  const [entries, setEntries] = useState<StaffLeaderboardEntry[]>([]);
  const [summary, setSummary] = useState<StaffLeaderboardSummary | null>(null);
  const [monthlyTarget, setMonthlyTarget] = useState<number | null>(null);
  const [period, setPeriod] = useState<LeaderboardPeriod>("this_month");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .get<{ data: StaffLeaderboardEntry[]; summary: StaffLeaderboardSummary; monthlyTarget: number | null }>(
        `/staff/leaderboard?period=${period}`
      )
      .then((res) => {
        setEntries(res.data);
        setSummary(res.summary);
        setMonthlyTarget(res.monthlyTarget);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Liderlik tablosu yüklenemedi"))
      .finally(() => setLoading(false));
  }, [period]);

  const topThree = entries.slice(0, 3);

  // Özet artık sunucudan gelir (ortalama puan, puanlanan iş sayısı ve geçen ay
  // dahil); yanıt gelmeden önce kartlar "—" gösterir.
  const periodOverPeriod = useMemo(() => {
    if (!summary || summary.totalCompletedPreviousPeriod === 0) return null;
    return (
      ((summary.totalCompletedInPeriod - summary.totalCompletedPreviousPeriod) /
        summary.totalCompletedPreviousPeriod) *
      100
    );
  }, [summary]);

  const chartData = useMemo(
    () =>
      entries.slice(0, 8).map((e) => ({
        name: e.fullName.split(" ")[0],
        jobs: e.completedJobsInPeriod,
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
          <span className="font-mono font-semibold text-text-primary">{row.completedJobsInPeriod}</span>
          <span className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-muted">
            <span
              className="block h-full rounded-full bg-primary-500"
              style={{
                width: `${(row.completedJobsInPeriod / Math.max(1, entries[0]?.completedJobsInPeriod ?? 1)) * 100}%`,
              }}
            />
          </span>
        </span>
      ),
    },
    {
      header: "Önceki Dönem",
      accessor: (row) => (
        <span className="font-mono text-text-secondary">{row.completedJobsPreviousPeriod}</span>
      ),
    },
    {
      header: "Zamanında",
      accessor: (row) =>
        row.onTimeRate === null ? (
          <span className="text-text-faint">—</span>
        ) : (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              row.onTimeRate >= 90 ? "bg-success-50 text-success-500" : "bg-warning-50 text-warning-600"
            }`}
            title={`${row.onTimeMeasuredJobs} planlı iş üzerinden`}
          >
            %{row.onTimeRate.toFixed(0)}
          </span>
        ),
    },
    {
      header: "Hedef",
      accessor: (row) =>
        row.targetCompletionPercent === null ? (
          <span className="text-text-faint">—</span>
        ) : (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              row.targetCompletionPercent >= 100
                ? "bg-success-50 text-success-500"
                : "bg-warning-50 text-warning-600"
            }`}
          >
            %{row.targetCompletionPercent.toFixed(0)}
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
            <span className="font-normal text-text-faint">({row.ratedJobsCount})</span>
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

      {/* Mevcut basit Performans mantığı (tamamlanan iş + müşteri puanı) hiç
          değişmedi — Formal Değerlendirme sistemi ayrı bir sekme olarak eklendi. */}
      <div className="flex gap-1 rounded-2xl border border-border bg-surface-card p-1 shadow-card w-fit">
        <button
          type="button"
          onClick={() => setTab("leaderboard")}
          className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition ${
            tab === "leaderboard" ? "bg-primary-600 text-white shadow-card" : "text-text-secondary hover:bg-surface-subtle"
          }`}
        >
          <Trophy size={14} strokeWidth={1.75} />
          Liderlik Tablosu
        </button>
        <button
          type="button"
          onClick={() => setTab("evaluations")}
          className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition ${
            tab === "evaluations" ? "bg-primary-600 text-white shadow-card" : "text-text-secondary hover:bg-surface-subtle"
          }`}
        >
          <ClipboardList size={14} strokeWidth={1.75} />
          Değerlendirmeler
        </button>
      </div>

      {tab === "evaluations" ? (
        <EvaluationsTab />
      ) : (
        <>
      {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

      {/* [Dönem seçici] — Stitch Şef → Ekip Performansı: Bu Ay / Geçen Ay / Bu Yıl */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(PERIOD_LABELS) as LeaderboardPeriod[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setPeriod(key)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              period === key
                ? "bg-primary-600 text-white"
                : "border border-border bg-surface-base text-text-secondary hover:bg-surface-subtle"
            }`}
          >
            {PERIOD_LABELS[key]}
          </button>
        ))}
      </div>

      {/* [Özet kartlar] */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={`Tamamlanan iş (${PERIOD_LABELS[period].toLowerCase()})`}
          value={loading || !summary ? "—" : String(summary.totalCompletedInPeriod)}
          icon={Target}
          mono
          trend={
            periodOverPeriod !== null
              ? { value: periodOverPeriod, label: "önceki döneme göre" }
              : undefined
          }
        />
        <StatCard
          label="Ortalama müşteri puanı"
          value={loading || !summary || summary.averageRating === null ? "—" : summary.averageRating.toFixed(1)}
          icon={Star}
          accent="gold"
          hint={summary?.ratedJobsCount ? `${summary.ratedJobsCount} puanlanmış iş` : "5 üzerinden"}
          progress={summary?.averageRating ? (summary.averageRating / 5) * 100 : 0}
        />
        <StatCard
          label="Aktif personel"
          value={loading || !summary ? "—" : String(summary.staffCount)}
          icon={Users2}
          accent="blue"
          mono
        />
        {/* Aylık iş hedefi işletme sahibi tarafından tanımlanır; tanımlı
            değilse hedef kartı yerine kişi başı ortalama gösterilir. */}
        <StatCard
          label="Zamanında tamamlama"
          value={
            loading || !summary || summary.onTimeRate === null
              ? "—"
              : `%${summary.onTimeRate.toFixed(0)}`
          }
          icon={Timer}
          accent="green"
          mono
          progress={summary?.onTimeRate ?? undefined}
          hint="Randevu penceresinde biten işler"
        />
        {monthlyTarget ? (
          <StatCard
            label="Hedef gerçekleşme"
            value={
              loading || !summary
                ? "—"
                : `%${((summary.totalCompletedThisMonth / (monthlyTarget * Math.max(1, summary.staffCount))) * 100).toFixed(0)}`
            }
            icon={TrendingUp}
            accent="green"
            mono
            hint={`Kişi başı aylık hedef: ${monthlyTarget}`}
          />
        ) : (
          <StatCard
            label="Kişi başı ortalama iş"
            value={loading || !summary ? "—" : summary.jobsPerStaff.toFixed(1)}
            icon={Award}
            accent="neutral"
            mono
          />
        )}
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
              <p className="mt-2 font-mono text-3xl font-bold text-primary-700">{entry.completedJobsInPeriod}</p>
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
        </>
      )}
    </div>
  );
}

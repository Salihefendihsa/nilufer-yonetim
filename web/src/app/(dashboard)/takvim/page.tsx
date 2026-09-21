"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LoadingBlock } from "@/components/LoadingBlock";
import { SectionTitle } from "@/components/SectionTitle";
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock, LayoutGrid, Wrench } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { StatusStrip } from "@/components/StatusStrip";
import { ChartCard, SimpleBarChart } from "@/components/ChartCard";
import { StatusBadge, STATUS_COLORS, STATUS_TEXT } from "@/components/StatusBadge";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthProvider";
import { formatDateTime } from "@/lib/format";
import type { Job, JobStatus, Paginated, StaffUnavailability } from "@/lib/types";
import { UnavailabilityPanel } from "./UnavailabilityPanel";

const WEEKDAY_LABELS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const MONTH_LABELS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];
const ALL_STATUSES: JobStatus[] = ["PENDING", "SCHEDULED", "COMPLETED", "CANCELLED"];

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// Monday = 0 ... Sunday = 6
function mondayIndex(jsWeekday: number): number {
  return (jsWeekday + 6) % 7;
}

/**
 * Gün hücresinin yoğunluk basamağı: 0 (iş yok) → 4 (ayın en yoğun günü).
 * Renkler primary skalasından, açıktan koyuya doğru.
 */
function heatLevel(count: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (count === 0) return 0;
  const ratio = count / Math.max(1, max);
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

// Tailwind JIT sınıfları görebilsin diye tam sınıf adları.
const HEAT_STYLES: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: "bg-surface-base text-text-secondary",
  1: "bg-primary-50 text-primary-700",
  2: "bg-primary-100 text-primary-700",
  3: "bg-primary-200 text-primary-800",
  4: "bg-primary-300 text-primary-900",
};

const HEAT_LEGEND: { level: 0 | 1 | 2 | 3 | 4; swatch: string }[] = [
  { level: 0, swatch: "bg-surface-muted" },
  { level: 1, swatch: "bg-primary-50" },
  { level: 2, swatch: "bg-primary-100" },
  { level: 3, swatch: "bg-primary-200" },
  { level: 4, swatch: "bg-primary-300" },
];

export default function CalendarPage() {
  const { user } = useAuth();
  // Bölüm K (3. tur): STAFF/TEAM_LEAD kendi müsaitliğini işaretler; işaretli
  // günler takvim hücresinde küçük bir rozetle görünür.
  const canMarkUnavailability = user?.role === "STAFF" || user?.role === "TEAM_LEAD";
  const [unavailableDays, setUnavailableDays] = useState<Set<string>>(new Set());
  const [monthStart, setMonthStart] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => dateKey(new Date()));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const from = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1);
      const to = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59);
      const res = await api.get<Paginated<Job>>(
        `/jobs?from=${from.toISOString()}&to=${to.toISOString()}&limit=100`
      );
      setJobs(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "İşler yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [monthStart]);

  useEffect(() => {
    load();
  }, [load]);

  const jobsByDay = useMemo(() => {
    const map = new Map<string, Job[]>();
    for (const job of jobs) {
      if (!job.scheduledAt) continue;
      const key = dateKey(new Date(job.scheduledAt));
      const list = map.get(key) ?? [];
      list.push(job);
      map.set(key, list);
    }
    return map;
  }, [jobs]);

  const cells = useMemo(() => {
    const year = monthStart.getFullYear();
    const month = monthStart.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const leading = mondayIndex(firstDay.getDay());

    const result: { date: Date; inMonth: boolean }[] = [];

    for (let i = 0; i < leading; i++) {
      const date = new Date(year, month, 1 - (leading - i));
      result.push({ date, inMonth: false });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      result.push({ date: new Date(year, month, day), inMonth: true });
    }
    while (result.length % 7 !== 0 || result.length < 42) {
      const last = result[result.length - 1].date;
      const next = new Date(last);
      next.setDate(last.getDate() + 1);
      result.push({ date: next, inMonth: false });
      if (result.length >= 42) break;
    }

    return result;
  }, [monthStart]);

  const today = dateKey(new Date());
  const monthKey = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}`;
  const handleUnavailabilityChanged = useCallback((rows: StaffUnavailability[]) => {
    setUnavailableDays(new Set(rows.map((r) => r.date)));
  }, []);

  // Özet değerlerin tamamı zaten çekilmiş aylık iş listesinden türetilir; ek istek yok.
  const stats = useMemo(() => {
    const todaysCount = (jobsByDay.get(today) ?? []).length;

    // İçinde bulunulan haftanın pazartesi–pazar aralığı.
    const now = new Date();
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayIndex(now.getDay()));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const thisWeekCount = jobs.filter((job) => {
      if (!job.scheduledAt) return false;
      const d = new Date(job.scheduledAt);
      return d >= weekStart && d < weekEnd;
    }).length;

    const completed = jobs.filter((j) => j.status === "COMPLETED").length;
    const busiest = Math.max(0, ...Array.from(jobsByDay.values(), (list) => list.length));

    return {
      todaysCount,
      thisWeekCount,
      completed,
      completionRate: jobs.length > 0 ? (completed / jobs.length) * 100 : 0,
      busiest,
    };
  }, [jobs, jobsByDay, today]);

  /** Ayın haftalara bölünmüş iş sayısı — takvimin üstündeki çubuk grafik. */
  const weekBuckets = useMemo(() => {
    const buckets: { label: string; count: number }[] = [];
    for (let i = 0; i < cells.length; i += 7) {
      const week = cells.slice(i, i + 7);
      const count = week.reduce(
        (sum, cell) => sum + (cell.inMonth ? (jobsByDay.get(dateKey(cell.date)) ?? []).length : 0),
        0
      );
      // Ay dışındaki dolgu haftalarını (tamamen boş ve ay dışıysa) gösterme.
      if (week.some((c) => c.inMonth)) {
        buckets.push({ label: `${buckets.length + 1}. Hafta`, count });
      }
    }
    return buckets;
  }, [cells, jobsByDay]);

  const statusSegments = useMemo(
    () =>
      ALL_STATUSES.map((status) => ({
        label: STATUS_TEXT[status],
        count: jobs.filter((j) => j.status === status).length,
        color: STATUS_COLORS[status],
      })),
    [jobs]
  );

  const selectedJobs = (jobsByDay.get(selectedDate) ?? []).sort(
    (a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime()
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={CalendarDays}
        title="Takvim"
        description="Planlanan işleri ay görünümünde takip edin."
        actions={
          <div className="flex items-center gap-1 rounded-2xl border border-border bg-surface-card p-1 shadow-card">
            <button
              type="button"
              onClick={() => setMonthStart((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
              aria-label="Önceki ay"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
            >
              <ChevronLeft size={16} strokeWidth={1.75} />
            </button>
            <span className="w-36 text-center text-sm font-semibold text-text-primary">
              {MONTH_LABELS[monthStart.getMonth()]} {monthStart.getFullYear()}
            </span>
            <button
              type="button"
              onClick={() => setMonthStart((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
              aria-label="Sonraki ay"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
            >
              <ChevronRight size={16} strokeWidth={1.75} />
            </button>
          </div>
        }
      />

      {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

      {/* [Özet kartlar] */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Bugünkü iş" value={loading ? "—" : String(stats.todaysCount)} icon={Clock} mono />
        <StatCard
          label="Bu haftaki iş"
          value={loading ? "—" : String(stats.thisWeekCount)}
          icon={CalendarDays}
          accent="blue"
          mono
        />
        <StatCard
          label="Tamamlanan / planlanan"
          value={loading ? "—" : `${stats.completed}/${jobs.length}`}
          icon={CheckCircle2}
          mono
          progress={stats.completionRate}
          hint={`Bu ayın %${Math.round(stats.completionRate)}'i tamamlandı`}
        />
        <StatCard
          label="En yoğun gün"
          value={loading ? "—" : `${stats.busiest} iş`}
          icon={LayoutGrid}
          accent="gold"
          mono
          hint="Ayın tek günde en çok iş sayısı"
        />
      </div>

      {/* [Durum dağılımı şeridi] */}
      <StatusStrip
        loading={loading}
        totalLabel={`${MONTH_LABELS[monthStart.getMonth()]} ayında ${jobs.length} iş`}
        segments={statusSegments}
      />

      {/* [Haftalık dağılım grafiği] */}
      <ChartCard title="Haftalık Dağılım" description="Ay içindeki haftalara göre iş sayısı" icon={LayoutGrid} height={180}>
        <SimpleBarChart
          data={weekBuckets}
          xKey="label"
          series={[{ key: "count", name: "İş sayısı" }]}
          loading={loading} emptyLabel="Bu ayda iş yok"
        />
      </ChartCard>

      {/* [Takvim + seçili gün detayı] */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
        <div className="rounded-2xl border border-border bg-surface-card p-4 shadow-card sm:p-6">
          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} className="py-2 text-center text-xs font-semibold text-text-faint">
                {label}
              </div>
            ))}

            {cells.map(({ date, inMonth }) => {
              const key = dateKey(date);
              const dayJobs = jobsByDay.get(key) ?? [];
              const isSelected = key === selectedDate;
              const isToday = key === today;
              const level = heatLevel(dayJobs.length, stats.busiest);

              return (
                <button
                  key={key}
                  type="button"
                  disabled={!inMonth}
                  onClick={() => setSelectedDate(key)}
                  title={inMonth ? `${date.getDate()} ${MONTH_LABELS[date.getMonth()]} — ${dayJobs.length} iş` : undefined}
                  className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border transition ${
                    !inMonth
                      ? "cursor-default border-transparent bg-transparent text-text-faint/40"
                      : isSelected
                        ? "border-primary-600 bg-primary-100 text-primary-800 ring-2 ring-primary-500/20"
                        : `${HEAT_STYLES[level]} ${isToday ? "border-primary-500" : "border-border"} hover:border-primary-300`
                  }`}
                >
                  <span className={`text-sm ${isToday || isSelected ? "font-bold" : "font-medium"}`}>{date.getDate()}</span>
                  {inMonth && dayJobs.length > 0 && (
                    <span
                      className={`font-mono text-3xs font-semibold ${
                        level >= 3 ? "text-primary-900" : "text-primary-700"
                      }`}
                    >
                      {dayJobs.length} iş
                    </span>
                  )}
                  {inMonth && unavailableDays.has(key) && (
                    <span className="rounded-full bg-warning-50 px-1.5 text-3xs font-semibold text-warning-600 ring-1 ring-warning-100" title="Müsait değilim">
                      müsait değil
                    </span>
                  )}
                  {inMonth && isToday && !isSelected && <span className="h-1 w-1 rounded-full bg-primary-600" />}
                </button>
              );
            })}
          </div>

          {/* Yoğunluk göstergesi */}
          <div className="mt-4 flex items-center justify-end gap-2 border-t border-border pt-3">
            <span className="text-2xs text-text-faint">Az yoğun</span>
            {HEAT_LEGEND.map((entry) => (
              <span key={entry.level} className={`h-3 w-3 rounded-sm border border-border ${entry.swatch}`} />
            ))}
            <span className="text-2xs text-text-faint">Çok yoğun</span>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface-card p-6 shadow-card">
          <SectionTitle size="sm">
            {new Date(selectedDate).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}
          </SectionTitle>
          <p className="mt-1 text-xs text-text-faint">{selectedJobs.length} iş</p>

          <div className="mt-4 flex flex-col gap-3">
            {loading ? (
              <LoadingBlock rows={3} className="py-6" />
            ) : selectedJobs.length === 0 ? (
              <EmptyState icon={Wrench} title="Bu güne ait iş yok" />
            ) : (
              selectedJobs.map((job) => (
                <div
                  key={job.id}
                  className="rounded-xl border border-border border-l-4 bg-surface-subtle p-4 transition hover:bg-surface-base"
                  style={{ borderLeftColor: STATUS_COLORS[job.status] }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-text-primary">{job.serviceType}</p>
                    <StatusBadge status={job.status} />
                  </div>
                  <p className="mt-1 text-xs text-text-faint">{formatDateTime(job.scheduledAt)}</p>
                  {job.calendarLink && (
                    <a
                      href={job.calendarLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:underline"
                    >
                      <CalendarDays size={12} strokeWidth={2} />
                      Takvime Ekle
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {canMarkUnavailability && (
        <UnavailabilityPanel selectedDate={selectedDate} month={monthKey} onChanged={handleUnavailabilityChanged} />
      )}
    </div>
  );
}

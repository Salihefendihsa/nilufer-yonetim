"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Wrench } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { api, ApiError } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { Job, Paginated } from "@/lib/types";

const WEEKDAY_LABELS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const MONTH_LABELS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// Monday = 0 ... Sunday = 6
function mondayIndex(jsWeekday: number): number {
  return (jsWeekday + 6) % 7;
}

export default function CalendarPage() {
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
  const selectedJobs = (jobsByDay.get(selectedDate) ?? []).sort(
    (a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime()
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-text-primary">Takvim</h1>
          <p className="mt-1 text-sm text-text-secondary">Planlanan işleri ay görünümünde takip edin.</p>
        </div>
        <div className="flex items-center gap-3 rounded-2xl bg-surface-card px-2 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.22)]">
          <button
            type="button"
            onClick={() => setMonthStart((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
            aria-label="Önceki ay"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-text-secondary transition hover:bg-white/5"
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
            className="flex h-9 w-9 items-center justify-center rounded-xl text-text-secondary transition hover:bg-white/5"
          >
            <ChevronRight size={16} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {error && <p className="rounded-2xl bg-primary-red/10 px-4 py-3 text-sm text-primary-redLight">{error}</p>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div className="rounded-2xl bg-surface-card p-4 shadow-[0_8px_24px_rgba(0,0,0,0.22)] sm:p-6">
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

              return (
                <button
                  key={key}
                  type="button"
                  disabled={!inMonth}
                  onClick={() => setSelectedDate(key)}
                  className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border transition ${
                    !inMonth
                      ? "cursor-default border-transparent text-text-faint/30"
                      : isSelected
                        ? "border-primary-green bg-primary-green/15 text-text-primary"
                        : isToday
                          ? "border-primary-gold/40 text-text-primary hover:bg-white/5"
                          : "border-transparent text-text-secondary hover:bg-white/5"
                  }`}
                >
                  <span className="text-sm font-medium">{date.getDate()}</span>
                  {inMonth && dayJobs.length > 0 && (
                    <span className="flex items-center gap-1 rounded-full bg-primary-green/20 px-1.5 py-0.5 text-[10px] font-semibold text-primary-greenLight">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary-greenLight" />
                      {dayJobs.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl bg-surface-card p-6 shadow-[0_8px_24px_rgba(0,0,0,0.22)]">
          <h2 className="text-sm font-semibold text-text-primary">
            {new Date(selectedDate).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}
          </h2>
          <p className="mt-1 text-xs text-text-faint">{selectedJobs.length} iş</p>

          <div className="mt-4 flex flex-col gap-3">
            {loading ? (
              <p className="py-6 text-center text-sm text-text-faint">Yükleniyor...</p>
            ) : selectedJobs.length === 0 ? (
              <EmptyState icon={Wrench} title="Bu güne ait iş yok" />
            ) : (
              selectedJobs.map((job) => (
                <div key={job.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
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
                      className="mt-2 inline-block text-xs font-medium text-primary-greenLight hover:underline"
                    >
                      📅 Takvime Ekle
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

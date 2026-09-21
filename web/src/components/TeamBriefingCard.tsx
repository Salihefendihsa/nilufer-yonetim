"use client";

import { CalendarOff, Users2 } from "lucide-react";
import { chartPalette } from "@/lib/chartPalette";
import { LoadingBlock } from "@/components/LoadingBlock";
import { EmptyState } from "@/components/EmptyState";
import type { StaffStatus, TeamDailyBriefing } from "@/lib/types";

/** Anlık durum noktası rengi ve etiketi (Staff.status). */
export const STAFF_STATUS_META: Record<StaffStatus, { label: string; color: string }> = {
  AVAILABLE: { label: "Müsait", color: chartPalette.success },
  ON_JOB: { label: "İşte", color: chartPalette.info },
  ON_BREAK: { label: "Molada", color: chartPalette.warning },
  ON_LEAVE: { label: "İzinli", color: chartPalette.danger },
  OFFLINE: { label: "Çevrimdışı", color: chartPalette.neutral },
};

interface TeamBriefingCardProps {
  briefing: TeamDailyBriefing | null;
  loading: boolean;
}

/**
 * Bölüm M (4. tur): Şef Ana Sayfa → "Bugün Ekibim". Her ekip üyesi bir
 * satır: durum noktası, bugünkü iş sayısı, izinli/müsait-değil rozeti.
 */
export function TeamBriefingCard({ briefing, loading }: TeamBriefingCardProps) {
  const members = briefing?.members ?? [];
  return (
    <div className="rounded-2xl border border-border bg-surface-card p-6 shadow-card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 ring-1 ring-primary-100">
            <Users2 size={17} strokeWidth={1.75} />
          </span>
          <div>
            <h2 className="text-base font-semibold text-text-primary">Bugün Ekibim</h2>
            <p className="text-xs text-text-faint">
              {briefing
                ? `${briefing.availableNowCount} müsait · ${briefing.onLeaveCount} izinli · ${briefing.unavailableCount} kısmen müsait değil`
                : "Anlık durum, bugünkü iş ve müsaitlik"}
            </p>
          </div>
        </div>
        {briefing && (
          <span className="rounded-full bg-surface-subtle px-3 py-1 text-xs font-semibold text-text-secondary">
            {briefing.completedTodayCount}/{briefing.todaysJobsCount} iş tamamlandı
          </span>
        )}
      </div>

      {loading ? (
        <LoadingBlock rows={3} className="py-6" />
      ) : members.length === 0 ? (
        <EmptyState icon={Users2} title="Ekibinizde personel yok" description="Size bağlı personel eklendiğinde burada görünür." />
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {members.map((m) => {
            const meta = STAFF_STATUS_META[m.status] ?? STAFF_STATUS_META.OFFLINE;
            return (
              <li key={m.staffId} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-surface-card" style={{ backgroundColor: meta.color }} title={meta.label} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text-primary">
                      {m.fullName}
                      {m.isSelf && <span className="ml-1.5 text-xs font-normal text-text-faint">(siz)</span>}
                    </p>
                    <p className="text-xs text-text-secondary">
                      {meta.label} · {m.position}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {m.onLeave && (
                    <span className="flex items-center gap-1 rounded-full bg-danger-50 px-2 py-0.5 text-2xs font-semibold text-danger-500">
                      <CalendarOff size={11} strokeWidth={2} />
                      İzinli
                    </span>
                  )}
                  {!m.onLeave && m.unavailable && (
                    <span
                      className="flex items-center gap-1 rounded-full bg-warning-50 px-2 py-0.5 text-2xs font-semibold text-warning-600"
                      title={m.unavailableReason ?? undefined}
                    >
                      <CalendarOff size={11} strokeWidth={2} />
                      {m.unavailableAllDay ? "Bugün müsait değil" : `Müsait değil ${m.unavailableRanges.join(", ")}`}
                    </span>
                  )}
                  <span className="rounded-full bg-surface-subtle px-2.5 py-0.5 font-mono text-xs font-semibold text-text-secondary">
                    {m.todaysJobsCount} iş
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

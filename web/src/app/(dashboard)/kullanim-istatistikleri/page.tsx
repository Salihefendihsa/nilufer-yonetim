"use client";

import { useCallback, useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { RequireRole } from "@/components/RequireRole";
import { EmptyState } from "@/components/EmptyState";
import { api, ApiError } from "@/lib/api";
import { ROLE_LABELS } from "@/lib/auth";
import type { SessionReportEntry } from "@/lib/types";

const DAY_OPTIONS = [7, 30, 90];

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

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-text-primary">Kullanım İstatistikleri</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Kullanıcıların sistemde geçirdiği süreler. <span className="text-text-faint">~</span> işaretli değerler
            kesin çıkış zamanı bilinmediği için yaklaşık hesaplanmıştır.
          </p>
        </div>
        <div className="flex gap-1.5 rounded-2xl bg-surface-card p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.22)]">
          {DAY_OPTIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
                days === d ? "bg-primary-green text-white" : "text-text-secondary hover:bg-white/5"
              }`}
            >
              Son {d} Gün
            </button>
          ))}
        </div>
      </div>

      {error && <p className="rounded-2xl bg-primary-red/10 px-4 py-3 text-sm text-primary-redLight">{error}</p>}

      <div className="rounded-2xl bg-surface-card shadow-[0_8px_24px_rgba(0,0,0,0.22)]">
        {loading ? (
          <p className="py-16 text-center text-sm text-text-faint">Yükleniyor...</p>
        ) : rows.length === 0 ? (
          <EmptyState icon={Timer} title="Bu aralıkta oturum kaydı yok" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs font-semibold text-text-faint">
                  <th className="px-6 py-3">Kullanıcı</th>
                  <th className="px-6 py-3">Rol</th>
                  <th className="px-6 py-3">Toplam Oturum</th>
                  <th className="px-6 py-3">Ortalama Süre</th>
                  <th className="px-6 py-3">Son Giriş</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map((row) => (
                  <tr key={row.userId}>
                    <td className="px-6 py-3.5 font-medium text-text-primary">{row.fullName}</td>
                    <td className="px-6 py-3.5 text-text-secondary">{ROLE_LABELS[row.role as keyof typeof ROLE_LABELS] ?? row.role}</td>
                    <td className="px-6 py-3.5 font-mono text-text-secondary">{row.totalSessions}</td>
                    <td className="px-6 py-3.5 font-mono text-text-secondary">
                      {row.isApproximate && <span className="text-text-faint">~</span>}
                      {formatDuration(row.averageDurationMinutes)}
                    </td>
                    <td className="px-6 py-3.5 text-text-secondary">{formatDateTime(row.lastLoginAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

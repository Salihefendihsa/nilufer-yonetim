"use client";

import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { RequireRole } from "@/components/RequireRole";
import { EmptyState } from "@/components/EmptyState";
import { api, ApiError } from "@/lib/api";
import type { StaffLeaderboardEntry } from "@/lib/types";

const MEDALS = ["🥇", "🥈", "🥉"];

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

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-text-primary">Bu Ayın Performansı</h1>
        <p className="mt-1 text-sm text-text-secondary">Tamamlanan iş sayısı ve ortalama müşteri puanına göre sıralama.</p>
      </div>

      {error && <p className="rounded-2xl bg-primary-red/10 px-4 py-3 text-sm text-primary-redLight">{error}</p>}

      {!loading && entries.length === 0 && !error && (
        <EmptyState icon={Trophy} title="Henüz veri yok" description="Bu ay tamamlanmış iş bulunmuyor." />
      )}

      {topThree.length > 0 && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {topThree.map((entry, i) => (
            <div
              key={entry.staffId}
              className="flex flex-col items-center gap-2 rounded-2xl border border-primary-gold/20 bg-gradient-to-b from-primary-gold/10 to-transparent p-6 text-center"
            >
              <span className="text-4xl">{MEDALS[i]}</span>
              <p className="text-base font-semibold text-text-primary">{entry.fullName}</p>
              <p className="text-xs text-text-secondary">{entry.position}</p>
              <p className="mt-2 text-2xl font-bold text-primary-greenLight">{entry.completedJobsThisMonth}</p>
              <p className="text-xs text-text-faint">tamamlanan iş</p>
              {entry.averageRating !== null && (
                <p className="text-sm text-text-secondary">⭐ {entry.averageRating.toFixed(1)}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {entries.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-left text-xs font-semibold uppercase tracking-wide text-text-faint">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Personel</th>
                <th className="px-4 py-3">Pozisyon</th>
                <th className="px-4 py-3">Tamamlanan İş</th>
                <th className="px-4 py-3">Ortalama Puan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {entries.map((entry, i) => (
                <tr key={entry.staffId}>
                  <td className="px-4 py-3 text-text-faint">{i + 1}</td>
                  <td className="px-4 py-3 font-medium text-text-primary">{entry.fullName}</td>
                  <td className="px-4 py-3 text-text-secondary">{entry.position}</td>
                  <td className="px-4 py-3 text-text-secondary">{entry.completedJobsThisMonth}</td>
                  <td className="px-4 py-3 text-text-secondary">
                    {entry.averageRating !== null ? `⭐ ${entry.averageRating.toFixed(1)}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

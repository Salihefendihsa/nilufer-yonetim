"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { ChartCard, TrendChart } from "@/components/ChartCard";
import { AchievementBadge } from "@/components/Badges";
import { api, ApiError } from "@/lib/api";
import type { EvaluationHistory } from "@/lib/types";

interface EvaluationTrendCardProps {
  staffId: string;
  /** Kart yüksekliği (px) — modal içinde daha kısa. */
  height?: number;
}

/**
 * Bölüm V (5. tur): Dönemden döneme averageScore çizgi grafiği
 * (GET /evaluations/staff/:staffId/history). Taslaklar dahil değil; tek dönem
 * varsa delta gösterilmez.
 */
export function EvaluationTrendCard({ staffId, height = 200 }: EvaluationTrendCardProps) {
  const [data, setData] = useState<EvaluationHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get<EvaluationHistory>(`/evaluations/staff/${staffId}/history`)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Geçmiş yüklenemedi");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [staffId]);

  const points = (data?.data ?? []).map((d) => ({ label: d.periodLabel, score: d.averageScore ?? 0 }));
  const last = data?.data[data.data.length - 1];
  const delta = data?.lastDelta ?? null;
  const DeltaIcon = delta === null ? Minus : delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  const deltaTone = delta === null || delta === 0 ? "text-text-faint" : delta > 0 ? "text-primary-700" : "text-danger-500";

  return (
    <ChartCard
      title="Performans Trendi"
      description={
        data && data.data.length > 0
          ? `${data.data.length} dönem · genel ortalama ${data.overallAverage?.toFixed(1) ?? "—"}/20`
          : "Dönemden döneme değerlendirme ortalaması"
      }
      icon={TrendingUp}
      height={height}
      action={
        data && data.data.length > 0 ? (
          <span className="flex items-center gap-2">
            <AchievementBadge tier={last?.achievementTier ?? null} />
            {delta !== null && (
              <span className={`flex items-center gap-1 text-xs font-semibold ${deltaTone}`}>
                <DeltaIcon size={13} strokeWidth={2} />
                {delta > 0 ? "+" : ""}
                {delta}
              </span>
            )}
          </span>
        ) : undefined
      }
    >
      {error ? (
        <p className="py-6 text-center text-xs text-danger-500">{error}</p>
      ) : (
        <TrendChart data={points} xKey="label" series={[{ key: "score", name: "Ortalama (1–20)" }]} area emptyLabel={loading ? "Yükleniyor..." : "Henüz gönderilmiş değerlendirme yok"} />
      )}
    </ChartCard>
  );
}

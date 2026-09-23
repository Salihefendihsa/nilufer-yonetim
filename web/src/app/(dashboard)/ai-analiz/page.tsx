"use client";

import { useCallback, useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { RequireRole } from "@/components/RequireRole";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { LoadingBlock } from "@/components/LoadingBlock";
import { AuthImage } from "@/components/AuthImage";
import { api, ApiError } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

/** GET /pest-detections satırı (backend pestDetectionsController). */
interface PestDetectionRow {
  id: string;
  detectedPestType: string;
  confidence: number;
  description: string;
  analyzedAt: string;
  photo: { id: string; type: "BEFORE" | "AFTER"; fileUrl: string };
  job: { id: string; sequenceNo: number | null; serviceType: string; customerName: string; staffName: string | null };
}

interface PestDetectionsResponse {
  data: PestDetectionRow[];
  summary: { pestType: string; count: number; averageConfidence: number }[];
}

function confidenceTone(pct: number): string {
  if (pct >= 80) return "bg-success-50 text-success-600";
  if (pct >= 50) return "bg-warning-50 text-warning-600";
  return "bg-danger-50 text-danger-600";
}

/**
 * Bölüm J: "AI Analiz" — iş fotoğraflarının yapay zekâ (Claude görsel analizi)
 * haşere tespitleri. Tüm çalışan rolleri; kapsam backend'de daraltılır.
 */
export default function PestDetectionsPage() {
  return (
    <RequireRole roles={["OWNER", "MANAGER", "TEAM_LEAD", "STAFF"]}>
      <PestDetectionsContent />
    </RequireRole>
  );
}

function PestDetectionsContent() {
  const [rows, setRows] = useState<PestDetectionRow[]>([]);
  const [summary, setSummary] = useState<PestDetectionsResponse["summary"]>([]);
  const [filter, setFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ limit: "60" });
      if (filter) qs.set("pestType", filter);
      const res = await api.get<PestDetectionsResponse>(`/pest-detections?${qs.toString()}`);
      setRows(res.data);
      setSummary(res.summary);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Analizler yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="AI Analiz"
        description="İş fotoğrafları yüklendiğinde yapay zekâ haşere türünü ve güven skorunu otomatik tespit eder."
        icon={Sparkles}
      />

      {summary.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFilter(null)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium ${filter === null ? "border-primary-600 bg-primary-600 text-white" : "border-border bg-surface-card text-text-secondary"}`}
          >
            Tümü
          </button>
          {summary.map((s) => (
            <button
              key={s.pestType}
              type="button"
              onClick={() => setFilter(s.pestType)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium ${filter === s.pestType ? "border-primary-600 bg-primary-600 text-white" : "border-border bg-surface-card text-text-secondary"}`}
            >
              {s.pestType} ({s.count})
            </button>
          ))}
        </div>
      )}

      {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

      {loading ? (
        <LoadingBlock lines={4} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Henüz analiz yok"
          description="İş fotoğrafları yüklendiğinde burada haşere tespitleri görünecek."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => {
            const pct = Math.round(r.confidence * 100);
            return (
              <div key={r.id} className="flex gap-3 rounded-2xl border border-border bg-surface-card p-3">
                <AuthImage path={r.photo.fileUrl} alt={r.detectedPestType} className="h-24 w-24 shrink-0 rounded-xl object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate font-semibold text-text-primary">{r.detectedPestType}</p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${confidenceTone(pct)}`}>%{pct} güven</span>
                  </div>
                  <p className="mt-1 line-clamp-3 text-sm text-text-secondary">{r.description}</p>
                  <p className="mt-1.5 truncate text-xs text-text-faint">
                    {r.job.sequenceNo != null ? `#${r.job.sequenceNo} · ` : ""}
                    {r.job.customerName} · {r.job.serviceType}
                  </p>
                  <p className="truncate text-xs text-text-faint">
                    {r.photo.type === "BEFORE" ? "Önce" : "Sonra"}
                    {r.job.staffName ? ` · ${r.job.staffName}` : ""} · {formatDateTime(r.analyzedAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { CheckSquare, Square, ClipboardCheck } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { JobChecklistEntry } from "@/lib/types";

interface JobChecklistProps {
  jobId: string | null;
  /** false ise yalnızca gösterir (yönetici/müşteri görünümü). */
  editable?: boolean;
  /** Sunucudan gelen liste değişince (rapor formu eksik sayısını göstermek için). */
  onChange?: (entries: JobChecklistEntry[]) => void;
}

/**
 * Bölüm N (4. tur): İş öncesi günlük kontrol listesi. Şablon sabittir ve
 * sunucudan gelir (GET /jobs/:id → checklist); personel tıklayınca
 * PATCH /jobs/:id/checklist ile anında kaydedilir. Eksik öğeler raporu
 * ENGELLEMEZ, yalnızca görünür kalır.
 */
export function JobChecklist({ jobId, editable = true, onChange }: JobChecklistProps) {
  const [entries, setEntries] = useState<JobChecklistEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) {
      setEntries([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      .get<{ checklist?: JobChecklistEntry[] }>(`/jobs/${jobId}`)
      .then((job) => {
        if (cancelled) return;
        const list = job.checklist ?? [];
        setEntries(list);
        onChange?.(list);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Kontrol listesi yüklenemedi");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // onChange her render'da değişebilir; yalnızca iş değişince yükle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  async function toggle(entry: JobChecklistEntry) {
    if (!jobId || !editable) return;
    setBusyItem(entry.item);
    setError(null);
    try {
      const res = await api.patch<{ checklist: JobChecklistEntry[] }>(`/jobs/${jobId}/checklist`, {
        items: [{ item: entry.item, isChecked: !entry.isChecked }],
      });
      setEntries(res.checklist);
      onChange?.(res.checklist);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kaydedilemedi");
    } finally {
      setBusyItem(null);
    }
  }

  const done = entries.filter((e) => e.isChecked).length;

  return (
    <div className="rounded-xl border border-border bg-surface-subtle p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium text-text-primary">
          <ClipboardCheck size={15} strokeWidth={1.75} className="text-primary-600" />
          Günlük Kontrol Listesi
        </p>
        {entries.length > 0 && (
          <span
            className={`rounded-full px-2 py-0.5 text-2xs font-semibold ${
              done === entries.length ? "bg-primary-50 text-primary-700" : "bg-warning-50 text-warning-600"
            }`}
          >
            {done}/{entries.length}
          </span>
        )}
      </div>
      {loading ? (
        <p className="py-2 text-xs text-text-faint">Yükleniyor...</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {entries.map((entry) => {
            const Icon = entry.isChecked ? CheckSquare : Square;
            return (
              <li key={entry.item}>
                <button
                  type="button"
                  disabled={!editable || busyItem === entry.item}
                  onClick={() => toggle(entry)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition ${
                    editable ? "hover:bg-surface-base" : "cursor-default"
                  } disabled:opacity-60`}
                >
                  <Icon size={16} strokeWidth={1.75} className={entry.isChecked ? "text-primary-600" : "text-text-faint"} />
                  <span className={entry.isChecked ? "text-text-secondary line-through" : "text-text-primary"}>{entry.item}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {editable && !loading && entries.length > 0 && done < entries.length && (
        <p className="mt-2 text-xs text-warning-600">{entries.length - done} öğe eksik — rapor yine gönderilebilir.</p>
      )}
      {error && <p className="mt-2 text-xs text-danger-500">{error}</p>}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { Star } from "lucide-react";
import { Modal } from "@/components/Modal";
import { EmptyState } from "@/components/EmptyState";
import { api, ApiError } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Evaluation, Staff } from "@/lib/types";

interface EvaluationsModalProps {
  open: boolean;
  onClose: () => void;
  staff: Staff | null;
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Taslak",
  SUBMITTED: "Gönderildi",
  LOCKED: "Kilitli",
};

/**
 * Bir personelin aldığı değerlendirmelerin salt okunur listesi (OWNER/MANAGER
 * görünümü — değerlendiren burada gizlenmez, backend yalnızca STAFF/TEAM_LEAD
 * kendi kaydına baktığında evaluator alanını çıkarır).
 */
export function EvaluationsModal({ open, onClose, staff }: EvaluationsModalProps) {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!staff) return;
    setLoading(true);
    setError(null);
    api
      .get<{ data: Evaluation[] }>(`/evaluations?targetStaffId=${staff.id}`)
      .then((res) => setEvaluations(res.data))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Değerlendirmeler yüklenemedi"))
      .finally(() => setLoading(false));
  }, [staff]);

  useEffect(() => {
    if (open && staff) load();
  }, [open, staff, load]);

  if (!staff) return null;

  return (
    <Modal open={open} onClose={onClose} title={`${staff.user.fullName} — Değerlendirmeler`}>
      {error && <p className="mb-3 rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

      {loading ? (
        <p className="py-8 text-center text-sm text-text-faint">Yükleniyor...</p>
      ) : evaluations.length === 0 ? (
        <EmptyState icon={Star} title="Henüz değerlendirme yok" description="Bu personel için henüz bir değerlendirme oluşturulmamış." />
      ) : (
        <ul className="flex max-h-96 flex-col gap-3 overflow-y-auto">
          {evaluations.map((e) => (
            <li key={e.id} className="rounded-2xl border border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full bg-surface-subtle px-2.5 py-1 text-xs font-semibold text-text-secondary">
                  {STATUS_LABELS[e.status]}
                </span>
                <span className="text-xs text-text-faint">{formatDate(e.createdAt)}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-4">
                {e.averageScore !== null && (
                  <span className="font-mono text-sm font-semibold text-text-primary">Ortalama: {e.averageScore}/20</span>
                )}
                {e.managerScore !== null && (
                  <span className="font-mono text-sm text-text-secondary">Genel Puan: {e.managerScore}/20</span>
                )}
                {e.evaluator && <span className="text-xs text-text-faint">Değerlendiren: {e.evaluator.fullName}</span>}
              </div>
              {e.comment && <p className="mt-2 text-sm text-text-secondary">{e.comment}</p>}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { LoadingBlock } from "@/components/LoadingBlock";
import { CheckSquare, Square, ClipboardCheck } from "lucide-react";
import { Modal } from "@/components/Modal";
import { api, ApiError } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { OnboardingChecklist, OnboardingItem, Staff } from "@/lib/types";

interface OnboardingModalProps {
  open: boolean;
  onClose: () => void;
  staff: Staff | null;
  /** OWNER/MANAGER işaretler; STAFF/TEAM_LEAD kendi listesini salt-okunur görür. */
  editable: boolean;
}

/**
 * Bölüm U (5. tur): Personel → "İşe Alım Süreci" — Staff oluşturulunca
 * otomatik gelen 5 madde, ilerleme çubuğu, işaretleyen + tarih.
 */
export function OnboardingModal({ open, onClose, staff, editable }: OnboardingModalProps) {
  const [data, setData] = useState<OnboardingChecklist | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!staff) return;
    setLoading(true);
    setError(null);
    try {
      setData(await api.get<OnboardingChecklist>(`/staff/${staff.id}/onboarding`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "İşe alım listesi yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [staff]);

  useEffect(() => {
    if (open) load();
    else setData(null);
  }, [open, load]);

  async function toggle(item: OnboardingItem) {
    if (!staff || !editable) return;
    setBusyId(item.id);
    setError(null);
    try {
      const res = await api.patch<{ item: OnboardingItem; progress: OnboardingChecklist["progress"] }>(`/staff/${staff.id}/onboarding/${item.id}`, {
        isCompleted: !item.isCompleted,
      });
      setData((prev) => (prev ? { ...prev, items: prev.items.map((i) => (i.id === item.id ? res.item : i)), progress: res.progress } : prev));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Güncellenemedi");
    } finally {
      setBusyId(null);
    }
  }

  const progress = data?.progress;

  return (
    <Modal open={open} onClose={onClose} title={`İşe Alım Süreci${staff ? ` · ${staff.user.fullName}` : ""}`}>
      <div className="flex flex-col gap-4">
        {progress && (
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="font-semibold text-text-secondary">
                {progress.completed}/{progress.total} madde tamamlandı
              </span>
              <span className={`font-mono font-semibold ${progress.isComplete ? "text-primary-700" : "text-text-secondary"}`}>%{progress.percent}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
              <div className={`h-full rounded-full transition-all ${progress.isComplete ? "bg-primary-600" : "bg-primary-400"}`} style={{ width: `${progress.percent}%` }} />
            </div>
            {progress.isComplete && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-primary-700">
                <ClipboardCheck size={13} strokeWidth={2} />
                İşe alım süreci tamamlandı.
              </p>
            )}
          </div>
        )}

        {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

        {loading ? (
          <LoadingBlock rows={3} className="py-6" />
        ) : data && data.items.length === 0 ? (
          <p className="py-6 text-center text-sm text-text-faint">Bu personel için işe alım listesi yok (kayıt bu özellikten önce açılmış).</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {data?.items.map((item) => {
              const Icon = item.isCompleted ? CheckSquare : Square;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled={!editable || busyId === item.id}
                    onClick={() => toggle(item)}
                    className={`flex w-full items-start gap-3 py-3 text-left ${editable ? "hover:bg-surface-subtle" : "cursor-default"} rounded-xl px-2 transition disabled:opacity-70`}
                  >
                    <Icon size={18} strokeWidth={1.75} className={`mt-0.5 shrink-0 ${item.isCompleted ? "text-primary-600" : "text-text-faint"}`} />
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm ${item.isCompleted ? "text-text-secondary line-through" : "text-text-primary"}`}>{item.item}</span>
                      {item.isCompleted && item.completedAt && (
                        <span className="block text-xs text-text-faint">
                          {formatDate(item.completedAt)}
                          {item.completedBy ? ` · ${item.completedBy.fullName}` : ""}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {!editable && <p className="text-xs text-text-faint">Bu listeyi yalnızca yönetim işaretleyebilir.</p>}
      </div>
    </Modal>
  );
}

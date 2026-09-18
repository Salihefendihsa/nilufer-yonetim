"use client";

import { useCallback, useEffect, useState } from "react";
import { FileSignature, PauseCircle, PlayCircle } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/lib/ToastProvider";
import { formatDate } from "@/lib/format";
import type { Contract, Paginated } from "@/lib/types";

const STATUS_LABELS: Record<string, string> = { ACTIVE: "Aktif", RENEWED: "Yenilendi", EXPIRED: "Süresi Doldu", CANCELLED: "İptal" };

/**
 * Bölüm Q (4. tur): Müşteri Ana Sayfa → "Sözleşmelerim" — kendi sözleşmeleri ve
 * aktif olanlarda Duraklat / Devam Ettir. Duraklatılmış sözleşme için otomatik
 * iş üretimi durur (backend lib/cron.ts).
 */
export function MyContractsCard() {
  const { showToast } = useToast();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pauseTarget, setPauseTarget] = useState<Contract | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<Paginated<Contract>>("/contracts?limit=50");
      setContracts(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sözleşmeler yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(contract: Contract) {
    setBusyId(contract.id);
    try {
      await api.post(`/contracts/${contract.id}/${contract.isPaused ? "resume" : "pause"}`, {});
      showToast(contract.isPaused ? "Sözleşme devam ettirildi." : "Sözleşme duraklatıldı.");
      setPauseTarget(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "İşlem yapılamadı");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface-card p-6 shadow-card">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 ring-1 ring-primary-100">
          <FileSignature size={17} strokeWidth={1.75} />
        </span>
        <div>
          <h2 className="text-base font-semibold text-text-primary">Sözleşmelerim</h2>
          <p className="text-xs text-text-faint">Aktif bir sözleşmeyi geçici olarak duraklatabilirsiniz — periyodik işler o sürede planlanmaz.</p>
        </div>
      </div>

      {error && <p className="mb-3 rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

      {loading ? (
        <p className="py-6 text-center text-sm text-text-faint">Yükleniyor...</p>
      ) : contracts.length === 0 ? (
        <EmptyState icon={FileSignature} title="Sözleşmeniz yok" description="Bir sözleşme oluşturulduğunda burada görünür." />
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {contracts.map((c) => {
            const isActive = c.status === "ACTIVE";
            return (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium text-text-primary">
                    {c.serviceType ?? "Sözleşme"}
                    <span className="rounded-full bg-surface-subtle px-2 py-0.5 text-2xs font-semibold text-text-secondary">{STATUS_LABELS[c.status] ?? c.status}</span>
                    {c.isPaused && <span className="rounded-full bg-warning-50 px-2 py-0.5 text-2xs font-semibold text-warning-600">Duraklatıldı</span>}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {formatDate(c.startDate)} – {formatDate(c.endDate)}
                    {c.recurrenceType ? " · Periyodik" : ""}
                  </p>
                </div>
                {isActive && (
                  <button
                    type="button"
                    disabled={busyId === c.id}
                    onClick={() => (c.isPaused ? toggle(c) : setPauseTarget(c))}
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition disabled:opacity-50 ${
                      c.isPaused
                        ? "bg-primary-600 text-white hover:bg-primary-700"
                        : "border border-border bg-surface-base text-text-secondary hover:bg-surface-subtle"
                    }`}
                  >
                    {c.isPaused ? <PlayCircle size={14} strokeWidth={2} /> : <PauseCircle size={14} strokeWidth={2} />}
                    {c.isPaused ? "Devam Ettir" : "Duraklat"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={!!pauseTarget}
        title="Sözleşmeyi duraklat"
        description="Duraklatılan sözleşme için periyodik işler planlanmaz. İstediğiniz zaman devam ettirebilirsiniz."
        confirmLabel="Duraklat"
        loading={busyId === pauseTarget?.id}
        onConfirm={() => pauseTarget && toggle(pauseTarget)}
        onClose={() => setPauseTarget(null)}
      />
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { History, RotateCcw } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { api, ApiError } from "@/lib/api";
import { ROLE_LABELS } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import type { Staff, Paginated } from "@/lib/types";
import { ReasonModal } from "./ReasonModal";

/**
 * "Geçmiş Personel" — GET /staff?includeArchived=true. Yalnızca OWNER'a
 * açık, salt okunur (iş/maaş/değerlendirme geçmişi hâlâ ilgili sayfalardan
 * görülebilir ama burada düzenlenemez) — tek aksiyon "Geri Aktif Et".
 */
export function ArchivedStaffTab() {
  const [rows, setRows] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reactivateTarget, setReactivateTarget] = useState<Staff | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<Paginated<Staff>>("/staff?includeArchived=true&limit=100");
      setRows(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Geçmiş personel yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p className="py-16 text-center text-sm text-text-faint">Yükleniyor...</p>;
  if (error) return <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>;
  if (rows.length === 0) {
    return <EmptyState icon={History} title="Geçmiş personel yok" description="Terfi ettirilen veya işten çıkarılan personel burada listelenir." />;
  }

  return (
    <div className="flex flex-col gap-6">
      <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface-card shadow-card">
        {rows.map((staff) => (
          <li key={staff.id} className="flex items-center justify-between gap-3 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-surface-muted text-sm font-semibold text-text-secondary">
                {staff.user.fullName[0]?.toUpperCase() ?? "?"}
              </span>
              <div>
                <p className="text-sm font-medium text-text-primary">{staff.user.fullName}</p>
                <p className="text-xs text-text-secondary">
                  {staff.position} · {ROLE_LABELS[staff.user.role as keyof typeof ROLE_LABELS] ?? staff.user.role}
                </p>
                {staff.archivedAt && (
                  <p className="text-xs text-text-faint">Arşivlendi: {formatDate(staff.archivedAt)}</p>
                )}
              </div>
            </div>
            {staff.user.role === "MANAGER" ? (
              <span className="text-xs text-text-faint">Müdür&apos;e terfi etti — Müdürler sekmesinden düşürülebilir</span>
            ) : (
              <button
                type="button"
                onClick={() => setReactivateTarget(staff)}
                className="flex items-center gap-1.5 rounded-xl border border-primary-100 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700 transition hover:bg-primary-100"
              >
                <RotateCcw size={14} strokeWidth={1.75} />
                Geri Aktif Et
              </button>
            )}
          </li>
        ))}
      </ul>

      <ReasonModal
        open={!!reactivateTarget}
        onClose={() => setReactivateTarget(null)}
        onDone={() => {
          setReactivateTarget(null);
          load();
        }}
        title="Geri Aktif Et"
        description={`"${reactivateTarget?.user.fullName}" yeniden aktif edilecek ve tekrar giriş yapabilecek.`}
        confirmLabel="Geri Aktif Et"
        onSubmit={(reason) => api.post(`/users/${reactivateTarget!.userId}/reactivate`, { reason })}
      />
    </div>
  );
}

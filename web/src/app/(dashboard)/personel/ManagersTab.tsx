"use client";

import { useCallback, useEffect, useState } from "react";
import { Users2, ArrowDownCircle, UserX } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { api, ApiError } from "@/lib/api";
import type { UnlinkedUser } from "@/lib/types";
import { DemoteModal } from "./DemoteModal";
import { ReasonModal } from "./ReasonModal";

/**
 * GET /users?role=MANAGER — Personel sayfasındaki mevcut liste yalnızca
 * Staff kayıtlarını (STAFF/TEAM_LEAD) gösteriyordu, MANAGER'ların kendi
 * Staff kaydı olmadığı için (bkz. şema yorumu) burada ayrı bir görünüm.
 */
export function ManagersTab() {
  const [managers, setManagers] = useState<UnlinkedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [demoteTarget, setDemoteTarget] = useState<UnlinkedUser | null>(null);
  const [terminateTarget, setTerminateTarget] = useState<UnlinkedUser | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: UnlinkedUser[] }>("/users?role=MANAGER");
      setManagers(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Müdürler yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p className="py-16 text-center text-sm text-text-faint">Yükleniyor...</p>;
  if (error) return <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>;
  if (managers.length === 0) {
    return <EmptyState icon={Users2} title="Henüz müdür yok" description="Müdür rolündeki kullanıcılar burada listelenir." />;
  }

  return (
    <div className="flex flex-col gap-6">
      <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface-card shadow-card">
        {managers.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-3 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-600 text-sm font-semibold text-white">
                {m.fullName[0]?.toUpperCase() ?? "?"}
              </span>
              <div>
                <p className="text-sm font-medium text-text-primary">{m.fullName}</p>
                <p className="text-xs text-text-secondary">{m.email}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDemoteTarget(m)}
                className="flex items-center gap-1.5 rounded-xl border border-border bg-surface-base px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:border-border-strong hover:bg-surface-subtle hover:text-text-primary"
              >
                <ArrowDownCircle size={14} strokeWidth={1.75} />
                Personel&apos;e Düşür
              </button>
              <button
                type="button"
                onClick={() => setTerminateTarget(m)}
                className="flex items-center gap-1.5 rounded-xl border border-danger-100 bg-danger-50 px-3 py-1.5 text-xs font-medium text-danger-500 transition hover:bg-danger-100"
              >
                <UserX size={14} strokeWidth={1.75} />
                İşten Çıkar
              </button>
            </div>
          </li>
        ))}
      </ul>

      <DemoteModal
        open={!!demoteTarget}
        onClose={() => setDemoteTarget(null)}
        manager={demoteTarget}
        onDone={() => {
          setDemoteTarget(null);
          load();
        }}
      />

      <ReasonModal
        open={!!terminateTarget}
        onClose={() => setTerminateTarget(null)}
        onDone={() => {
          setTerminateTarget(null);
          load();
        }}
        title="İşten Çıkar"
        description={`"${terminateTarget?.fullName}" işten çıkarılacak. Hesabı devre dışı kalır, tüm oturumları sonlanır; hiçbir veri silinmez.`}
        confirmLabel="İşten Çıkar"
        danger
        onSubmit={(reason) => api.post(`/users/${terminateTarget!.id}/terminate`, { reason })}
      />
    </div>
  );
}

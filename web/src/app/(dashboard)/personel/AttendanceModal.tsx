"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Modal } from "@/components/Modal";
import { api, ApiError } from "@/lib/api";
import { formatDate, formatTime } from "@/lib/format";
import type { AttendanceMonth, Staff } from "@/lib/types";

interface AttendanceModalProps {
  open: boolean;
  onClose: () => void;
  staff: Staff | null;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Bölüm AR (9. tur): OWNER/MANAGER → personel kartı → "Puantaj": aylık
 * giriş/çıkış listesi + toplam saat (GET /staff/:id/attendance?month=).
 */
export function AttendanceModal({ open, onClose, staff }: AttendanceModalProps) {
  const [cursor, setCursor] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [data, setData] = useState<AttendanceMonth | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const key = useMemo(() => monthKey(cursor), [cursor]);
  const isCurrent = key === monthKey(new Date());
  const monthLabel = cursor.toLocaleDateString("tr-TR", { month: "long", year: "numeric" });

  useEffect(() => {
    if (!open) return;
    setCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  }, [open]);

  useEffect(() => {
    if (!open || !staff) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get<AttendanceMonth>(`/staff/${staff.id}/attendance?month=${key}`)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Puantaj yüklenemedi");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, staff, key]);

  return (
    <Modal open={open} onClose={onClose} title={staff ? `${staff.user.fullName} — Puantaj` : "Puantaj"}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))} className="rounded-xl p-1.5 text-text-secondary transition hover:bg-surface-subtle" aria-label="Önceki ay">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold capitalize text-text-primary">{monthLabel}</span>
          <button type="button" disabled={isCurrent} onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))} className="rounded-xl p-1.5 text-text-secondary transition hover:bg-surface-subtle disabled:opacity-40" aria-label="Sonraki ay">
            <ChevronRight size={16} />
          </button>
        </div>

        {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

        {loading || !data ? (
          <p className="text-sm text-text-secondary">Yükleniyor...</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-surface-subtle px-4 py-3">
                <p className="text-xs text-text-secondary">Toplam saat</p>
                <p className="font-mono text-lg font-bold text-text-primary">{data.totalHours}</p>
              </div>
              <div className="rounded-2xl bg-surface-subtle px-4 py-3">
                <p className="text-xs text-text-secondary">Tam gün</p>
                <p className="font-mono text-lg font-bold text-text-primary">{data.completedDays}</p>
              </div>
              <div className="rounded-2xl bg-surface-subtle px-4 py-3">
                <p className="text-xs text-text-secondary">Çıkışsız</p>
                <p className={`font-mono text-lg font-bold ${data.openCount > 0 ? "text-warning-600" : "text-text-primary"}`}>{data.openCount}</p>
              </div>
            </div>
            {data.data.length === 0 ? (
              <p className="text-sm text-text-secondary">Bu ay puantaj kaydı yok.</p>
            ) : (
              <ul className="flex max-h-72 flex-col gap-1.5 overflow-y-auto">
                {data.data.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface-subtle px-4 py-2">
                    <span className="text-sm text-text-primary">{formatDate(r.date)}</span>
                    <span className="text-xs text-text-secondary">
                      {formatTime(r.clockInAt)} → {r.clockOutAt ? formatTime(r.clockOutAt) : <span className="text-warning-600">çıkış yok</span>}
                    </span>
                    <span className="font-mono text-sm font-semibold text-text-primary">{r.workedHours !== null ? `${r.workedHours} s` : "—"}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

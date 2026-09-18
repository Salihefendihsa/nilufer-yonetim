"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { CalendarOff, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/lib/ToastProvider";
import type { StaffUnavailability } from "@/lib/types";

interface UnavailabilityPanelProps {
  /** Takvimde seçili gün (YYYY-MM-DD) — form bu günü işaretler. */
  selectedDate: string;
  /** Görüntülenen ay (YYYY-MM) — liste bu aya göre yüklenir. */
  month: string;
  /** Ay içindeki işaretli günler değişince takvim hücreleri de güncellensin. */
  onChanged?: (rows: StaffUnavailability[]) => void;
}

function formatDay(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function describe(row: StaffUnavailability): string {
  return row.startTime && row.endTime ? `${row.startTime} – ${row.endTime}` : "Tüm gün";
}

/**
 * Bölüm K (3. tur): STAFF/TEAM_LEAD'in kendi "müsait değilim" işaretleri —
 * izin talebinden hafif, onay gerektirmeyen, anlık. Takvimde seçilen gün için
 * tüm gün veya saat aralığı işaretlenir; ay listesi silinebilir.
 */
export function UnavailabilityPanel({ selectedDate, month, onChanged }: UnavailabilityPanelProps) {
  const { showToast } = useToast();
  const [rows, setRows] = useState<StaffUnavailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"all_day" | "range">("all_day");
  const [startTime, setStartTime] = useState("13:00");
  const [endTime, setEndTime] = useState("17:00");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const isPast = selectedDate < todayKey;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: StaffUnavailability[] }>(`/staff/me/unavailability?month=${month}`);
      setRows(res.data);
      onChanged?.(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Müsaitlik kayıtları yüklenemedi");
    } finally {
      setLoading(false);
    }
    // onChanged her render'da yeni referans olabilir; yalnızca ay değişince yeniden yükle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === "range" && startTime >= endTime) {
      setError("Başlangıç saati bitişten önce olmalıdır");
      return;
    }
    setSaving(true);
    try {
      await api.post("/staff/me/unavailability", {
        date: selectedDate,
        startTime: mode === "range" ? startTime : undefined,
        endTime: mode === "range" ? endTime : undefined,
        reason: reason.trim() || undefined,
      });
      setReason("");
      showToast(`${formatDay(selectedDate)} için müsait değilsiniz olarak işaretlendi.`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await api.delete(`/staff/me/unavailability/${id}`);
      showToast("İşaret kaldırıldı.");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Silinemedi");
    } finally {
      setDeletingId(null);
    }
  }

  const selectedRows = rows.filter((r) => r.date === selectedDate);

  return (
    <div className="rounded-2xl border border-border bg-surface-card p-6 shadow-card">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-warning-50 text-warning-600 ring-1 ring-warning-100">
          <CalendarOff size={17} strokeWidth={1.75} />
        </span>
        <div>
          <h2 className="text-base font-semibold text-text-primary">Müsaitlik</h2>
          <p className="text-xs text-text-faint">Müsait olmadığınız gün/saatleri işaretleyin — iş atarken yönetici uyarı görür.</p>
        </div>
      </div>

      {error && <p className="mb-3 rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-border bg-surface-subtle p-4">
        <p className="text-sm font-medium text-text-primary">{formatDay(selectedDate)}</p>
        {isPast ? (
          <p className="text-xs text-text-faint">Geçmiş bir gün için işaretleme yapılamaz — takvimden bugün veya sonrasını seçin.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["all_day", "Tüm gün"],
                  ["range", "Saat aralığı"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    mode === value ? "bg-primary-600 text-white" : "bg-surface-base text-text-secondary ring-1 ring-border hover:bg-surface-muted"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {mode === "range" && (
              <div className="flex items-center gap-2">
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="input" required />
                <span className="text-xs text-text-faint">–</span>
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="input" required />
              </div>
            )}
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={300}
              className="input"
              placeholder="Neden (opsiyonel) — örn. doktor randevusu"
            />
            <button
              type="submit"
              disabled={saving}
              className="rounded-2xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition hover:bg-primary-700 disabled:opacity-60"
            >
              {saving ? "Kaydediliyor..." : "Müsait değilim olarak işaretle"}
            </button>
          </>
        )}

        {selectedRows.length > 0 && (
          <ul className="mt-1 flex flex-col gap-1.5 border-t border-border pt-3">
            {selectedRows.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-text-secondary">
                  <span className="font-semibold text-warning-600">{describe(r)}</span>
                  {r.reason ? ` · ${r.reason}` : ""}
                </span>
                <button
                  type="button"
                  disabled={deletingId === r.id}
                  onClick={() => handleDelete(r.id)}
                  aria-label="İşareti kaldır"
                  className="rounded-lg p-1 text-text-faint transition hover:bg-danger-50 hover:text-danger-500 disabled:opacity-50"
                >
                  <Trash2 size={14} strokeWidth={1.75} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </form>

      <div className="mt-4">
        <p className="mb-2 text-xs font-semibold text-text-faint">Bu ayki işaretlerim</p>
        {loading ? (
          <p className="py-4 text-center text-xs text-text-faint">Yükleniyor...</p>
        ) : rows.length === 0 ? (
          <p className="py-4 text-center text-xs text-text-faint">Bu ay için işaret yok.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span>
                  <span className="font-medium text-text-primary">{formatDay(r.date)}</span>
                  <span className="text-text-secondary"> · {describe(r)}</span>
                  {r.reason ? <span className="text-text-faint"> · {r.reason}</span> : null}
                </span>
                <button
                  type="button"
                  disabled={deletingId === r.id}
                  onClick={() => handleDelete(r.id)}
                  aria-label="İşareti kaldır"
                  className="rounded-lg p-1 text-text-faint transition hover:bg-danger-50 hover:text-danger-500 disabled:opacity-50"
                >
                  <Trash2 size={14} strokeWidth={1.75} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

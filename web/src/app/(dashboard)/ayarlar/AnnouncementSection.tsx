"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { SectionTitle } from "@/components/SectionTitle";
import { Megaphone, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/lib/ToastProvider";
import { formatDateTime } from "@/lib/format";
import type { Announcement } from "@/lib/types";

/**
 * Bölüm AK (8. tur): OWNER → Ayarlar → "Duyuru Şeridi".
 * Tek aktif duyuru: yenisi yayınlanınca önceki otomatik pasifleşir.
 * Yayın/kaldırma sonrası şeridi güncellemek için sayfa yenilenir (banner layout'ta bir kez yüklenir).
 */
export function AnnouncementSection() {
  const { showToast } = useToast();
  const [rows, setRows] = useState<Announcement[]>([]);
  const [message, setMessage] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ data: Announcement[] }>("/announcements");
      setRows(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Duyurular yüklenemedi");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function publish(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/announcements", {
        message: message.trim(),
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      });
      showToast("Duyuru yayınlandı.");
      setMessage("");
      setExpiresAt("");
      window.location.reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Duyuru yayınlanamadı");
      setBusy(false);
    }
  }

  async function deactivate(id: string) {
    setBusy(true);
    try {
      await api.delete(`/announcements/${id}`);
      showToast("Duyuru kaldırıldı.");
      window.location.reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Duyuru kaldırılamadı");
      setBusy(false);
    }
  }

  const active = rows.find((r) => r.isActive && (!r.expiresAt || new Date(r.expiresAt) > new Date()));

  return (
    <div className="flex flex-col rounded-2xl border border-border bg-surface-card p-6 shadow-card">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 ring-1 ring-primary-100">
          <Megaphone size={17} strokeWidth={1.75} />
        </span>
        <div>
          <SectionTitle>Duyuru Şeridi</SectionTitle>
          <p className="mt-0.5 text-sm text-text-secondary">Tüm kullanıcıların ekranının üstünde görünen tek satırlık duyuru. Yeni duyuru öncekini otomatik kaldırır.</p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-4">
        {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

        {active ? (
          <div className="flex items-start justify-between gap-3 rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-primary">{active.message}</p>
              <p className="mt-0.5 text-xs text-text-secondary">
                {active.createdBy?.fullName ?? "—"} · {formatDateTime(active.createdAt)}
                {active.expiresAt ? ` · bitiş ${formatDateTime(active.expiresAt)}` : ""}
              </p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => deactivate(active.id)}
              className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-danger-500 transition hover:bg-danger-50 disabled:opacity-60"
            >
              <Trash2 size={13} strokeWidth={2} /> Kaldır
            </button>
          </div>
        ) : (
          <p className="text-sm text-text-secondary">Şu an aktif duyuru yok.</p>
        )}

        <form onSubmit={publish} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Duyuru metni</label>
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={500}
              required
              placeholder="Örn. 25 Ekim Cumartesi bakım nedeniyle sistem 02:00–04:00 arası kapalı olacak."
              className="input"
            />
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-secondary">Bitiş (opsiyonel)</label>
              <input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="input" />
            </div>
            <button
              type="submit"
              disabled={busy || !message.trim()}
              className="rounded-2xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-60"
            >
              {busy ? "Yayınlanıyor..." : "Yayınla"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

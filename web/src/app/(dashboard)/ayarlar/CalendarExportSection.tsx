"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarPlus, Copy, Download, RefreshCw } from "lucide-react";
import { api, ApiError, downloadFile } from "@/lib/api";
import { useToast } from "@/lib/ToastProvider";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { CalendarToken } from "@/lib/types";

/**
 * Bölüm AP (9. tur): STAFF/TEAM_LEAD → Ayarlar → "Takvimimi Dışa Aktar".
 * - ICS indirme: GET /staff/me/calendar.ics (Authorization header'lı Blob).
 * - Abonelik linki: GET /staff/me/calendar-token → token'lı /calendar/<token>.ics;
 *   webcal:// kısayolu ve "Google Takvim'e Ekle" (Google, URL'den abone olur).
 * - "Token'ı Yenile": eski link anında geçersiz olur (paylaşılmışsa güvenlik için).
 */
export function CalendarExportSection() {
  const { showToast } = useToast();
  const [info, setInfo] = useState<CalendarToken | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setInfo(await api.get<CalendarToken>("/staff/me/calendar-token"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Takvim linki alınamadı");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      showToast("Link kopyalandı.");
    } catch {
      setError("Kopyalanamadı — linki elle seçip kopyalayın.");
    }
  }

  async function handleDownload() {
    setBusy(true);
    setError(null);
    try {
      await downloadFile("/staff/me/calendar.ics", "is-programim.ics");
      showToast("Takvim dosyası indirildi.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "İndirilemedi");
    } finally {
      setBusy(false);
    }
  }

  async function handleRotate() {
    setBusy(true);
    setError(null);
    try {
      setInfo(await api.post<CalendarToken>("/staff/me/calendar-token/rotate"));
      setConfirmRotate(false);
      showToast("Yeni link üretildi; eski link artık çalışmaz.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Yenilenemedi");
    } finally {
      setBusy(false);
    }
  }

  const googleUrl = info ? `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(info.webcalUrl)}` : null;

  return (
    <div className="flex flex-col rounded-2xl border border-border bg-surface-card p-6 shadow-card">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 ring-1 ring-primary-100">
          <CalendarPlus size={17} strokeWidth={1.75} />
        </span>
        <div>
          <h2 className="text-base font-semibold text-text-primary">Takvimimi Dışa Aktar</h2>
          <p className="mt-0.5 text-sm text-text-secondary">
            Önümüzdeki {info?.windowDays ?? 30} gündeki atanmış işlerinizi telefonunuzun takvim uygulamasına aktarın. Abonelik linki otomatik güncellenir; dosya indirme
            tek seferliktir.
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3">
        {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

        {loading ? (
          <p className="text-sm text-text-secondary">Yükleniyor...</p>
        ) : info ? (
          <>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-secondary">Abonelik linki (gizli — yalnızca size ait)</label>
              <div className="flex gap-2">
                <input readOnly value={info.url} onFocus={(e) => e.currentTarget.select()} className="input flex-1 font-mono text-xs" />
                <button type="button" onClick={() => copy(info.url)} className="inline-flex items-center gap-1.5 rounded-2xl border border-border bg-surface-base px-3 py-2 text-xs font-medium text-text-secondary transition hover:bg-surface-subtle">
                  <Copy size={13} /> Kopyala
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={googleUrl ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-2xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700"
              >
                <CalendarPlus size={15} strokeWidth={2} />
                Google Takvim&apos;e Ekle
              </a>
              <a href={info.webcalUrl} className="inline-flex items-center gap-2 rounded-2xl border border-border bg-surface-base px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:bg-surface-subtle">
                <CalendarPlus size={15} strokeWidth={2} />
                Apple / Outlook (webcal)
              </a>
              <button type="button" onClick={handleDownload} disabled={busy} className="inline-flex items-center gap-2 rounded-2xl border border-border bg-surface-base px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:bg-surface-subtle disabled:opacity-60">
                <Download size={15} strokeWidth={2} />
                .ics İndir
              </button>
              <button type="button" onClick={() => setConfirmRotate(true)} disabled={busy} className="inline-flex items-center gap-2 rounded-2xl border border-danger-100 bg-danger-50 px-4 py-2.5 text-sm font-medium text-danger-500 transition hover:bg-danger-100 disabled:opacity-60">
                <RefreshCw size={15} strokeWidth={2} />
                Token&apos;ı Yenile
              </button>
            </div>
            <p className="text-xs text-text-secondary">
              Bu linki bilen herkes iş programınızı görebilir. Yanlışlıkla paylaştıysanız &quot;Token&apos;ı Yenile&quot; ile eski linki geçersiz kılın.
            </p>
          </>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirmRotate}
        onClose={() => setConfirmRotate(false)}
        onConfirm={handleRotate}
        title="Takvim linkini yenile"
        description="Eski abonelik linki anında çalışmayı durdurur; takvim uygulamanızda yeni linkle tekrar abone olmanız gerekir."
        loading={busy}
      />
    </div>
  );
}

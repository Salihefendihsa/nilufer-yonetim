"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { ApiError, downloadFile } from "@/lib/api";
import { useToast } from "@/lib/ToastProvider";

/**
 * Bölüm AJ (8. tur): CUSTOMER → Ayarlar → "Verilerimi İndir" (KVKK veri taşınabilirliği).
 * GET /customers/me/data-export JSON'u Authorization header'lı Blob indirme ile alınır
 * (token'sız URL yok). Belgeler için yalnızca META gelir.
 */
export function CustomerDataExportSection() {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    setBusy(true);
    setError(null);
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      await downloadFile("/customers/me/data-export", `verilerim-${stamp}.json`);
      showToast("Verileriniz indirildi.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Veriler indirilemedi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col rounded-2xl border border-border bg-surface-card p-6 shadow-card">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 ring-1 ring-primary-100">
          <Download size={17} strokeWidth={1.75} />
        </span>
        <div>
          <h2 className="text-base font-semibold text-text-primary">Verilerimi İndir</h2>
          <p className="mt-0.5 text-sm text-text-secondary">
            Sistemde size ait kayıtların (profil, işler, sözleşmeler, ödemeler, randevu talepleri ve belge listesi) bir kopyasını JSON dosyası olarak indirin.
          </p>
        </div>
      </div>
      <div className="mt-5 flex flex-col gap-3">
        {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}
        <button
          type="button"
          onClick={handleDownload}
          disabled={busy}
          className="inline-flex items-center gap-2 self-start rounded-2xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-60"
        >
          <Download size={15} strokeWidth={2} />
          {busy ? "Hazırlanıyor..." : "Verilerimi İndir (JSON)"}
        </button>
      </div>
    </div>
  );
}

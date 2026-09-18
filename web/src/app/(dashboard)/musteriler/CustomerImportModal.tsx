"use client";

import { useRef, useState } from "react";
import { Upload, CheckCircle2, SkipForward, AlertTriangle } from "lucide-react";
import { Modal } from "@/components/Modal";
import { ApiError, uploadFile } from "@/lib/api";
import type { CustomerImportResult } from "@/lib/types";

/**
 * Bölüm AL (8. tur): "CSV İçe Aktar" — dosya seç → POST /customers/import (multipart)
 * → sonuç özeti (eklendi / atlandı / hatalı satırlar). Satırlar tek tek işlenir;
 * hatalı satır diğerlerini engellemez.
 */
export function CustomerImportModal({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CustomerImportResult | null>(null);

  function reset() {
    setFile(null);
    setError(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function submit() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await uploadFile<CustomerImportResult>("/customers/import", fd);
      setResult(res);
      if (res.created > 0) onImported();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "İçe aktarma başarısız");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="CSV İçe Aktar">
      <div className="flex flex-col gap-4">
        {!result ? (
          <>
            <div className="rounded-2xl border border-border bg-surface-subtle px-4 py-3 text-xs text-text-secondary">
              <p className="font-semibold text-text-primary">Beklenen sütunlar (ilk satır başlık):</p>
              <p className="mt-1 font-mono">fullName, phone, email, address, district</p>
              <p className="mt-1">
                <span className="font-medium">fullName</span> ve <span className="font-medium">phone</span> zorunlu. Ayraç virgül veya noktalı virgül olabilir. Telefonu zaten kayıtlı satırlar atlanır (güncellenmez).
              </p>
            </div>

            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-text-secondary file:mr-3 file:rounded-xl file:border-0 file:bg-primary-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary-600 hover:file:bg-primary-100"
            />

            {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={handleClose} className="rounded-2xl border border-border px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:bg-surface-subtle">
                Vazgeç
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!file || busy}
                className="inline-flex items-center gap-2 rounded-2xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-60"
              >
                <Upload size={15} strokeWidth={2} />
                {busy ? "Aktarılıyor..." : "İçe Aktar"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-success-100 bg-success-50 px-3 py-3 text-center">
                <CheckCircle2 size={18} className="mx-auto text-success-600" />
                <p className="mt-1 text-xl font-bold text-success-600">{result.created}</p>
                <p className="text-2xs font-semibold uppercase tracking-wide text-success-600">Eklendi</p>
              </div>
              <div className="rounded-2xl border border-border bg-surface-subtle px-3 py-3 text-center">
                <SkipForward size={18} className="mx-auto text-text-secondary" />
                <p className="mt-1 text-xl font-bold text-text-primary">{result.skipped}</p>
                <p className="text-2xs font-semibold uppercase tracking-wide text-text-secondary">Atlandı</p>
              </div>
              <div className="rounded-2xl border border-danger-100 bg-danger-50 px-3 py-3 text-center">
                <AlertTriangle size={18} className="mx-auto text-danger-500" />
                <p className="mt-1 text-xl font-bold text-danger-500">{result.errors.length}</p>
                <p className="text-2xs font-semibold uppercase tracking-wide text-danger-500">Hatalı</p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="max-h-56 overflow-y-auto rounded-2xl border border-border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-subtle text-text-secondary">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Satır</th>
                      <th className="px-3 py-2 font-semibold">Neden</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.map((e) => (
                      <tr key={e.row} className="border-t border-border">
                        <td className="px-3 py-2 font-mono">{e.row}</td>
                        <td className="px-3 py-2 text-text-secondary">{e.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={reset} className="rounded-2xl border border-border px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:bg-surface-subtle">
                Başka dosya
              </button>
              <button type="button" onClick={handleClose} className="rounded-2xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700">
                Kapat
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

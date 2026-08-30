"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Modal } from "@/components/Modal";
import { api, ApiError } from "@/lib/api";

interface JobReportModalProps {
  open: boolean;
  onClose: () => void;
  onCompleted: () => void;
  jobId: string | null;
}

export function JobReportModal({ open, onClose, onCompleted, jobId }: JobReportModalProps) {
  const [productsUsed, setProductsUsed] = useState("");
  const [dosage, setDosage] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setProductsUsed("");
      setDosage("");
      setNote("");
      setError(null);
    }
  }, [open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!jobId) return;
    setError(null);
    setSaving(true);

    try {
      await api.post(`/jobs/${jobId}/report`, {
        productsUsed,
        dosage,
        notes: note || undefined,
      });
      await api.patch(`/jobs/${jobId}`, { status: "COMPLETED" });
      onCompleted();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Tamamlanamadı, tekrar deneyin");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="İşi Tamamla">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Kullanılan Ürün</label>
          <input
            required
            value={productsUsed}
            onChange={(e) => setProductsUsed(e.target.value)}
            className="input"
            placeholder="Örn. Deltamethrin"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Doz</label>
          <input required value={dosage} onChange={(e) => setDosage(e.target.value)} className="input" placeholder="Örn. 5ml/L" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Not (opsiyonel)</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} className="input" rows={3} />
        </div>

        {error && <p className="rounded-2xl bg-primary-red/10 px-4 py-3 text-sm text-primary-redLight">{error}</p>}

        <div className="mt-2 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-2xl px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:bg-white/5">
            Vazgeç
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-2xl bg-gradient-to-r from-primary-green to-primary-green/90 px-4 py-2.5 text-sm font-semibold text-white transition hover:shadow-[0_0_20px_rgba(212,174,61,0.22)] disabled:opacity-60"
          >
            {saving ? "Kaydediliyor..." : "Tamamla"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

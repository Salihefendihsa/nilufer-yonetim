"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Modal } from "@/components/Modal";
import { api, ApiError } from "@/lib/api";

interface AdvanceRequestModalProps {
  open: boolean;
  onClose: () => void;
  onSent: () => void;
}

export function AdvanceRequestModal({ open, onClose, onSent }: AdvanceRequestModalProps) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount("");
      setReason("");
      setError(null);
    }
  }, [open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      await api.post("/advances", { amount: Number(amount), reason });
      onSent();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Talep gönderilemedi, tekrar deneyin");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Avans Talep Et">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Tutar (₺)</label>
          <input required type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="input" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Neden</label>
          <textarea required value={reason} onChange={(e) => setReason(e.target.value)} className="input" rows={3} />
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
            {saving ? "Gönderiliyor..." : "Talebi Gönder"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Modal } from "@/components/Modal";
import { api, ApiError } from "@/lib/api";
import type { Customer } from "@/lib/types";

interface ContractFormModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  customers: Customer[];
}

const STATUS_OPTIONS = ["ACTIVE", "RENEWED", "EXPIRED", "CANCELLED"];
const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Aktif",
  RENEWED: "Yenilendi",
  EXPIRED: "Süresi Doldu",
  CANCELLED: "İptal Edildi",
};

export function ContractFormModal({ open, onClose, onSaved, customers }: ContractFormModalProps) {
  const [customerId, setCustomerId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [durationMonths, setDurationMonths] = useState("12");
  const [status, setStatus] = useState(STATUS_OPTIONS[0]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setCustomerId("");
      setStartDate("");
      setEndDate("");
      setDurationMonths("12");
      setStatus(STATUS_OPTIONS[0]);
      setError(null);
    }
  }, [open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      await api.post("/contracts", {
        customerId,
        startDate,
        endDate,
        durationMonths: Number(durationMonths),
        status,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kaydedilemedi, tekrar deneyin");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Yeni Sözleşme">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Müşteri</label>
          <select required value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="input">
            <option value="" disabled>
              Seçin
            </option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullName}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Başlangıç</label>
            <input required type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Bitiş</label>
            <input required type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input" />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Süre (ay)</label>
          <input
            required
            type="number"
            min={1}
            value={durationMonths}
            onChange={(e) => setDurationMonths(e.target.value)}
            className="input"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Durum</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="input">
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
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
            {saving ? "Kaydediliyor..." : "Oluştur"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

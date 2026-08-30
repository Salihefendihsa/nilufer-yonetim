"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Modal } from "@/components/Modal";
import { api, ApiError } from "@/lib/api";
import type { Customer, Staff } from "@/lib/types";

interface JobFormModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  customers: Customer[];
  staff: Staff[];
}

export function JobFormModal({ open, onClose, onSaved, customers, staff }: JobFormModalProps) {
  const [customerId, setCustomerId] = useState("");
  const [assignedStaffId, setAssignedStaffId] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [notes, setNotes] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setCustomerId("");
      setAssignedStaffId("");
      setServiceType("");
      setScheduledAt("");
      setNotes("");
      setPrice("");
      setError(null);
    }
  }, [open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      await api.post("/jobs", {
        customerId,
        assignedStaffId: assignedStaffId || undefined,
        serviceType,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        notes: notes || undefined,
        price: price ? Number(price) : undefined,
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
    <Modal open={open} onClose={onClose} title="Yeni İş">
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

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Personel (opsiyonel)</label>
          <select value={assignedStaffId} onChange={(e) => setAssignedStaffId(e.target.value)} className="input">
            <option value="">Atanmadı</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.user.fullName}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Hizmet Türü</label>
          <input
            required
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value)}
            className="input"
            placeholder="Örn. Genel İlaçlama"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Tarih ve Saat (opsiyonel)</label>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="input"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Ücret (₺, opsiyonel)</label>
          <input type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="input" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Not (opsiyonel)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input" rows={3} />
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

"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Modal } from "@/components/Modal";
import { useToast } from "@/lib/ToastProvider";
import { api, ApiError } from "@/lib/api";
import type { Customer, Job, ServiceType, Staff } from "@/lib/types";

const OTHER_SERVICE_TYPE = "__diger__";

interface JobFormModalProps {
  open: boolean;
  onClose: () => void;
  /** Oluşturulan iş (Bölüm J: randevu talebine bağlamak için id gerekir). */
  onSaved: (job: Job) => void;
  customers: Customer[];
  staff: Staff[];
  /** Bölüm E (2. tur): Sözleşmeler → "Şimdi İş Oluştur" kısayolundan önceden doldurulmuş değerler. */
  prefill?: { customerId?: string; serviceType?: string; scheduledAt?: string; notes?: string };
}

export function JobFormModal({ open, onClose, onSaved, customers, staff, prefill }: JobFormModalProps) {
  const [customerId, setCustomerId] = useState("");
  const [assignedStaffId, setAssignedStaffId] = useState("");
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [serviceTypeSelect, setServiceTypeSelect] = useState("");
  const [serviceTypeOther, setServiceTypeOther] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [scheduledEndAt, setScheduledEndAt] = useState("");
  const [notes, setNotes] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (open) {
      setCustomerId(prefill?.customerId ?? "");
      setAssignedStaffId("");
      setServiceTypeSelect("");
      setServiceTypeOther(prefill?.serviceType ?? "");
      setScheduledAt(prefill?.scheduledAt ?? "");
      setScheduledEndAt("");
      setNotes(prefill?.notes ?? "");
      setPrice("");
      setError(null);
      api
        .get<{ data: ServiceType[] }>("/service-types")
        .then((res) => {
          const active = res.data.filter((s) => s.isActive);
          setServiceTypes(active);
          // Sözleşmedeki hizmet türü mevcut listede varsa doğrudan seç, yoksa "Diğer" ile serbest metin olarak doldur.
          if (prefill?.serviceType) {
            const matched = active.find((s) => s.name === prefill.serviceType);
            setServiceTypeSelect(matched ? matched.name : OTHER_SERVICE_TYPE);
          }
        })
        .catch(() => setServiceTypes([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const serviceType = serviceTypeSelect === OTHER_SERVICE_TYPE ? serviceTypeOther : serviceTypeSelect;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const created = await api.post<Job>("/jobs", {
        customerId,
        assignedStaffId: assignedStaffId || undefined,
        serviceType,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        scheduledEndAt: scheduledEndAt ? new Date(scheduledEndAt).toISOString() : undefined,
        notes: notes || undefined,
        price: price ? Number(price) : undefined,
      });
      onSaved(created);
      onClose();
      showToast("İş oluşturuldu.");
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
          <select
            required
            value={serviceTypeSelect}
            onChange={(e) => setServiceTypeSelect(e.target.value)}
            className="input"
          >
            <option value="" disabled>
              Seçin
            </option>
            {serviceTypes.map((s) => (
              <option key={s.id} value={s.name}>
                {s.name}
              </option>
            ))}
            <option value={OTHER_SERVICE_TYPE}>Diğer</option>
          </select>
          {serviceTypeSelect === OTHER_SERVICE_TYPE && (
            <input
              required
              value={serviceTypeOther}
              onChange={(e) => setServiceTypeOther(e.target.value)}
              className="input mt-2"
              placeholder="Hizmet türünü yazın"
            />
          )}
        </div>

        {/* Randevu penceresi — Stitch Müdür → İşler kartlarındaki "09:00 – 11:00". */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Başlangıç (opsiyonel)</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="input"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Tahmini Bitiş (opsiyonel)</label>
            <input
              type="datetime-local"
              value={scheduledEndAt}
              min={scheduledAt || undefined}
              onChange={(e) => setScheduledEndAt(e.target.value)}
              className="input"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Ücret (₺, opsiyonel)</label>
          <input type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="input" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Not (opsiyonel)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input" rows={3} />
        </div>

        {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

        <div className="mt-2 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-2xl px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:bg-surface-subtle">
            Vazgeç
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-2xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition hover:bg-primary-700 disabled:opacity-60"
          >
            {saving ? "Kaydediliyor..." : "Oluştur"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

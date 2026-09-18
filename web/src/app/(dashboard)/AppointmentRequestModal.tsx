"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Modal } from "@/components/Modal";
import { api, ApiError } from "@/lib/api";
import { toIsoDate } from "@/lib/format";

interface AppointmentRequestModalProps {
  open: boolean;
  onClose: () => void;
  onSent: () => void;
}

/**
 * Bölüm J (3. tur): Giriş yapmış müşterinin "Yeni Randevu İste" formu —
 * anonim QuoteRequestModal'dan farklı olarak hesabına bağlı bir
 * AppointmentRequest üretir (hizmet türü + tercih edilen tarih aralığı + not).
 */
export function AppointmentRequestModal({ open, onClose, onSent }: AppointmentRequestModalProps) {
  const [serviceTypes, setServiceTypes] = useState<{ id: string; name: string }[]>([]);
  const [serviceTypeId, setServiceTypeId] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const tomorrow = toIsoDate(new Date(Date.now() + 24 * 3600 * 1000));

  useEffect(() => {
    if (!open) return;
    setServiceTypeId("");
    setDateStart("");
    setDateEnd("");
    setNote("");
    setError(null);
    api
      .get<{ data: { id: string; name: string }[] }>("/appointment-requests/service-types")
      .then((res) => {
        setServiceTypes(res.data);
        if (res.data.length > 0) setServiceTypeId(res.data[0].id);
      })
      .catch(() => setServiceTypes([]));
  }, [open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!serviceTypeId) {
      setError("Lütfen bir hizmet türü seçin");
      return;
    }
    if (!dateStart || !dateEnd) {
      setError("Lütfen tercih ettiğiniz tarih aralığını seçin");
      return;
    }
    setSaving(true);
    try {
      // Aralığın başı gün başlangıcı, sonu gün sonu — "3–5 Ekim arası" gibi.
      await api.post("/appointment-requests", {
        serviceTypeId,
        preferredDateStart: new Date(`${dateStart}T00:00:00`).toISOString(),
        preferredDateEnd: new Date(`${dateEnd}T23:59:59`).toISOString(),
        note: note.trim() || undefined,
      });
      onSent();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Talep gönderilemedi, tekrar deneyin");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Yeni Randevu İste">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Hizmet Türü</label>
          <select required value={serviceTypeId} onChange={(e) => setServiceTypeId(e.target.value)} className="input">
            {serviceTypes.length === 0 && <option value="">Yükleniyor...</option>}
            {serviceTypes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">En Erken</label>
            <input
              required
              type="date"
              min={tomorrow}
              value={dateStart}
              onChange={(e) => {
                setDateStart(e.target.value);
                if (!dateEnd || e.target.value > dateEnd) setDateEnd(e.target.value);
              }}
              className="input"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">En Geç</label>
            <input required type="date" min={dateStart || tomorrow} value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} className="input" />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Not (opsiyonel)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={1000}
            className="input"
            placeholder="Örn. Öğleden sonra evdeyim, kapıcıya haber verin"
          />
        </div>

        {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

        <div className="mt-2 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-2xl px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:bg-surface-subtle">
            Vazgeç
          </button>
          <button
            type="submit"
            disabled={saving || serviceTypes.length === 0}
            className="rounded-2xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition hover:bg-primary-700 disabled:opacity-60"
          >
            {saving ? "Gönderiliyor..." : "Talebi Gönder"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

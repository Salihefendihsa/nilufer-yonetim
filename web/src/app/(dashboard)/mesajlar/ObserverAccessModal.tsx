"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { api, ApiError } from "@/lib/api";
import type { ObserverAccessGrant } from "@/lib/types";
import { ShieldAlert } from "lucide-react";

interface ObserverAccessModalProps {
  open: boolean;
  onClose: () => void;
  onGranted: (grant: ObserverAccessGrant) => void;
}

type Duration = "1h" | "1d" | "1w" | "custom";

const DURATION_OPTIONS: { value: Duration; label: string }[] = [
  { value: "1h", label: "1 saat" },
  { value: "1d", label: "1 gün" },
  { value: "1w", label: "1 hafta" },
  { value: "custom", label: "Özel tarih" },
];

export function ObserverAccessModal({ open, onClose, onGranted }: ObserverAccessModalProps) {
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState<Duration>("1d");
  const [customDate, setCustomDate] = useState("");
  const [isEmergency, setIsEmergency] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setReason("");
    setDuration("1d");
    setCustomDate("");
    setIsEmergency(false);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      setError("Gerekçe zorunludur");
      return;
    }
    if (!isEmergency && duration === "custom" && !customDate) {
      setError("Bir bitiş tarihi seçin");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { reason: reason.trim(), isEmergency };
      if (!isEmergency) {
        if (duration === "custom") {
          body.expiresAt = new Date(customDate).toISOString();
        } else {
          body.duration = duration;
        }
      }
      const grant = await api.post<ObserverAccessGrant>("/observer-access", body);
      onGranted(grant);
      reset();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erişim talebi oluşturulamadı");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Gözlemci Erişimi Talep Et"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-sm text-text-secondary">
          Tüm konuşmaları görüntülemek için bir gerekçe ve süre belirtmelisiniz. Her erişim ve kullanım
          denetim kaydına (audit log) işlenir.
        </p>

        {error && (
          <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-text-primary" htmlFor="observer-reason">
            Gerekçe
          </label>
          <textarea
            id="observer-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            required
            placeholder="Örn. müşteri şikayetini inceliyorum"
            className="input w-full resize-none"
          />
        </div>

        {!isEmergency && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">Süre</label>
            <div className="grid grid-cols-4 gap-2">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDuration(opt.value)}
                  className={`rounded-xl border px-2 py-2 text-xs font-medium transition ${
                    duration === opt.value
                      ? "border-primary-600 bg-primary-50 text-primary-700"
                      : "border-border text-text-secondary hover:border-border-strong"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {duration === "custom" && (
              <input
                type="datetime-local"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="input mt-2 w-full"
                required
              />
            )}
          </div>
        )}

        <label className="flex cursor-pointer items-start gap-2.5 rounded-2xl border border-warning-100 bg-warning-50 px-4 py-3 text-sm text-warning-600">
          <input
            type="checkbox"
            checked={isEmergency}
            onChange={(e) => setIsEmergency(e.target.checked)}
            className="mt-0.5"
          />
          <span className="flex flex-col gap-0.5">
            <span className="flex items-center gap-1.5 font-medium">
              <ShieldAlert size={14} strokeWidth={1.75} />
              Acil Durum Erişimi (sınırsız)
            </span>
            <span className="text-xs opacity-90">
              Süre sınırı olmadan erişim verir; ayrıca ve belirgin şekilde işaretlenmiş bir denetim kaydı oluşturulur.
            </span>
          </span>
        </label>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              reset();
              onClose();
            }}
            className="rounded-2xl border border-border px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:bg-surface-subtle"
          >
            Vazgeç
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-2xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition hover:bg-primary-700 disabled:opacity-50"
          >
            {submitting ? "Gönderiliyor..." : "Erişimi Talep Et"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

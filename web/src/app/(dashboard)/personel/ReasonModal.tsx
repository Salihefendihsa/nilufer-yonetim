"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { ApiError } from "@/lib/api";

interface ReasonModalProps {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  /** Gerekçeyi backend'e gönderen fonksiyon — hata fırlatırsa modal açık kalır. */
  onSubmit: (reason: string) => Promise<unknown>;
}

/**
 * Gözlemci Modu / Impersonation modallerindeki gerekçe-sorma deseninin genel
 * hali — personel rol yönetimi işlemlerinin (terfi/düşürme/rol değiştirme/
 * işten çıkarma/geri aktif etme) hepsi tek bir gerekçe metni ister.
 */
export function ReasonModal({ open, onClose, onDone, title, description, confirmLabel, danger, onSubmit }: ReasonModalProps) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    setReason("");
    setError(null);
    onClose();
  }

  async function handleSubmit() {
    if (!reason.trim()) {
      setError("Gerekçe zorunludur");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(reason.trim());
      setReason("");
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "İşlem gerçekleştirilemedi");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title={title}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text-secondary">{description}</p>

        {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-text-primary" htmlFor="reason-modal-input">
            Gerekçe
          </label>
          <textarea
            id="reason-modal-input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            required
            autoFocus
            className="input w-full resize-none"
          />
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={handleClose} className="btn-ghost">
            Vazgeç
          </button>
          <button type="button" onClick={handleSubmit} disabled={submitting} className={danger ? "btn-danger" : "btn-primary"}>
            {submitting ? "İşleniyor..." : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}

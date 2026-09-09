"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Modal } from "@/components/Modal";
import { api, ApiError } from "@/lib/api";
import type { Product } from "@/lib/types";

interface PurchaseRequestModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  product: Product | null;
}

/**
 * Satın alma (ikmal) talebi oluşturur. Stok bu aşamada ARTMAZ — talep
 * "Sipariş Bekleyen" olarak listelenir, stok yalnızca mal kabulünde artar.
 */
export function PurchaseRequestModal({ open, onClose, onSaved, product }: PurchaseRequestModalProps) {
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setQuantity("");
      setNote("");
      setError(null);
    }
  }, [open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!product) return;
    setError(null);
    setSaving(true);

    try {
      await api.post(`/products/${product.id}/purchase-requests`, {
        quantity: Number(quantity),
        note: note.trim() || undefined,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Talep oluşturulamadı, tekrar deneyin");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={product ? `${product.name} — Satın Alma Talebi` : "Satın Alma Talebi"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="rounded-2xl bg-surface-subtle px-4 py-3 text-xs text-text-secondary">
          Talep oluşturulduğunda stok hemen artmaz; mal kabulü yapıldığında stoğa işlenir.
        </p>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">
            Talep Miktarı {product ? `(${product.unit})` : ""}
          </label>
          <input
            required
            type="number"
            min={0}
            step="0.01"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="input"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Not (opsiyonel)</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="input"
            placeholder="Örn. Tedarikçi X, 2 hafta teslim"
          />
        </div>

        {error && (
          <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>
        )}

        <div className="mt-2 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:bg-surface-subtle"
          >
            Vazgeç
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-2xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition hover:bg-primary-700 disabled:opacity-60"
          >
            {saving ? "Gönderiliyor..." : "Talep Oluştur"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Modal } from "@/components/Modal";
import { api, ApiError } from "@/lib/api";
import type { Product, Supplier } from "@/lib/types";

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
  const [supplierId, setSupplierId] = useState("");
  const [orderTrackingNumber, setOrderTrackingNumber] = useState("");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setQuantity("");
      setNote("");
      setSupplierId("");
      setOrderTrackingNumber("");
      setError(null);
      api
        .get<{ data: Supplier[] }>("/suppliers")
        .then((res) => setSuppliers(res.data.filter((s) => s.isActive)))
        .catch(() => setSuppliers([]));
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
        supplierId: supplierId || undefined,
        orderTrackingNumber: orderTrackingNumber.trim() || undefined,
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
          <label className="text-sm font-medium text-text-secondary">Tedarikçi (opsiyonel)</label>
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="input">
            <option value="">Seçilmedi</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Sipariş/Kargo Takip No (opsiyonel)</label>
          <input
            value={orderTrackingNumber}
            onChange={(e) => setOrderTrackingNumber(e.target.value)}
            className="input"
            placeholder="Örn. TRK-90412"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Not (opsiyonel)</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="input"
            placeholder="Örn. 2 hafta teslim"
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

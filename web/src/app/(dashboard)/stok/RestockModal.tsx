"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Modal } from "@/components/Modal";
import { api, ApiError } from "@/lib/api";
import type { Product } from "@/lib/types";

interface RestockModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  product: Product | null;
}

export function RestockModal({ open, onClose, onSaved, product }: RestockModalProps) {
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  // Bölüm AM (9. tur): opsiyonel parti no + SKT (ikisi birlikte).
  const [batchNumber, setBatchNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setQuantity("");
      setNote("");
      setBatchNumber("");
      setExpiryDate("");
      setError(null);
    }
  }, [open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!product) return;
    setError(null);
    if (!!batchNumber.trim() !== !!expiryDate) {
      setError("Parti numarası ve son kullanma tarihi birlikte girilmeli");
      return;
    }
    setSaving(true);

    try {
      await api.post(`/products/${product.id}/restock`, {
        quantity: Number(quantity),
        note: note || undefined,
        batchNumber: batchNumber.trim() || undefined,
        expiryDate: expiryDate || undefined,
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
    <Modal open={open} onClose={onClose} title={product ? `${product.name} — Stok Ekle` : "Stok Ekle"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Miktar {product ? `(${product.unit})` : ""}</label>
          <input required type="number" min={0} step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="input" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Not (opsiyonel)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} className="input" placeholder="Örn. Tedarikçiden alım" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Parti No (opsiyonel)</label>
            <input value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} className="input" placeholder="Örn. LOT-2409A" maxLength={64} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Son Kullanma Tarihi</label>
            <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="input" />
          </div>
        </div>
        <p className="-mt-2 text-xs text-text-secondary">
          Kimyasallarda parti ve SKT yasal takip için önerilir; girilirse çıkışlar en önce süresi dolacak partiden düşülür.
        </p>

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
            {saving ? "Kaydediliyor..." : "Stok Ekle"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

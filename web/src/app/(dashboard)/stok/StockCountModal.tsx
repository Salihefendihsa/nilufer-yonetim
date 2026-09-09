"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Modal } from "@/components/Modal";
import { api, ApiError } from "@/lib/api";
import { decimalValue } from "@/lib/format";
import type { Product } from "@/lib/types";

interface StockCountModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  product: Product | null;
}

interface CountResponse {
  adjusted: boolean;
  difference: number;
}

/**
 * Fiili sayım mutabakatı. Sayılan miktar ile sistemdeki miktar arasındaki fark
 * otomatik bir stok hareketine dönüşür (fark + ise giriş, − ise çıkış) ve stok
 * sayılan değere eşitlenir.
 */
export function StockCountModal({ open, onClose, onSaved, product }: StockCountModalProps) {
  const [counted, setCounted] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setCounted("");
      setError(null);
      setInfo(null);
    }
  }, [open]);

  const parsed = counted.trim() === "" ? null : Number(counted);
  const difference =
    product && parsed !== null && !Number.isNaN(parsed) ? parsed - decimalValue(product.currentStock) : null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!product || parsed === null) return;
    setError(null);
    setInfo(null);
    setSaving(true);

    try {
      const res = await api.post<CountResponse>(`/products/${product.id}/count`, {
        countedQuantity: parsed,
      });
      onSaved();
      if (res.adjusted) {
        onClose();
      } else {
        // Fark yoksa backend hiçbir hareket yazmaz; bunu gizlemeyip modalda söylüyoruz.
        setInfo("Sayım sistemi doğruladı — fark yok, hiçbir stok hareketi oluşturulmadı.");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sayım kaydedilemedi, tekrar deneyin");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={product ? `${product.name} — Fiili Sayım` : "Fiili Sayım"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="rounded-2xl bg-surface-subtle px-4 py-3 text-sm text-text-secondary">
          Sistemdeki miktar:{" "}
          <span className="font-mono font-semibold text-text-primary">
            {product ? `${product.currentStock} ${product.unit}` : "—"}
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">
            Sayılan Miktar {product ? `(${product.unit})` : ""}
          </label>
          <input
            required
            autoFocus
            type="number"
            min={0}
            step="0.01"
            value={counted}
            onChange={(e) => setCounted(e.target.value)}
            className="input"
          />
        </div>

        {difference !== null && !Number.isNaN(difference) && (
          <p
            className={`rounded-2xl px-4 py-3 text-sm font-medium ${
              difference === 0
                ? "bg-surface-subtle text-text-secondary"
                : difference > 0
                  ? "bg-success-50 text-success-600"
                  : "bg-danger-50 text-danger-500"
            }`}
          >
            {difference === 0
              ? "Fark yok — kayıt oluşturulmayacak."
              : `Fark: ${difference > 0 ? "+" : ""}${difference} ${product?.unit ?? ""} — ${
                  difference > 0 ? "giriş" : "çıkış"
                } hareketi oluşturulacak.`}
          </p>
        )}

        {info && (
          <p className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm font-medium text-primary-700">
            {info}
          </p>
        )}

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
            {saving ? "Kaydediliyor..." : "Sayımı Kaydet"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

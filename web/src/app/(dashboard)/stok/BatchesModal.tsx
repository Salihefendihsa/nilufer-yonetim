"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { api, ApiError } from "@/lib/api";
import { formatDate, decimalValue } from "@/lib/format";
import type { Product, ProductBatch } from "@/lib/types";

interface BatchesModalProps {
  open: boolean;
  onClose: () => void;
  product: Product | null;
}

/**
 * Bölüm AM (9. tur): SKT'ye göre renk — kırmızı: dolmuş / ≤7 gün, sarı: ≤30
 * gün, yeşil: daha uzak. Bakiyesi 0 olan parti soluk gösterilir (tükenmiş).
 */
export function batchTone(batch: Pick<ProductBatch, "daysLeft" | "isExpired">): "red" | "yellow" | "green" {
  if (batch.isExpired || batch.daysLeft <= 7) return "red";
  if (batch.daysLeft <= 30) return "yellow";
  return "green";
}

const TONE_CLASS = {
  red: "border-danger-100 bg-danger-50 text-danger-500",
  yellow: "border-warning-100 bg-warning-50 text-warning-600",
  green: "border-success-100 bg-success-50 text-success-600",
} as const;

export function batchExpiryLabel(batch: Pick<ProductBatch, "daysLeft" | "isExpired">): string {
  if (batch.isExpired) return `Süresi ${Math.abs(batch.daysLeft)} gün önce doldu`;
  if (batch.daysLeft === 0) return "Bugün son gün";
  return `${batch.daysLeft} gün kaldı`;
}

/** Bir ürünün partileri (GET /products/:id/batches) — SKT sırasıyla. */
export function BatchesModal({ open, onClose, product }: BatchesModalProps) {
  const [batches, setBatches] = useState<ProductBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !product) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get<{ data: ProductBatch[] }>(`/products/${product.id}/batches`)
      .then((res) => {
        if (!cancelled) setBatches(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Partiler yüklenemedi");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, product]);

  return (
    <Modal open={open} onClose={onClose} title={product ? `${product.name} — Partiler / SKT` : "Partiler"}>
      {error && (
        <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>
      )}
      {loading ? (
        <p className="text-sm text-text-secondary">Yükleniyor...</p>
      ) : batches.length === 0 ? (
        <p className="text-sm text-text-secondary">
          Bu ürün için parti kaydı yok. Stok girişinde parti no + SKT girerek takibe başlayabilirsiniz.
        </p>
      ) : (
        <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto">
          {batches.map((batch) => {
            const depleted = decimalValue(batch.quantityRemaining) <= 0;
            const tone = batchTone(batch);
            return (
              <li
                key={batch.id}
                className={`flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface-subtle px-4 py-2.5 ${depleted ? "opacity-60" : ""}`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary">
                    <span className="font-mono">{batch.batchNumber}</span>
                    {batch.supplier ? <span className="text-text-secondary"> · {batch.supplier.name}</span> : null}
                  </p>
                  <p className="truncate text-xs text-text-secondary">
                    SKT {formatDate(batch.expiryDate)} · Giriş {formatDate(batch.receivedAt)} ·{" "}
                    {decimalValue(batch.quantityRemaining)} / {decimalValue(batch.quantityReceived)} {product?.unit ?? ""}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${depleted ? "border-border bg-surface-base text-text-secondary" : TONE_CLASS[tone]}`}>
                  {depleted ? "Tükendi" : batchExpiryLabel(batch)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}

"use client";

import { useEffect, useState } from "react";
import { LoadingBlock } from "@/components/LoadingBlock";
import { Modal } from "@/components/Modal";
import { api, ApiError } from "@/lib/api";
import { formatDateTime, decimalValue } from "@/lib/format";
import type { Paginated, Product, StockMovement } from "@/lib/types";

interface MovementsModalProps {
  open: boolean;
  onClose: () => void;
  product: Product | null;
}

interface MovementRow extends StockMovement {
  relatedJobReport?: {
    job?: { customer?: { fullName: string } };
    staff?: { user?: { fullName: string } };
  } | null;
}

/** Bir ürünün stok hareket geçmişi (GET /products/:id/movements). */
export function MovementsModal({ open, onClose, product }: MovementsModalProps) {
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !product) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get<Paginated<MovementRow>>(`/products/${product.id}/movements?limit=30`)
      .then((res) => {
        if (!cancelled) setMovements(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Hareketler yüklenemedi");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, product]);

  return (
    <Modal open={open} onClose={onClose} title={product ? `${product.name} — Stok Hareketleri` : "Stok Hareketleri"}>
      {error && (
        <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>
      )}
      {loading ? (
        <LoadingBlock lines={3} />
      ) : movements.length === 0 ? (
        <p className="text-sm text-text-secondary">Bu ürün için stok hareketi bulunmuyor.</p>
      ) : (
        <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto">
          {movements.map((movement) => (
            <li
              key={movement.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface-subtle px-4 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-text-primary">
                  {movement.type === "IN" ? "Giriş" : "Çıkış"}
                  {movement.relatedJobReport?.job?.customer?.fullName
                    ? ` · ${movement.relatedJobReport.job.customer.fullName}`
                    : ""}
                </p>
                <p className="truncate text-xs text-text-secondary">
                  {formatDateTime(movement.createdAt)}
                  {movement.relatedJobReport?.staff?.user?.fullName
                    ? ` · ${movement.relatedJobReport.staff.user.fullName}`
                    : ""}
                  {movement.note ? ` · ${movement.note}` : ""}
                </p>
              </div>
              <span
                className={`shrink-0 font-mono text-sm font-semibold ${
                  movement.type === "IN" ? "text-success-500" : "text-danger-500"
                }`}
              >
                {movement.type === "IN" ? "+" : "−"}
                {decimalValue(movement.quantity)} {product?.unit ?? ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { formatDate, decimalValue } from "@/lib/format";
import type { ProductBatch } from "@/lib/types";
import { batchExpiryLabel, batchTone } from "./BatchesModal";

const TONE_CLASS = {
  red: "border-danger-100 bg-danger-50 text-danger-500",
  yellow: "border-warning-100 bg-warning-50 text-warning-600",
  green: "border-success-100 bg-success-50 text-success-600",
} as const;

const WINDOWS = [7, 30, 90] as const;

/**
 * Bölüm AM (9. tur): "Süresi Yaklaşan Partiler" uyarı paneli
 * (GET /products/expiring-batches?days=). Süresi dolmuş partiler listede
 * kalır ve ayrı işaretlenir — imha/iade takibi için görünmeleri gerekir.
 * `refreshKey` stok girişi/çıkışında yeniden yükletmek için.
 */
export function ExpiringBatchesPanel({ refreshKey }: { refreshKey: number }) {
  const [days, setDays] = useState<(typeof WINDOWS)[number]>(30);
  const [batches, setBatches] = useState<ProductBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ days: number; data: ProductBatch[] }>(`/products/expiring-batches?days=${days}`);
      setBatches(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Partiler yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const expiredCount = batches.filter((b) => b.isExpired).length;

  return (
    <section className="rounded-3xl border border-border bg-surface-base p-5 shadow-card">
      <header className="mb-4 flex flex-wrap items-center gap-2">
        <CalendarClock size={16} strokeWidth={1.75} className="text-text-secondary" />
        <h2 className="text-sm font-semibold text-text-primary">Süresi Yaklaşan Partiler</h2>
        {!loading && (
          <span className="rounded-full bg-surface-subtle px-2 py-0.5 text-[11px] font-semibold text-text-secondary">{batches.length}</span>
        )}
        {!loading && expiredCount > 0 && (
          <span className="rounded-full border border-danger-100 bg-danger-50 px-2 py-0.5 text-[11px] font-semibold text-danger-500">
            {expiredCount} süresi dolmuş
          </span>
        )}
        <div className="ml-auto flex gap-1">
          {WINDOWS.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setDays(w)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                days === w ? "bg-primary-600 text-white" : "border border-border bg-surface-base text-text-secondary hover:bg-surface-subtle"
              }`}
            >
              {w} gün
            </button>
          ))}
        </div>
      </header>

      {error && <p className="mb-3 rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

      {loading ? (
        <p className="text-sm text-text-secondary">Yükleniyor...</p>
      ) : batches.length === 0 ? (
        <p className="text-sm text-text-secondary">Önümüzdeki {days} gün içinde süresi dolacak parti yok.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {batches.map((batch) => (
            <li key={batch.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface-subtle px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-text-primary">
                  {batch.product?.name ?? "Ürün"} <span className="font-mono text-xs text-text-secondary">· {batch.batchNumber}</span>
                </p>
                <p className="text-xs text-text-secondary">
                  SKT {formatDate(batch.expiryDate)} · {decimalValue(batch.quantityRemaining)} {batch.product?.unit ?? ""} kaldı
                  {batch.supplier ? ` · ${batch.supplier.name}` : ""}
                </p>
              </div>
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${TONE_CLASS[batchTone(batch)]}`}>
                {batchExpiryLabel(batch)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

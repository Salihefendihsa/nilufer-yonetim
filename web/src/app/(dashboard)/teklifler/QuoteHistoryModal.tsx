"use client";

import { useEffect, useState } from "react";
import { LoadingBlock } from "@/components/LoadingBlock";
import { Modal } from "@/components/Modal";
import { api, ApiError } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { QuoteHistoryEntry, QuoteRequest } from "@/lib/types";

interface QuoteHistoryModalProps {
  open: boolean;
  onClose: () => void;
  quote: QuoteRequest | null;
}

/** Denetim eylem kodlarının okunabilir karşılıkları. */
const ACTION_LABELS: Record<string, string> = {
  "quote.update": "Güncellendi",
  "quote.convert": "Müşteriye dönüştürüldü",
};

/**
 * Tek bir teklifin denetim geçmişi (GET /quotes/:id/history).
 * Bu uç yalnızca `targetType="QuoteRequest" AND targetId=:id` kayıtlarını döner —
 * `/audit-logs` işletme sahibine kısıtlı kalır.
 */
export function QuoteHistoryModal({ open, onClose, quote }: QuoteHistoryModalProps) {
  const [entries, setEntries] = useState<QuoteHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !quote) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get<{ data: QuoteHistoryEntry[] }>(`/quotes/${quote.id}/history`)
      .then((res) => {
        if (!cancelled) setEntries(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Tarihçe yüklenemedi");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, quote]);

  return (
    <Modal open={open} onClose={onClose} title={quote ? `${quote.fullName} — Tarihçe` : "Tarihçe"}>
      {error && (
        <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>
      )}
      {loading ? (
        <LoadingBlock lines={3} />
      ) : entries.length === 0 ? (
        <p className="text-sm text-text-secondary">Bu teklif için kayıtlı bir değişiklik yok.</p>
      ) : (
        <ol className="flex max-h-96 flex-col gap-2 overflow-y-auto">
          {entries.map((entry) => (
            <li key={entry.id} className="rounded-2xl border border-border bg-surface-subtle px-4 py-3">
              <p className="text-sm font-medium text-text-primary">
                {ACTION_LABELS[entry.action] ?? entry.action}
              </p>
              <p className="text-xs text-text-secondary">
                {entry.actor.fullName} · {formatDateTime(entry.createdAt)}
              </p>
              {entry.detail && (
                <p className="mt-1 break-all font-mono text-2xs text-text-faint">{entry.detail}</p>
              )}
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}

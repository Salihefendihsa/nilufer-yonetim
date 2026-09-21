"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { LoadingBlock } from "@/components/LoadingBlock";
import { SectionTitle } from "@/components/SectionTitle";
import { ShoppingCart, Check, X } from "lucide-react";
import { Modal } from "@/components/Modal";
import { api, ApiError } from "@/lib/api";
import { formatDateTime, decimalValue } from "@/lib/format";
import type { Paginated, StockPurchaseRequest } from "@/lib/types";

const STATUS_LABELS: Record<StockPurchaseRequest["status"], { label: string; className: string }> = {
  PENDING: { label: "Sipariş Bekliyor", className: "border-warning-100 bg-warning-50 text-warning-600" },
  RECEIVED: { label: "Mal Kabul Edildi", className: "border-success-100 bg-success-50 text-success-600" },
  CANCELLED: { label: "İptal", className: "border-border bg-surface-subtle text-text-secondary" },
};

/**
 * Bekleyen satın alma talepleri. Mal kabulü stoğu artırır ve bir StockMovement(IN)
 * kaydı oluşturur — bu yüzden onaydan sonra ürün listesi de yenilenir (onChanged).
 */
export function PurchaseRequestsPanel({ onChanged }: { onChanged: () => void }) {
  const [requests, setRequests] = useState<StockPurchaseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Bölüm AM (9. tur): mal kabulde opsiyonel parti no + SKT sorulur.
  const [receiveTarget, setReceiveTarget] = useState<StockPurchaseRequest | null>(null);
  const [batchNumber, setBatchNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [receiveError, setReceiveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<Paginated<StockPurchaseRequest>>("/products/purchase-requests?status=PENDING&limit=20");
      setRequests(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Talepler yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function resolve(id: string, status: "RECEIVED" | "CANCELLED", batch?: { batchNumber?: string; expiryDate?: string }) {
    setBusyId(id);
    setError(null);
    try {
      await api.patch(`/products/purchase-requests/${id}`, { status, ...batch });
      await load();
      onChanged();
      return true;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "İşlem tamamlanamadı";
      if (status === "RECEIVED" && batch) setReceiveError(message);
      else setError(message);
      return false;
    } finally {
      setBusyId(null);
    }
  }

  function openReceive(request: StockPurchaseRequest) {
    setReceiveTarget(request);
    setBatchNumber("");
    setExpiryDate("");
    setReceiveError(null);
  }

  async function handleReceive(e: FormEvent) {
    e.preventDefault();
    if (!receiveTarget) return;
    if (!!batchNumber.trim() !== !!expiryDate) {
      setReceiveError("Parti numarası ve son kullanma tarihi birlikte girilmeli");
      return;
    }
    const ok = await resolve(receiveTarget.id, "RECEIVED", {
      batchNumber: batchNumber.trim() || undefined,
      expiryDate: expiryDate || undefined,
    });
    if (ok) setReceiveTarget(null);
  }

  return (
    <section className="rounded-2xl border border-border bg-surface-card p-5 shadow-card">
      <header className="mb-4 flex items-center gap-2">
        <ShoppingCart size={16} strokeWidth={1.75} className="text-text-secondary" />
        <SectionTitle size="sm">Bekleyen Satın Alma Talepleri</SectionTitle>
        {!loading && (
          <span className="rounded-full bg-surface-subtle px-2 py-0.5 text-2xs font-semibold text-text-secondary">
            {requests.length}
          </span>
        )}
      </header>

      {error && (
        <p className="mb-3 rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>
      )}

      {loading ? (
        <LoadingBlock lines={3} />
      ) : requests.length === 0 ? (
        <p className="text-sm text-text-secondary">Bekleyen satın alma talebi yok.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {requests.map((request) => (
            <li
              key={request.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface-subtle px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-text-primary">
                  {request.product?.name ?? "Ürün"}{" "}
                  <span className="font-mono text-xs text-text-secondary">
                    +{decimalValue(request.quantity)} {request.product?.unit ?? ""}
                  </span>
                  {/* Bölüm AI (8. tur): otomatik öneri rozeti */}
                  {request.isAutoGenerated && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-info-50 px-2 py-0.5 text-2xs font-semibold text-info-600 ring-1 ring-info-100" title="Kritik stok taraması tedarikçi geçmişine göre otomatik açtı">
                      Otomatik Öneri
                    </span>
                  )}
                </p>
                <p className="text-xs text-text-secondary">
                  {request.requestedBy?.fullName ?? "—"} · {formatDateTime(request.createdAt)}
                  {request.supplier ? ` · ${request.supplier.name}` : ""}
                  {request.orderTrackingNumber ? ` · Takip: ${request.orderTrackingNumber}` : ""}
                  {request.note ? ` · ${request.note}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full border px-2.5 py-1 text-2xs font-semibold ${STATUS_LABELS[request.status].className}`}
                >
                  {STATUS_LABELS[request.status].label}
                </span>
                <button
                  type="button"
                  disabled={busyId === request.id}
                  onClick={() => openReceive(request)}
                  className="flex items-center gap-1.5 rounded-xl bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-700 disabled:opacity-60"
                >
                  <Check size={13} strokeWidth={2} />
                  Mal Kabul
                </button>
                <button
                  type="button"
                  disabled={busyId === request.id}
                  onClick={() => resolve(request.id, "CANCELLED")}
                  className="flex items-center gap-1.5 rounded-xl border border-border bg-surface-base px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-surface-subtle disabled:opacity-60"
                >
                  <X size={13} strokeWidth={2} />
                  İptal
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={!!receiveTarget} onClose={() => setReceiveTarget(null)} title={receiveTarget ? `Mal Kabul — ${receiveTarget.product?.name ?? "Ürün"}` : "Mal Kabul"}>
        <form onSubmit={handleReceive} className="flex flex-col gap-4">
          <p className="text-sm text-text-secondary">
            +{receiveTarget ? decimalValue(receiveTarget.quantity) : ""} {receiveTarget?.product?.unit ?? ""} stoğa eklenecek. Kimyasallar için parti no ve SKT
            girmeniz önerilir (opsiyonel).
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-secondary">Parti No</label>
              <input value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} className="input" placeholder="Örn. LOT-2409A" maxLength={64} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-secondary">Son Kullanma Tarihi</label>
              <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="input" />
            </div>
          </div>
          {receiveError && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{receiveError}</p>}
          <div className="mt-2 flex justify-end gap-3">
            <button type="button" onClick={() => setReceiveTarget(null)} className="rounded-2xl px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:bg-surface-subtle">
              Vazgeç
            </button>
            <button type="submit" disabled={busyId === receiveTarget?.id} className="rounded-2xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition hover:bg-primary-700 disabled:opacity-60">
              {busyId === receiveTarget?.id ? "Kaydediliyor..." : "Mal Kabul Et"}
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}

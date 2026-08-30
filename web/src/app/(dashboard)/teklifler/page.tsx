"use client";

import { useCallback, useEffect, useState } from "react";
import { Inbox, Phone, MapPin, ArrowRightCircle } from "lucide-react";
import { RequireRole } from "@/components/RequireRole";
import { EmptyState } from "@/components/EmptyState";
import { api, ApiError } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { QuoteRequest, Paginated } from "@/lib/types";

const STATUS_OPTIONS = ["NEW", "CONTACTED", "CONVERTED", "REJECTED"] as const;
const STATUS_LABELS: Record<string, string> = {
  NEW: "Yeni",
  CONTACTED: "İletişime Geçildi",
  CONVERTED: "Dönüştürüldü",
  REJECTED: "Reddedildi",
};
const STATUS_STYLES: Record<string, { badge: string; dot: string }> = {
  NEW: { badge: "border-amber-400/30 bg-amber-400/10 text-amber-300", dot: "bg-amber-400" },
  CONTACTED: { badge: "border-sky-400/30 bg-sky-400/10 text-sky-300", dot: "bg-sky-400" },
  CONVERTED: { badge: "border-primary-greenLight/30 bg-primary-greenLight/10 text-primary-greenLight", dot: "bg-primary-greenLight" },
  REJECTED: { badge: "border-primary-redLight/30 bg-primary-redLight/10 text-primary-redLight", dot: "bg-primary-redLight" },
};
const FALLBACK_STATUS_STYLE = { badge: "border-white/15 bg-white/5 text-text-secondary", dot: "bg-white/30" };

export default function QuotesPage() {
  return (
    <RequireRole roles={["OWNER", "MANAGER"]}>
      <QuotesPageContent />
    </RequireRole>
  );
}

function QuotesPageContent() {
  const [quotes, setQuotes] = useState<QuoteRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<"ALL" | (typeof STATUS_OPTIONS)[number]>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const statusQuery = statusFilter === "ALL" ? "" : `&status=${statusFilter}`;
      const res = await api.get<Paginated<QuoteRequest>>(`/quotes?limit=50${statusQuery}`);
      setQuotes(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Talepler yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleStatusChange(id: string, status: string) {
    setBusyId(id);
    try {
      await api.patch(`/quotes/${id}`, { status });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Durum güncellenemedi");
    } finally {
      setBusyId(null);
    }
  }

  async function handleConvert(id: string) {
    setBusyId(id);
    try {
      await api.post(`/quotes/${id}/convert`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Dönüştürülemedi");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-text-primary">Teklif Talepleri</h1>
        <p className="mt-1 text-sm text-text-secondary">Web sitesinden gelen talepler burada birikir.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["ALL", ...STATUS_OPTIONS] as const).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(status)}
            className={`rounded-2xl px-3.5 py-1.5 text-sm font-medium transition ${
              statusFilter === status ? "bg-primary-green text-white" : "bg-surface-card text-text-secondary hover:bg-white/5"
            }`}
          >
            {status === "ALL" ? "Tümü" : STATUS_LABELS[status]}
          </button>
        ))}
      </div>

      {error && <p className="rounded-2xl bg-primary-red/10 px-4 py-3 text-sm text-primary-redLight">{error}</p>}

      {loading ? (
        <p className="py-16 text-center text-sm text-text-faint">Yükleniyor...</p>
      ) : quotes.length === 0 ? (
        <div className="rounded-2xl bg-surface-card shadow-[0_8px_24px_rgba(0,0,0,0.22)]">
          <EmptyState icon={Inbox} title="Talep yok" description="Bu filtrede henüz bir teklif talebi yok." />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {quotes.map((quote) => (
            <div key={quote.id} className="flex flex-col gap-3 rounded-2xl bg-surface-card p-5 shadow-[0_8px_24px_rgba(0,0,0,0.22)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-text-primary">{quote.fullName}</p>
                  <p className="text-sm text-text-secondary">{quote.serviceType} · {quote.propertyType}</p>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
                    (STATUS_STYLES[quote.status] ?? FALLBACK_STATUS_STYLE).badge
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rotate-45 ${(STATUS_STYLES[quote.status] ?? FALLBACK_STATUS_STYLE).dot}`} />
                  {STATUS_LABELS[quote.status] ?? quote.status}
                </span>
              </div>

              <div className="flex flex-col gap-1.5 text-sm text-text-secondary">
                <div className="flex items-center gap-2">
                  <Phone size={14} strokeWidth={1.75} className="text-text-faint" />
                  {quote.phone}
                </div>
                {(quote.address || quote.district) && (
                  <div className="flex items-center gap-2">
                    <MapPin size={14} strokeWidth={1.75} className="text-text-faint" />
                    {[quote.address, quote.district].filter(Boolean).join(", ")}
                  </div>
                )}
              </div>

              <p className="text-xs text-text-faint">{formatDate(quote.createdAt)}</p>

              <div className="mt-1 flex items-center gap-2">
                <select
                  value={quote.status}
                  disabled={busyId === quote.id}
                  onChange={(e) => handleStatusChange(quote.id, e.target.value)}
                  className="flex-1 rounded-2xl border border-white/10 bg-surface-card px-3 py-2 text-sm text-text-primary outline-none disabled:opacity-50"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>

                {quote.status !== "CONVERTED" && (
                  <button
                    type="button"
                    disabled={busyId === quote.id}
                    onClick={() => handleConvert(quote.id)}
                    className="flex items-center gap-1.5 whitespace-nowrap rounded-2xl bg-primary-green px-3.5 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
                  >
                    <ArrowRightCircle size={15} strokeWidth={1.75} />
                    Müşteriye Dönüştür
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

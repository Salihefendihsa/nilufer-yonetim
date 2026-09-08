"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Inbox, Phone, MapPin, ArrowRightCircle, FileText, CheckCircle2, PhoneCall } from "lucide-react";
import { RequireRole } from "@/components/RequireRole";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { StatusStrip } from "@/components/StatusStrip";
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
  NEW: { badge: "border-warning-100 bg-warning-50 text-warning-500", dot: "bg-warning-500" },
  CONTACTED: { badge: "border-info-100 bg-info-50 text-info-500", dot: "bg-info-500" },
  CONVERTED: { badge: "border-primary-200 bg-primary-50 text-primary-600", dot: "bg-primary-500" },
  REJECTED: { badge: "border-danger-100 bg-danger-50 text-danger-500", dot: "bg-danger-500" },
};
const FALLBACK_STATUS_STYLE = { badge: "border-border-strong bg-surface-subtle text-text-secondary", dot: "bg-surface-muted" };

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

  // Durum sayaçları listeden hesaplanır; "ALL" dışında filtreliyken de tutarlı kalması için
  // sayaçlar yalnızca yüklü kayıtları yansıtır.
  const quoteStats = useMemo(() => {
    const base = { NEW: 0, CONTACTED: 0, CONVERTED: 0, REJECTED: 0 } as Record<string, number>;
    for (const q of quotes) base[q.status] = (base[q.status] ?? 0) + 1;
    return base as { NEW: number; CONTACTED: number; CONVERTED: number; REJECTED: number };
  }, [quotes]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={FileText}
        title="Teklif Talepleri"
        description="Web sitesinden gelen talepler burada birikir."
      />

      {/* [Özet kartlar] */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Yeni talep" value={loading ? "—" : String(quoteStats.NEW)} icon={Inbox} accent="gold" mono />
        <StatCard
          label="İletişime geçildi"
          value={loading ? "—" : String(quoteStats.CONTACTED)}
          icon={PhoneCall}
          accent="blue"
          mono
        />
        <StatCard
          label="Dönüştürüldü"
          value={loading ? "—" : String(quoteStats.CONVERTED)}
          icon={CheckCircle2}
          mono
          progress={quotes.length > 0 ? (quoteStats.CONVERTED / quotes.length) * 100 : 0}
          hint="Müşteriye dönüşen talepler"
        />
      </div>

      {/* [Durum dağılımı şeridi] */}
      <StatusStrip
        loading={loading}
        totalLabel={`${quotes.length} talep`}
        segments={[
          { label: "yeni", count: quoteStats.NEW, color: "#B57F13" },
          { label: "iletişimde", count: quoteStats.CONTACTED, color: "#1F6FA8" },
          { label: "dönüştü", count: quoteStats.CONVERTED, color: "#15803D" },
          { label: "reddedildi", count: quoteStats.REJECTED, color: "#C0392B" },
        ]}
      />

      <div className="flex flex-wrap gap-2">
        {(["ALL", ...STATUS_OPTIONS] as const).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(status)}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
              statusFilter === status
                ? "border-primary-600 bg-primary-600 text-white shadow-card"
                : "border-border bg-surface-card text-text-secondary hover:border-border-strong hover:bg-surface-subtle hover:text-text-primary"
            }`}
          >
            {status === "ALL" ? "Tümü" : STATUS_LABELS[status]}
          </button>
        ))}
      </div>

      {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

      {loading ? (
        <p className="py-16 text-center text-sm text-text-faint">Yükleniyor...</p>
      ) : quotes.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface-card shadow-card">
          <EmptyState icon={Inbox} title="Talep yok" description="Bu filtrede henüz bir teklif talebi yok." />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {quotes.map((quote) => (
            <div key={quote.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-card p-5 shadow-card">
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
                  className="flex-1 rounded-2xl border border-border bg-surface-card px-3 py-2 text-sm text-text-primary outline-none disabled:opacity-50"
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
                    className="flex items-center gap-1.5 whitespace-nowrap rounded-2xl bg-primary-600 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-60"
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

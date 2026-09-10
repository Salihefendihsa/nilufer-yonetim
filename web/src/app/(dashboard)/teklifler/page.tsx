"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Inbox, Phone, MapPin, ArrowRightCircle, FileText, CheckCircle2, PhoneCall, CalendarClock, StickyNote, History } from "lucide-react";
import { RequireRole } from "@/components/RequireRole";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { StatusStrip } from "@/components/StatusStrip";
import { EmptyState } from "@/components/EmptyState";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/lib/ToastProvider";
import { formatDate, currencyFormatter } from "@/lib/format";
import type { QuoteRequest, QuotesSummary, Paginated } from "@/lib/types";
import { QuoteHistoryModal } from "./QuoteHistoryModal";

// "REVISION" backend'de yeni bir enum değeri DEĞİL — QuoteRequest.status
// serbest bir string olduğu için (bkz. backend/prisma/schema.prisma) şema
// değişikliği gerekmeden burada yeni bir durum değeri olarak kullanılabilir.
const STATUS_OPTIONS = ["NEW", "CONTACTED", "REVISION", "CONVERTED", "REJECTED"] as const;
const STATUS_LABELS: Record<string, string> = {
  NEW: "Yeni",
  CONTACTED: "İletişime Geçildi",
  REVISION: "Revize Edilecek",
  CONVERTED: "Dönüştürüldü",
  REJECTED: "Reddedildi",
};
const STATUS_STYLES: Record<string, { badge: string; dot: string }> = {
  NEW: { badge: "border-warning-100 bg-warning-50 text-warning-500", dot: "bg-warning-500" },
  CONTACTED: { badge: "border-info-100 bg-info-50 text-info-500", dot: "bg-info-500" },
  REVISION: { badge: "border-danger-100 bg-danger-50 text-danger-500", dot: "bg-danger-500" },
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
  const [amountDrafts, setAmountDrafts] = useState<Record<string, string>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [surveyDrafts, setSurveyDrafts] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<QuotesSummary | null>(null);
  const [historyQuote, setHistoryQuote] = useState<QuoteRequest | null>(null);
  const { showToast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const statusQuery = statusFilter === "ALL" ? "" : `&status=${statusFilter}`;
      const [res, summaryRes] = await Promise.all([
        api.get<Paginated<QuoteRequest>>(`/quotes?limit=50${statusQuery}`),
        api.get<QuotesSummary>("/quotes/summary"),
      ]);
      setQuotes(res.data);
      setSummary(summaryRes);
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
      showToast(`Talep durumu "${STATUS_LABELS[status] ?? status}" olarak güncellendi.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Durum güncellenemedi");
    } finally {
      setBusyId(null);
    }
  }

  async function handleAmountSave(id: string) {
    const raw = amountDrafts[id];
    const amount = raw === undefined || raw.trim() === "" ? null : Number(raw);
    if (amount !== null && (Number.isNaN(amount) || amount < 0)) {
      setError("Geçerli bir tutar girin");
      return;
    }
    setBusyId(id);
    try {
      await api.patch(`/quotes/${id}`, { amount });
      load();
      showToast("Fiyat kaydedildi.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Fiyat kaydedilemedi");
    } finally {
      setBusyId(null);
    }
  }

  /** Yönetim notu ve keşif randevusu tek istekte kaydedilir. */
  async function handleDetailsSave(quote: QuoteRequest) {
    const noteRaw = noteDrafts[quote.id];
    const surveyRaw = surveyDrafts[quote.id];
    const payload: Record<string, unknown> = {};
    if (noteRaw !== undefined) payload.note = noteRaw.trim() === "" ? null : noteRaw.trim();
    if (surveyRaw !== undefined) payload.surveyAt = surveyRaw === "" ? null : new Date(surveyRaw).toISOString();
    if (Object.keys(payload).length === 0) return;

    setBusyId(quote.id);
    try {
      await api.patch(`/quotes/${quote.id}`, payload);
      load();
      showToast("Kaydedildi.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kaydedilemedi");
    } finally {
      setBusyId(null);
    }
  }

  async function handleConvert(id: string) {
    setBusyId(id);
    try {
      await api.post(`/quotes/${id}/convert`);
      load();
      showToast("Teklif işe dönüştürüldü.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Dönüştürülemedi");
    } finally {
      setBusyId(null);
    }
  }

  // Durum sayaçları listeden hesaplanır; "ALL" dışında filtreliyken de tutarlı kalması için
  // sayaçlar yalnızca yüklü kayıtları yansıtır.
  const quoteStats = useMemo(() => {
    const base = { NEW: 0, CONTACTED: 0, REVISION: 0, CONVERTED: 0, REJECTED: 0 } as Record<string, number>;
    for (const q of quotes) base[q.status] = (base[q.status] ?? 0) + 1;
    return base as { NEW: number; CONTACTED: number; REVISION: number; CONVERTED: number; REJECTED: number };
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
        {/* Kartlar tüm taleplerden (/quotes/summary), şerit ise yüklü listeden hesaplanır. */}
        <StatCard
          label="Yeni talep"
          value={loading || !summary ? "—" : String(summary.byStatus.NEW ?? 0)}
          icon={Inbox}
          accent="gold"
          mono
        />
        <StatCard
          label="Bekleyen teklif tutarı"
          value={loading || !summary ? "—" : currencyFormatter.format(summary.openAmountTotal)}
          icon={PhoneCall}
          accent="blue"
          mono
          hint="Sonuçlanmamış taleplerin toplamı"
        />
        <StatCard
          label="Dönüşüm oranı"
          value={
            loading || !summary
              ? "—"
              : summary.conversionRate === null
                ? "Veri yok"
                : `%${summary.conversionRate.toFixed(0)}`
          }
          icon={CheckCircle2}
          mono
          progress={summary?.conversionRate ?? undefined}
          hint="Dönüşen / (dönüşen + reddedilen)"
        />
      </div>

      {/* [Durum dağılımı şeridi] */}
      <StatusStrip
        loading={loading}
        totalLabel={`${quotes.length} talep`}
        segments={[
          { label: "yeni", count: quoteStats.NEW, color: "#B57F13" },
          { label: "iletişimde", count: quoteStats.CONTACTED, color: "#1F6FA8" },
          { label: "revize", count: quoteStats.REVISION, color: "#C0392B" },
          { label: "dönüştü", count: quoteStats.CONVERTED, color: "#15803D" },
          { label: "reddedildi", count: quoteStats.REJECTED, color: "#9B1C1C" },
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

              <p className="text-xs text-text-faint">
                {formatDate(quote.createdAt)}
                {quote.convertedAt ? ` · Dönüştürüldü: ${formatDate(quote.convertedAt)}` : ""}
              </p>

              {/* [Keşif randevusu + yönetim notu] */}
              <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface-subtle px-3 py-2.5">
                <label className="flex items-center gap-2 text-xs font-medium text-text-secondary">
                  <CalendarClock size={13} strokeWidth={1.75} className="text-text-faint" />
                  Keşif Randevusu
                  <input
                    type="datetime-local"
                    value={
                      surveyDrafts[quote.id] ??
                      (quote.surveyAt ? new Date(quote.surveyAt).toISOString().slice(0, 16) : "")
                    }
                    onChange={(e) => setSurveyDrafts((prev) => ({ ...prev, [quote.id]: e.target.value }))}
                    className="ml-auto rounded-xl border border-border bg-surface-base px-2 py-1 text-xs text-text-primary outline-none focus:border-primary-500"
                  />
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-text-secondary">
                  <StickyNote size={13} strokeWidth={1.75} className="text-text-faint" />
                  Not
                  <input
                    value={noteDrafts[quote.id] ?? quote.note ?? ""}
                    onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [quote.id]: e.target.value }))}
                    placeholder="Yönetim notu"
                    className="flex-1 rounded-xl border border-border bg-surface-base px-2 py-1 text-xs text-text-primary outline-none focus:border-primary-500"
                  />
                </label>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setHistoryQuote(quote)}
                    className="flex items-center gap-1.5 rounded-xl border border-border bg-surface-base px-2.5 py-1 text-xs font-semibold text-text-secondary transition hover:bg-surface-muted"
                  >
                    <History size={12} strokeWidth={2} />
                    Tarihçe
                  </button>
                  <button
                    type="button"
                    disabled={busyId === quote.id}
                    onClick={() => handleDetailsSave(quote)}
                    className="rounded-xl border border-border bg-surface-base px-2.5 py-1 text-xs font-semibold text-text-secondary transition hover:bg-surface-muted disabled:opacity-60"
                  >
                    Notu/Randevuyu Kaydet
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface-subtle px-3 py-2">
                <span className="text-xs font-medium text-text-secondary">Fiyat</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Belirlenmedi"
                  value={amountDrafts[quote.id] ?? (quote.amount != null ? String(quote.amount) : "")}
                  onChange={(e) => setAmountDrafts((prev) => ({ ...prev, [quote.id]: e.target.value }))}
                  className="w-24 rounded-xl border border-border bg-surface-base px-2 py-1 text-sm text-text-primary outline-none focus:border-primary-500"
                />
                <button
                  type="button"
                  disabled={busyId === quote.id}
                  onClick={() => handleAmountSave(quote.id)}
                  className="rounded-xl bg-primary-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-primary-700 disabled:opacity-60"
                >
                  Kaydet
                </button>
                {quote.amount != null && (
                  <span className="ml-auto text-xs font-semibold text-text-faint">{currencyFormatter.format(quote.amount)}</span>
                )}
              </div>

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

      <QuoteHistoryModal open={!!historyQuote} onClose={() => setHistoryQuote(null)} quote={historyQuote} />
    </div>
  );
}

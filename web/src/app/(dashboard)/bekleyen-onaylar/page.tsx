"use client";

import { useCallback, useEffect, useState } from "react";
import { ClipboardCheck, Inbox, HandCoins, FileSignature, Check, X, ArrowRightCircle } from "lucide-react";
import { RequireRole } from "@/components/RequireRole";
import { EmptyState } from "@/components/EmptyState";
import { api, ApiError } from "@/lib/api";
import { formatDate, currencyFormatter } from "@/lib/format";
import type { QuoteRequest, AdvanceRequest, Contract, Customer, Paginated } from "@/lib/types";

export default function ApprovalQueuePage() {
  return (
    <RequireRole roles={["OWNER", "MANAGER"]}>
      <ApprovalQueueContent />
    </RequireRole>
  );
}

function ApprovalQueueContent() {
  const [quotes, setQuotes] = useState<QuoteRequest[]>([]);
  const [advances, setAdvances] = useState<AdvanceRequest[]>([]);
  const [expiringContracts, setExpiringContracts] = useState<(Contract & { customer: Customer })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [quotesRes, advancesRes, expiringRes] = await Promise.all([
        api.get<Paginated<QuoteRequest>>("/quotes?status=NEW&limit=50"),
        api.get<Paginated<AdvanceRequest>>("/advances?status=PENDING&limit=50"),
        api.get<{ data: (Contract & { customer: Customer })[] }>("/contracts/expiring"),
      ]);
      setQuotes(quotesRes.data);
      setAdvances(advancesRes.data);
      setExpiringContracts(expiringRes.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kuyruk yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleQuoteContact(id: string) {
    setBusyId(id);
    try {
      await api.patch(`/quotes/${id}`, { status: "CONTACTED" });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Güncellenemedi");
    } finally {
      setBusyId(null);
    }
  }

  async function handleQuoteConvert(id: string) {
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

  async function handleAdvanceDecision(id: string, status: "APPROVED" | "REJECTED") {
    setBusyId(id);
    try {
      await api.patch(`/advances/${id}`, { status });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Güncellenemedi");
    } finally {
      setBusyId(null);
    }
  }

  const total = quotes.length + advances.length + expiringContracts.length;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-gold/15 text-primary-gold">
          <ClipboardCheck size={20} strokeWidth={1.75} />
        </span>
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-text-primary">Bekleyen Onaylar</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {total > 0 ? `${total} işlem sizi bekliyor.` : "Bekleyen bir işlem yok."}
          </p>
        </div>
      </div>

      {error && <p className="rounded-2xl bg-primary-redLight/10 px-4 py-3 text-sm text-primary-redLight">{error}</p>}

      {loading ? (
        <p className="py-16 text-center text-sm text-text-faint">Yükleniyor...</p>
      ) : total === 0 ? (
        <EmptyState icon={Inbox} title="Kuyruk boş" description="Yeni bir teklif, avans talebi veya bitmek üzere olan sözleşme geldiğinde burada görünecek." />
      ) : (
        <div className="flex flex-col gap-3">
          {expiringContracts.map((contract) => {
            const daysLeft = Math.max(0, Math.ceil((new Date(contract.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
            return (
              <div key={contract.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-surface-card p-5 shadow-[0_8px_24px_rgba(0,0,0,0.22)]">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-400/15 text-amber-300">
                    <FileSignature size={16} strokeWidth={1.75} />
                  </span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">Sözleşme · {daysLeft} gün kaldı</p>
                    <p className="mt-0.5 font-medium text-text-primary">{contract.customer.fullName}</p>
                    <p className="text-sm text-text-secondary">Bitiş: {formatDate(contract.endDate)}</p>
                  </div>
                </div>
                <a
                  href="/sozlesmeler"
                  className="flex items-center gap-1.5 whitespace-nowrap rounded-2xl bg-white/5 px-3.5 py-2 text-sm font-medium text-text-secondary transition hover:bg-white/10"
                >
                  Sözleşmeye Git
                </a>
              </div>
            );
          })}

          {advances.map((advance) => (
            <div key={advance.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-surface-card p-5 shadow-[0_8px_24px_rgba(0,0,0,0.22)]">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-gold/15 text-primary-gold">
                  <HandCoins size={16} strokeWidth={1.75} />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary-gold">Avans Talebi</p>
                  <p className="mt-0.5 font-medium text-text-primary">{advance.staff?.user.fullName ?? "Personel"}</p>
                  <p className="text-sm text-text-secondary">
                    {currencyFormatter.format(advance.amount)} · {advance.reason}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busyId === advance.id}
                  onClick={() => handleAdvanceDecision(advance.id, "APPROVED")}
                  className="flex items-center gap-1.5 rounded-2xl bg-primary-greenLight/15 px-3 py-2 text-sm font-medium text-primary-greenLight transition hover:bg-primary-greenLight/25 disabled:opacity-50"
                >
                  <Check size={15} strokeWidth={1.75} />
                  Onayla
                </button>
                <button
                  type="button"
                  disabled={busyId === advance.id}
                  onClick={() => handleAdvanceDecision(advance.id, "REJECTED")}
                  className="flex items-center gap-1.5 rounded-2xl bg-primary-redLight/15 px-3 py-2 text-sm font-medium text-primary-redLight transition hover:bg-primary-redLight/25 disabled:opacity-50"
                >
                  <X size={15} strokeWidth={1.75} />
                  Reddet
                </button>
              </div>
            </div>
          ))}

          {quotes.map((quote) => (
            <div key={quote.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-surface-card p-5 shadow-[0_8px_24px_rgba(0,0,0,0.22)]">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-400/15 text-sky-300">
                  <Inbox size={16} strokeWidth={1.75} />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-sky-300">Teklif Talebi</p>
                  <p className="mt-0.5 font-medium text-text-primary">{quote.fullName}</p>
                  <p className="text-sm text-text-secondary">
                    {quote.serviceType} · {quote.phone}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busyId === quote.id}
                  onClick={() => handleQuoteContact(quote.id)}
                  className="flex items-center gap-1.5 whitespace-nowrap rounded-2xl bg-white/5 px-3.5 py-2 text-sm font-medium text-text-secondary transition hover:bg-white/10 disabled:opacity-50"
                >
                  İletişime Geçildi
                </button>
                <button
                  type="button"
                  disabled={busyId === quote.id}
                  onClick={() => handleQuoteConvert(quote.id)}
                  className="flex items-center gap-1.5 whitespace-nowrap rounded-2xl bg-primary-greenLight/15 px-3.5 py-2 text-sm font-medium text-primary-greenLight transition hover:bg-primary-greenLight/25 disabled:opacity-50"
                >
                  <ArrowRightCircle size={15} strokeWidth={1.75} />
                  Dönüştür
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

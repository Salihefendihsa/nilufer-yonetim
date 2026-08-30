"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Wallet, TrendingUp, Receipt, AlertCircle, PiggyBank, Check, X, HandCoins } from "lucide-react";
import { RequireRole } from "@/components/RequireRole";
import { StatCard } from "@/components/StatCard";
import { Table, type Column } from "@/components/Table";
import { EmptyState } from "@/components/EmptyState";
import { api, ApiError } from "@/lib/api";
import { currencyFormatter, formatDate } from "@/lib/format";
import type { Customer, Payment, Paginated, AdvanceRequest } from "@/lib/types";
import { PaymentFormModal } from "./PaymentFormModal";

interface PaymentsSummary {
  thisMonthTotal: number;
  thisMonthPaymentCount: number;
  allTimeTotal: number;
  totalOutstandingBalance: number;
  pendingAdvancesTotal: number;
  pendingAdvancesCount: number;
  netProfitThisMonth?: number;
  profitMargin?: number | null;
}

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  CASH: "Nakit",
  CREDIT_CARD: "Kredi Kartı",
  TRANSFER: "Havale/EFT",
};

export default function PaymentsPage() {
  return (
    <RequireRole roles={["OWNER", "MANAGER"]}>
      <PaymentsPageContent />
    </RequireRole>
  );
}

function PaymentsPageContent() {
  const [summary, setSummary] = useState<PaymentsSummary | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [advances, setAdvances] = useState<AdvanceRequest[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [advanceBusyId, setAdvanceBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, paymentsRes, customersRes, advancesRes] = await Promise.all([
        api.get<PaymentsSummary>("/payments/summary"),
        api.get<Paginated<Payment>>(`/payments?page=${page}&limit=20`),
        api.get<Paginated<Customer>>("/customers?limit=100"),
        api.get<Paginated<AdvanceRequest>>("/advances?status=PENDING&limit=20"),
      ]);
      setSummary(summaryRes);
      setPayments(paymentsRes.data);
      setTotalPages(paymentsRes.pagination.totalPages);
      setCustomers(customersRes.data);
      setAdvances(advancesRes.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Veriler yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdvanceDecision(id: string, status: "APPROVED" | "REJECTED") {
    setAdvanceBusyId(id);
    try {
      await api.patch(`/advances/${id}`, { status });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Güncellenemedi");
    } finally {
      setAdvanceBusyId(null);
    }
  }

  const customerNames = Object.fromEntries(customers.map((c) => [c.id, c.fullName]));

  const columns: Column<Payment>[] = [
    {
      header: "Müşteri",
      isPrimary: true,
      avatarLabel: (row) => customerNames[row.customerId] ?? "Müşteri",
      accessor: (row) => <span className="font-medium text-text-primary">{customerNames[row.customerId] ?? "Müşteri"}</span>,
    },
    { header: "Tutar", accessor: (row) => <span className="font-medium text-text-primary">{currencyFormatter.format(row.amount)}</span> },
    { header: "Tür", accessor: (row) => PAYMENT_TYPE_LABELS[row.paymentType] ?? row.paymentType },
    { header: "Tarih", accessor: (row) => formatDate(row.createdAt) },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-text-primary">Para</h1>
          <p className="mt-1 text-sm text-text-secondary">Tahsilatlarınızı buradan takip edin.</p>
        </div>
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-primary-green to-primary-green/90 px-4 py-2.5 text-sm font-semibold text-white transition hover:shadow-[0_0_20px_rgba(212,174,61,0.22)]"
        >
          <Plus size={16} strokeWidth={2} />
          Tahsilat Kaydet
        </button>
      </div>

      {error && <p className="rounded-2xl bg-primary-red/10 px-4 py-3 text-sm text-primary-redLight">{error}</p>}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Bu ay tahsilat" value={summary ? currencyFormatter.format(summary.thisMonthTotal) : "—"} icon={Wallet} />
        <StatCard label="Bu ay işlem sayısı" value={summary ? String(summary.thisMonthPaymentCount) : "—"} icon={Receipt} />
        <StatCard label="Toplam tahsilat" value={summary ? currencyFormatter.format(summary.allTimeTotal) : "—"} icon={TrendingUp} />
        <StatCard
          label="Bekleyen bakiye"
          value={summary ? currencyFormatter.format(Math.max(summary.totalOutstandingBalance, 0)) : "—"}
          icon={AlertCircle}
          accent="red"
        />
        {summary?.netProfitThisMonth !== undefined && (
          <StatCard
            label="Net kâr (bu ay)"
            value={currencyFormatter.format(summary.netProfitThisMonth)}
            icon={PiggyBank}
            accent={summary.netProfitThisMonth >= 0 ? "green" : "red"}
          />
        )}
      </div>

      <div className="rounded-2xl bg-surface-card p-6 shadow-[0_8px_24px_rgba(0,0,0,0.22)]">
        <div className="mb-4 flex items-center gap-2">
          <HandCoins size={18} strokeWidth={1.75} className="text-text-faint" />
          <h2 className="text-base font-semibold text-text-primary">Bekleyen Avans Talepleri</h2>
        </div>

        {advances.length === 0 ? (
          <p className="py-4 text-center text-sm text-text-faint">Bekleyen avans talebi yok.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-white/5">
            {advances.map((advance) => (
              <li key={advance.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <p className="text-sm font-medium text-text-primary">{advance.staff?.user.fullName ?? "Personel"}</p>
                  <p className="text-xs text-text-secondary">
                    {currencyFormatter.format(advance.amount)} · {advance.reason}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={advanceBusyId === advance.id}
                    onClick={() => handleAdvanceDecision(advance.id, "APPROVED")}
                    className="flex items-center gap-1.5 rounded-2xl bg-primary-green/10 px-3 py-2 text-xs font-medium text-primary-greenLight transition hover:bg-primary-green/20 disabled:opacity-50"
                  >
                    <Check size={14} strokeWidth={1.75} />
                    Onayla
                  </button>
                  <button
                    type="button"
                    disabled={advanceBusyId === advance.id}
                    onClick={() => handleAdvanceDecision(advance.id, "REJECTED")}
                    className="flex items-center gap-1.5 rounded-2xl bg-primary-red/10 px-3 py-2 text-xs font-medium text-primary-redLight transition hover:bg-primary-red/20 disabled:opacity-50"
                  >
                    <X size={14} strokeWidth={1.75} />
                    Reddet
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Table
        columns={columns}
        data={payments}
        keyField={(row) => row.id}
        loading={loading}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        emptyState={
          <EmptyState
            icon={Wallet}
            title="Henüz tahsilat yok"
            description="İlk tahsilatı kaydederek başlayın."
            actionLabel="Tahsilat Kaydet"
            onAction={() => setFormOpen(true)}
          />
        }
      />

      <PaymentFormModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} customers={customers} />
    </div>
  );
}

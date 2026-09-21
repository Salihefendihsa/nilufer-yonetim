"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SectionTitle } from "@/components/SectionTitle";
import { Plus, Wallet, TrendingUp, Receipt, AlertCircle, PiggyBank, Check, X, HandCoins, FileSpreadsheet, FileDown } from "lucide-react";
import { ExpensesTab } from "./ExpensesTab";
import { RequireRole } from "@/components/RequireRole";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { ChartCard, DonutChart, TrendChart } from "@/components/ChartCard";
import { Table, type Column } from "@/components/Table";
import { EmptyState } from "@/components/EmptyState";
import { api, ApiError, downloadFile } from "@/lib/api";
import { useToast } from "@/lib/ToastProvider";
import { currencyFormatter, formatDate } from "@/lib/format";
import { useInitialQueryParam } from "@/lib/useDrillDownFilter";
import type {
  Customer,
  Payment,
  Paginated,
  AdvanceRequest,
  RevenueTrendPoint,
  PaymentsSummary,
} from "@/lib/types";
import { PaymentFormModal } from "./PaymentFormModal";

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

type PageTab = "payments" | "expenses";

function PaymentsPageContent() {
  const [tab, setTab] = useState<PageTab>("payments");
  // Bölüm G: Yönetici Özeti → Net Kâr kartı (?tab=expenses).
  const drillTab = useInitialQueryParam("tab");
  useEffect(() => {
    if (drillTab === "expenses" || drillTab === "payments") setTab(drillTab);
  }, [drillTab]);
  const [summary, setSummary] = useState<PaymentsSummary | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [advances, setAdvances] = useState<AdvanceRequest[]>([]);
  const [revenue, setRevenue] = useState<RevenueTrendPoint[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [advanceBusyId, setAdvanceBusyId] = useState<string | null>(null);
  const { showToast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, paymentsRes, customersRes, advancesRes, revenueRes] = await Promise.all([
        api.get<PaymentsSummary>("/payments/summary"),
        api.get<Paginated<Payment>>(`/payments?page=${page}&limit=20`),
        api.get<Paginated<Customer>>("/customers?limit=100"),
        api.get<Paginated<AdvanceRequest>>("/advances?status=PENDING&limit=20"),
        api.get<{ data: RevenueTrendPoint[] }>("/analytics/revenue-trend?months=6"),
      ]);
      setSummary(summaryRes);
      setRevenue(revenueRes.data);
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
      showToast(status === "APPROVED" ? "Avans onaylandı." : "Avans reddedildi.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Güncellenemedi");
    } finally {
      setAdvanceBusyId(null);
    }
  }

  const customerNames = Object.fromEntries(customers.map((c) => [c.id, c.fullName]));

  // Tür dağılımı ve aya göre değişim artık /payments/summary'den gelir —
  // yalnızca görüntülenen sayfadaki kayıtlardan değil, ayın tamamından hesaplanır.
  const paymentTypeSlices = useMemo(
    () =>
      (summary?.paymentTypeBreakdown ?? []).map((entry) => ({
        name: PAYMENT_TYPE_LABELS[entry.paymentType] ?? entry.paymentType,
        value: entry.total,
      })),
    [summary]
  );

  const columns: Column<Payment>[] = [
    {
      header: "Müşteri",
      isPrimary: true,
      avatarLabel: (row) => row.customer?.fullName ?? customerNames[row.customerId] ?? "Müşteri",
      accessor: (row) => (
        <span className="font-medium text-text-primary">
          {row.customer?.fullName ?? customerNames[row.customerId] ?? "Müşteri"}
        </span>
      ),
    },
    { header: "Tutar", accessor: (row) => <span className="font-medium text-text-primary">{currencyFormatter.format(row.amount)}</span> },
    { header: "Tür", accessor: (row) => PAYMENT_TYPE_LABELS[row.paymentType] ?? row.paymentType },
    {
      header: "Dekont No",
      accessor: (row) =>
        row.referenceNo ? <span className="font-mono text-xs">{row.referenceNo}</span> : <span className="text-text-faint">—</span>,
    },
    {
      header: "Tahsil Eden",
      accessor: (row) => row.collectedByStaff?.user.fullName ?? <span className="text-text-faint">—</span>,
    },
    { header: "Tarih", accessor: (row) => formatDate(row.createdAt) },
    {
      header: "Makbuz",
      accessor: (row) => (
        <button
          type="button"
          aria-label="Makbuz İndir"
          title="Makbuz İndir"
          onClick={() => downloadFile(`/payments/${row.id}/receipt/pdf`, `makbuz-${row.id}.pdf`)}
          className="flex h-7 w-7 items-center justify-center rounded-xl text-text-faint transition hover:bg-surface-subtle hover:text-text-primary"
        >
          <FileDown size={15} strokeWidth={1.75} />
        </button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Wallet}
        title="Para"
        description="Tahsilatları, bekleyen bakiyeyi ve avans taleplerini tek ekranda takip edin."
        actions={
          <>
            <button
              type="button"
              onClick={() => downloadFile("/payments/export/excel", "odemeler.xlsx")}
              className="flex items-center gap-2 rounded-2xl border border-border bg-surface-base px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:border-border-strong hover:bg-surface-subtle hover:text-text-primary"
            >
              <FileSpreadsheet size={16} strokeWidth={1.75} />
              Excel&apos;e Aktar
            </button>
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="flex items-center gap-2 rounded-2xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition hover:bg-primary-700"
            >
              <Plus size={16} strokeWidth={2} />
              Tahsilat Kaydet
            </button>
          </>
        }
      />

      <div className="flex w-fit gap-1 rounded-2xl border border-border bg-surface-card p-1 shadow-card">
        <button
          type="button"
          onClick={() => setTab("payments")}
          className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition ${
            tab === "payments" ? "bg-primary-600 text-white shadow-card" : "text-text-secondary hover:bg-surface-subtle"
          }`}
        >
          <Wallet size={14} strokeWidth={1.75} />
          Tahsilatlar
        </button>
        <button
          type="button"
          onClick={() => setTab("expenses")}
          className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition ${
            tab === "expenses" ? "bg-primary-600 text-white shadow-card" : "text-text-secondary hover:bg-surface-subtle"
          }`}
        >
          <Receipt size={14} strokeWidth={1.75} />
          Giderler
        </button>
      </div>

      {tab === "expenses" ? (
        <ExpensesTab />
      ) : (
        <>
      {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Bu ay tahsilat"
          value={summary ? currencyFormatter.format(summary.thisMonthTotal) : "—"}
          icon={Wallet}
          mono
          trend={
            summary?.monthOverMonthChangePercent != null
              ? { value: summary.monthOverMonthChangePercent, label: "geçen aya göre" }
              : undefined
          }
          progress={summary?.revenueTargetCompletionPercent ?? undefined}
          hint={
            summary?.monthlyRevenueTarget
              ? `Hedef ${currencyFormatter.format(summary.monthlyRevenueTarget)}`
              : undefined
          }
        />
        <StatCard
          label="Bu ay işlem sayısı"
          value={summary ? String(summary.thisMonthPaymentCount) : "—"}
          icon={Receipt}
          accent="blue"
          mono
          hint={summary && summary.thisMonthPaymentCount > 0 ? `Ortalama ${currencyFormatter.format(summary.thisMonthTotal / summary.thisMonthPaymentCount)}` : undefined}
        />
        <StatCard label="Toplam tahsilat" value={summary ? currencyFormatter.format(summary.allTimeTotal) : "—"} icon={TrendingUp} accent="neutral" mono />
        <StatCard
          label="Bekleyen bakiye"
          value={summary ? currencyFormatter.format(Math.max(summary.totalOutstandingBalance, 0)) : "—"}
          icon={AlertCircle}
          accent="red"
          mono
          hint={summary?.pendingAdvancesCount ? `${summary.pendingAdvancesCount} bekleyen avans talebi` : undefined}
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

      {/* [Grafikler] */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard
          title="Ciro Trendi"
          description="Son 6 ayın aylık tahsilat toplamı"
          icon={TrendingUp}
          height={240}
          className="lg:col-span-2"
        >
          <TrendChart
            data={revenue}
            xKey="label"
            series={[{ key: "total", name: "Tahsilat" }]}
            area
            currency
            loading={loading} emptyLabel="Veri yok"
          />
        </ChartCard>

        <ChartCard title="Ödeme Türü Dağılımı" description="Bu ayın tüm tahsilatları" icon={Receipt} height={240}>
          <DonutChart
            data={paymentTypeSlices}
            centerValue={loading || !summary ? "—" : currencyFormatter.format(summary.thisMonthTotal)}
            centerLabel="bu ay"
            loading={loading} emptyLabel="Veri yok"
          />
        </ChartCard>
      </div>

      <div className="rounded-2xl border border-border bg-surface-card p-6 shadow-card">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-warning-50 text-warning-500 ring-1 ring-warning-100">
            <HandCoins size={17} strokeWidth={1.75} />
          </span>
          <SectionTitle>Bekleyen Avans Talepleri</SectionTitle>
          {advances.length > 0 && (
            <span className="rounded-full bg-warning-50 px-2 py-0.5 text-2xs font-semibold text-warning-600">{advances.length}</span>
          )}
        </div>

        {advances.length === 0 ? (
          <p className="py-4 text-center text-sm text-text-faint">Bekleyen avans talebi yok.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
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
                    className="flex items-center gap-1.5 rounded-2xl bg-primary-50 px-3 py-2 text-xs font-medium text-primary-600 transition hover:bg-primary-100 disabled:opacity-50"
                  >
                    <Check size={14} strokeWidth={1.75} />
                    Onayla
                  </button>
                  <button
                    type="button"
                    disabled={advanceBusyId === advance.id}
                    onClick={() => handleAdvanceDecision(advance.id, "REJECTED")}
                    className="flex items-center gap-1.5 rounded-2xl bg-danger-50 px-3 py-2 text-xs font-medium text-danger-500 transition hover:bg-danger-100 disabled:opacity-50"
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
        </>
      )}
    </div>
  );
}

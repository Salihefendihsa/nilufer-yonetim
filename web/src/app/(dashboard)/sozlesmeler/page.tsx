"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, FileText, AlertTriangle, FileSignature, CalendarClock, Repeat, RefreshCw, Wallet, Download, HeartPulse, Wrench } from "lucide-react";
import { RequireRole } from "@/components/RequireRole";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { StatusStrip } from "@/components/StatusStrip";
import { Table, type Column } from "@/components/Table";
import { EmptyState } from "@/components/EmptyState";
import { api, ApiError, downloadFile } from "@/lib/api";
import { useToast } from "@/lib/ToastProvider";
import { formatDate, currencyFormatter } from "@/lib/format";
import { useInitialQueryParam } from "@/lib/useDrillDownFilter";
import { DrillDownChip } from "@/components/DrillDownChip";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { Contract, ContractHealthCheckItem, ContractsSummary, Customer, Paginated } from "@/lib/types";
import { ContractFormModal } from "./ContractFormModal";

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Aktif",
  RENEWED: "Yenilendi",
  EXPIRED: "Süresi Doldu",
  CANCELLED: "İptal Edildi",
};

interface ExpiringContract extends Contract {
  customer: Customer;
}

export default function ContractsPage() {
  return (
    <RequireRole roles={["OWNER", "MANAGER"]}>
      <ContractsPageContent />
    </RequireRole>
  );
}

function ContractsPageContent() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [expiring, setExpiring] = useState<ExpiringContract[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [summary, setSummary] = useState<ContractsSummary | null>(null);
  const [renewTarget, setRenewTarget] = useState<Contract | null>(null);
  const [renewing, setRenewing] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [healthCheck, setHealthCheck] = useState<ContractHealthCheckItem[]>([]);
  const [healthCheckOpen, setHealthCheckOpen] = useState(false);
  // Bölüm G: Yönetici Özeti → "Gecikmiş Sözleşme Otomasyonu" (?filter=overdue)
  // paneli açar; "Yenileme Yaklaşan" (?filter=renewal) 7 gün içinde bitecek
  // aktif sözleşmelere daraltır.
  const drillFilter = useInitialQueryParam("filter");
  const [renewalOnly, setRenewalOnly] = useState(false);
  useEffect(() => {
    if (drillFilter === "overdue") setHealthCheckOpen(true);
    if (drillFilter === "renewal") setRenewalOnly(true);
  }, [drillFilter]);
  const visibleContracts = useMemo(() => {
    if (!renewalOnly) return contracts;
    const now = Date.now();
    const in7Days = now + 7 * 24 * 60 * 60 * 1000;
    return contracts.filter((c) => {
      const end = new Date(c.endDate).getTime();
      return c.status === "ACTIVE" && end >= now && end <= in7Days;
    });
  }, [contracts, renewalOnly]);
  const router = useRouter();

  async function handleDownloadContractPdf(contract: Contract) {
    setDownloadingId(contract.id);
    setError(null);
    try {
      await downloadFile(`/contracts/${contract.id}/pdf`, `sozlesme-${contract.id}.pdf`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "PDF indirilemedi");
    } finally {
      setDownloadingId(null);
    }
  }
  const { showToast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [contractsRes, customersRes, expiringRes, summaryRes, healthCheckRes] = await Promise.all([
        api.get<Paginated<Contract>>(`/contracts?page=${page}&limit=20`),
        api.get<Paginated<Customer>>("/customers?limit=100"),
        api.get<{ data: ExpiringContract[] }>("/contracts/expiring"),
        api.get<ContractsSummary>("/contracts/summary"),
        api.get<{ data: ContractHealthCheckItem[] }>("/contracts/health-check"),
      ]);
      setContracts(contractsRes.data);
      setTotalPages(contractsRes.pagination.totalPages);
      setCustomers(customersRes.data);
      setExpiring(expiringRes.data);
      setSummary(summaryRes);
      setHealthCheck(healthCheckRes.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sözleşmeler yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  const customerNames = Object.fromEntries(customers.map((c) => [c.id, c.fullName]));

  async function handleRenew() {
    if (!renewTarget) return;
    setRenewing(true);
    setError(null);
    try {
      await api.post(`/contracts/${renewTarget.id}/renew`, {});
      setRenewTarget(null);
      load();
      showToast("Sözleşme yenilendi.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sözleşme yenilenemedi");
    } finally {
      setRenewing(false);
    }
  }

  // Özet değerler mevcut sözleşme listesinden türetilir.
  const contractStats = useMemo(
    () => ({
      active: contracts.filter((c) => c.status === "ACTIVE").length,
      renewed: contracts.filter((c) => c.status === "RENEWED").length,
      expired: contracts.filter((c) => c.status === "EXPIRED").length,
      cancelled: contracts.filter((c) => c.status === "CANCELLED").length,
      recurring: contracts.filter((c) => c.recurrenceType !== null && c.recurrenceType !== undefined).length,
    }),
    [contracts]
  );

  const columns: Column<Contract>[] = [
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
    { header: "Başlangıç", accessor: (row) => formatDate(row.startDate) },
    { header: "Bitiş", accessor: (row) => formatDate(row.endDate) },
    { header: "Süre", accessor: (row) => `${row.durationMonths} ay` },
    {
      header: "Dönem Ücreti",
      accessor: (row) =>
        row.amount != null ? (
          <span className="font-medium text-text-primary">{currencyFormatter.format(row.amount)}</span>
        ) : (
          <span className="text-text-faint">—</span>
        ),
    },
    { header: "Durum", accessor: (row) => STATUS_LABELS[row.status] ?? row.status },
    {
      header: "Sıradaki Otomatik İş",
      accessor: (row) =>
        row.nextGenerationDate ? (
          <span className="text-text-secondary">{formatDate(row.nextGenerationDate)}</span>
        ) : (
          <span className="text-text-faint">—</span>
        ),
    },
    {
      header: "",
      className: "text-right",
      accessor: (row) => (
        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={downloadingId === row.id}
            onClick={() => handleDownloadContractPdf(row)}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-surface-base px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:border-border-strong hover:bg-surface-subtle hover:text-text-primary disabled:opacity-50"
          >
            <Download size={13} strokeWidth={1.75} />
            {downloadingId === row.id ? "..." : "PDF"}
          </button>
          {row.status === "ACTIVE" && (
            <button
              type="button"
              onClick={() => setRenewTarget(row)}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-surface-base px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:border-border-strong hover:bg-surface-subtle hover:text-text-primary"
            >
              <RefreshCw size={13} strokeWidth={1.75} />
              Yenile
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={FileSignature}
        title="Sözleşmeler"
        description="Müşteri sözleşmelerinizi ve sürelerini takip edin."
        actions={
          <>
            {healthCheck.length > 0 && (
              <button
                type="button"
                onClick={() => setHealthCheckOpen((v) => !v)}
                className="flex items-center gap-2 rounded-2xl border border-warning-100 bg-warning-50 px-4 py-2.5 text-sm font-semibold text-warning-600 transition hover:bg-warning-100"
              >
                <HeartPulse size={16} strokeWidth={2} />
                {healthCheck.length} otomasyon gecikmesi
              </button>
            )}
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="flex items-center gap-2 rounded-2xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition hover:bg-primary-700"
            >
              <Plus size={16} strokeWidth={2} />
              Yeni Sözleşme
            </button>
          </>
        }
      />

      {/* Bölüm E (2. tur): sözleşme otomasyon sağlık kontrolü — beklenen
          otomatik iş tarihi geçmiş ama iş hâlâ üretilmemiş sözleşmeler
          (normalde gerçekleşmemeli, cron çalışmadıysa/sunucu kesintisinde
          oluşur). bkz. GET /contracts/health-check. */}
      {healthCheckOpen && healthCheck.length > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-warning-100 bg-warning-50 p-5">
          <div className="flex items-center gap-2.5">
            <HeartPulse size={17} strokeWidth={1.75} className="text-warning-600" />
            <h2 className="text-sm font-semibold text-text-primary">Otomasyon Gecikmeleri</h2>
            <span className="rounded-full bg-warning-100 px-2 py-0.5 text-2xs font-semibold text-warning-700">
              {healthCheck.length}
            </span>
          </div>
          <p className="text-xs text-text-secondary">
            Bu sözleşmeler için beklenen otomatik iş tarihi geçmiş ama iş henüz oluşturulmamış — normalde her gece
            02:00&apos;deki otomatik görev bunu üretir; sunucu o sırada kapalıysa gecikme oluşabilir.
          </p>
          <ul className="flex flex-col gap-2">
            {healthCheck.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning-100 bg-surface-card p-3"
              >
                <div>
                  <p className="text-sm font-medium text-text-primary">{item.customerName}</p>
                  <p className="text-xs text-text-secondary">
                    {item.serviceType ?? "Hizmet belirtilmemiş"} · beklenen tarih {formatDate(item.nextGenerationDate)} ·{" "}
                    <span className="font-semibold text-warning-600">{item.daysOverdue} gün gecikmiş</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/isler?customerId=${item.customerId}${item.serviceType ? `&serviceType=${encodeURIComponent(item.serviceType)}` : ""}`
                    )
                  }
                  className="flex items-center gap-1.5 rounded-xl bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-700"
                >
                  <Wrench size={13} strokeWidth={1.75} />
                  Şimdi İş Oluştur
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* [Özet kartlar] — sayfadaki kayıtlardan değil, /contracts/summary'den. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Aktif sözleşme" value={loading || !summary ? "—" : String(summary.activeCount)} icon={FileText} mono />
        <StatCard
          label="Aylık tekrarlayan gelir"
          value={loading || !summary ? "—" : currencyFormatter.format(summary.monthlyRecurringRevenue)}
          icon={Wallet}
          accent="green"
          mono
          hint="Periyot aylığa normalize edilmiştir"
        />
        <StatCard
          label="30 gün içinde bitiyor"
          value={loading || !summary ? "—" : String(summary.expiringIn30DaysCount)}
          icon={CalendarClock}
          accent="red"
          mono
          badge={summary && summary.expiringIn30DaysCount > 0 ? { label: "Dikkat", tone: "critical" } : undefined}
        />
        <StatCard
          label="Tekrarlayan"
          value={loading ? "—" : String(contractStats.recurring)}
          icon={Repeat}
          accent="blue"
          mono
          hint="Otomatik iş üreten sözleşmeler"
        />
      </div>

      {/* [Durum dağılımı şeridi] */}
      <StatusStrip
        loading={loading}
        totalLabel={`${contracts.length} sözleşme`}
        segments={[
          { label: "aktif", count: contractStats.active, color: "#15803D" },
          { label: "yenilendi", count: contractStats.renewed, color: "#61A870" },
          { label: "süresi doldu", count: contractStats.expired, color: "#B57F13" },
          { label: "iptal", count: contractStats.cancelled, color: "#C0392B" },
        ]}
      />

      {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

      {expiring.length > 0 && (
        <div className="flex items-start gap-4 rounded-2xl border border-danger-100 border-l-4 border-l-danger-500 bg-danger-50 p-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-card text-danger-500 ring-1 ring-danger-100">
            <AlertTriangle size={20} strokeWidth={1.75} />
          </span>
          <div className="flex-1">
            <p className="font-bold text-danger-500">
              {expiring.length} sözleşme önümüzdeki 30 gün içinde sona eriyor
            </p>
            <ul className="mt-3 flex flex-col gap-2">
              {expiring.map((c) => (
                <li key={c.id} className="rounded-xl border border-danger-100 bg-surface-card p-3 text-sm text-text-secondary">
                  <span className="font-medium text-text-primary">{c.customer.fullName}</span> · {formatDate(c.endDate)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {renewalOnly && <DrillDownChip label="7 gün içinde yenilenecek sözleşmeler" onClear={() => setRenewalOnly(false)} />}

      <Table
        columns={columns}
        data={visibleContracts}
        keyField={(row) => row.id}
        loading={loading}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        emptyState={
          <EmptyState
            icon={FileText}
            title="Henüz sözleşme yok"
            description="İlk sözleşmeyi oluşturarak başlayın."
            actionLabel="Yeni Sözleşme"
            onAction={() => setFormOpen(true)}
          />
        }
      />

      <ContractFormModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} customers={customers} />

      <ConfirmDialog
        open={!!renewTarget}
        onClose={() => setRenewTarget(null)}
        onConfirm={handleRenew}
        title="Sözleşmeyi yenile"
        description={`Mevcut dönem kapatılıp ${renewTarget?.durationMonths ?? 0} aylık yeni bir dönem ${
          renewTarget ? formatDate(renewTarget.endDate) : ""
        } tarihinden itibaren başlatılacak. Devam edilsin mi?`}
        loading={renewing}
      />
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, FileText, AlertTriangle, FileSignature, CalendarClock, Repeat } from "lucide-react";
import { RequireRole } from "@/components/RequireRole";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { StatusStrip } from "@/components/StatusStrip";
import { Table, type Column } from "@/components/Table";
import { EmptyState } from "@/components/EmptyState";
import { api, ApiError } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Contract, Customer, Paginated } from "@/lib/types";
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [contractsRes, customersRes, expiringRes] = await Promise.all([
        api.get<Paginated<Contract>>(`/contracts?page=${page}&limit=20`),
        api.get<Paginated<Customer>>("/customers?limit=100"),
        api.get<{ data: ExpiringContract[] }>("/contracts/expiring"),
      ]);
      setContracts(contractsRes.data);
      setTotalPages(contractsRes.pagination.totalPages);
      setCustomers(customersRes.data);
      setExpiring(expiringRes.data);
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
      avatarLabel: (row) => customerNames[row.customerId] ?? "Müşteri",
      accessor: (row) => <span className="font-medium text-text-primary">{customerNames[row.customerId] ?? "Müşteri"}</span>,
    },
    { header: "Başlangıç", accessor: (row) => formatDate(row.startDate) },
    { header: "Bitiş", accessor: (row) => formatDate(row.endDate) },
    { header: "Süre", accessor: (row) => `${row.durationMonths} ay` },
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
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={FileSignature}
        title="Sözleşmeler"
        description="Müşteri sözleşmelerinizi ve sürelerini takip edin."
        actions={
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="flex items-center gap-2 rounded-2xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition hover:bg-primary-700"
          >
            <Plus size={16} strokeWidth={2} />
            Yeni Sözleşme
          </button>
        }
      />

      {/* [Özet kartlar] */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Aktif sözleşme" value={loading ? "—" : String(contractStats.active)} icon={FileText} mono />
        <StatCard
          label="30 gün içinde bitiyor"
          value={loading ? "—" : String(expiring.length)}
          icon={CalendarClock}
          accent="red"
          mono
          badge={expiring.length > 0 ? { label: "Dikkat", tone: "critical" } : undefined}
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
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-danger-500 ring-1 ring-danger-100">
            <AlertTriangle size={20} strokeWidth={1.75} />
          </span>
          <div className="flex-1">
            <p className="font-bold text-danger-500">
              {expiring.length} sözleşme önümüzdeki 30 gün içinde sona eriyor
            </p>
            <ul className="mt-3 flex flex-col gap-2">
              {expiring.map((c) => (
                <li key={c.id} className="rounded-xl border border-danger-100 bg-white p-3 text-sm text-text-secondary">
                  <span className="font-medium text-text-primary">{c.customer.fullName}</span> · {formatDate(c.endDate)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <Table
        columns={columns}
        data={contracts}
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
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, FileText, AlertTriangle } from "lucide-react";
import { RequireRole } from "@/components/RequireRole";
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
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-text-primary">Sözleşmeler</h1>
          <p className="mt-1 text-sm text-text-secondary">Müşteri sözleşmelerinizi ve sürelerini takip edin.</p>
        </div>
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-primary-green to-primary-green/90 px-4 py-2.5 text-sm font-semibold text-white transition hover:shadow-[0_0_20px_rgba(212,174,61,0.22)]"
        >
          <Plus size={16} strokeWidth={2} />
          Yeni Sözleşme
        </button>
      </div>

      {error && <p className="rounded-2xl bg-primary-red/10 px-4 py-3 text-sm text-primary-redLight">{error}</p>}

      {expiring.length > 0 && (
        <div className="flex items-start gap-4 rounded-2xl border-l-4 border-primary-red bg-gradient-to-r from-primary-red/10 to-transparent p-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-red/15 text-primary-redLight">
            <AlertTriangle size={20} strokeWidth={1.75} />
          </span>
          <div className="flex-1">
            <p className="font-bold text-primary-redLight">
              {expiring.length} sözleşme önümüzdeki 30 gün içinde sona eriyor
            </p>
            <ul className="mt-3 flex flex-col gap-2">
              {expiring.map((c) => (
                <li key={c.id} className="rounded-xl bg-surface-card/5 p-3 text-sm text-text-secondary">
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

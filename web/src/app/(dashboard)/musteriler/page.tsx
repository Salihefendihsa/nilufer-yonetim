"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Users } from "lucide-react";
import { RequireRole } from "@/components/RequireRole";
import { Table, type Column } from "@/components/Table";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { api, ApiError } from "@/lib/api";
import { formatDate, currencyFormatter } from "@/lib/format";
import type { Customer, CustomerDetail, Paginated } from "@/lib/types";
import { CustomerFormModal } from "./CustomerFormModal";
import { CustomerDetailPanel } from "./CustomerDetailPanel";

interface CustomerRow extends Customer {
  lastJobDate: string | null;
  outstandingBalance: number;
}

export default function CustomersPage() {
  return (
    <RequireRole roles={["OWNER", "MANAGER"]}>
      <CustomersPageContent />
    </RequireRole>
  );
}

function CustomersPageContent() {
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<Paginated<Customer>>(
        `/customers?page=${page}&limit=20${search ? `&search=${encodeURIComponent(search)}` : ""}`
      );

      const withDetails = await Promise.all(
        res.data.map(async (customer) => {
          try {
            const detail = await api.get<CustomerDetail>(`/customers/${customer.id}`);
            const lastJob = detail.jobs[0]?.scheduledAt ?? detail.jobs[0]?.createdAt ?? null;
            return { ...customer, lastJobDate: lastJob, outstandingBalance: detail.outstandingBalance };
          } catch {
            return { ...customer, lastJobDate: null, outstandingBalance: 0 };
          }
        })
      );

      setRows(withDetails);
      setTotalPages(res.pagination.totalPages);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Müşteriler yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/customers/${deleteTarget.id}`);
      setDeleteTarget(null);
      setDetailId(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Silinemedi");
    } finally {
      setDeleting(false);
    }
  }

  const columns: Column<CustomerRow>[] = [
    {
      header: "Ad Soyad",
      isPrimary: true,
      avatarLabel: (row) => row.fullName,
      accessor: (row) => <span className="font-medium text-text-primary">{row.fullName}</span>,
    },
    { header: "Telefon", accessor: (row) => row.phone },
    { header: "Son İş", accessor: (row) => formatDate(row.lastJobDate) },
    {
      header: "Bekleyen Bakiye",
      accessor: (row) => (
        <span className={row.outstandingBalance > 0 ? "font-medium text-primary-redLight" : "text-primary-greenLight"}>
          {currencyFormatter.format(Math.max(row.outstandingBalance, 0))}
        </span>
      ),
    },
  ];

  const editingTarget = rows.find((r) => r.id === detailId) ?? deleteTarget;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-text-primary">Müşteriler</h1>
          <p className="mt-1 text-sm text-text-secondary">Tüm müşterilerinizi buradan yönetin.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingCustomer(null);
            setFormOpen(true);
          }}
          className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-primary-green to-primary-green/90 px-4 py-2.5 text-sm font-semibold text-white transition hover:shadow-[0_0_20px_rgba(212,174,61,0.22)]"
        >
          <Plus size={16} strokeWidth={2} />
          Yeni Müşteri
        </button>
      </div>

      {error && <p className="rounded-2xl bg-primary-red/10 px-4 py-3 text-sm text-primary-redLight">{error}</p>}

      <Table
        columns={columns}
        data={rows}
        keyField={(row) => row.id}
        loading={loading}
        onRowClick={(row) => setDetailId(row.id)}
        search={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder="İsim, telefon veya semt ara..."
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        emptyState={
          <EmptyState
            icon={Users}
            title="Henüz müşteri yok"
            description="İlk müşterinizi ekleyerek başlayın."
            actionLabel="Yeni Müşteri"
            onAction={() => setFormOpen(true)}
          />
        }
      />

      <CustomerFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={load}
        customer={editingCustomer}
      />

      <CustomerDetailPanel
        customerId={detailId}
        onClose={() => setDetailId(null)}
        onEdit={() => {
          if (editingTarget) {
            setEditingCustomer(editingTarget);
            setFormOpen(true);
          }
        }}
        onDelete={() => {
          if (editingTarget) setDeleteTarget(editingTarget);
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Müşteriyi sil"
        description={`"${deleteTarget?.fullName}" adlı müşteriyi silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`}
        loading={deleting}
      />
    </div>
  );
}

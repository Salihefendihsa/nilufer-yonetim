"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Users, FileSpreadsheet, MapPin, Wallet } from "lucide-react";
import { RequireRole } from "@/components/RequireRole";
import { PageHeader } from "@/components/PageHeader";
import { StatusStrip } from "@/components/StatusStrip";
import { Table, type Column } from "@/components/Table";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/lib/ToastProvider";
import { api, ApiError, downloadFile } from "@/lib/api";
import { useInitialQueryParam } from "@/lib/useDrillDownFilter";
import { DrillDownChip } from "@/components/DrillDownChip";
import { formatDate, currencyFormatter } from "@/lib/format";
import type { Customer, CustomerListItem, Paginated } from "@/lib/types";
import { CustomerFormModal } from "./CustomerFormModal";
import { CustomerDetailPanel } from "./CustomerDetailPanel";
import { LoyalCustomerBadge } from "@/components/Badges";

/**
 * Bakiye, iş sayısı ve son iş tarihi artık /customers yanıtında sunucu
 * tarafında hesaplanıyor — eskiden her müşteri için ayrı bir detay isteği
 * atılıyordu (N+1).
 */
type CustomerRow = CustomerListItem;

export default function CustomersPage() {
  return (
    <RequireRole roles={["OWNER", "MANAGER"]}>
      <CustomersPageContent />
    </RequireRole>
  );
}

function CustomersPageContent() {
  const [rows, setRows] = useState<CustomerRow[]>([]);
  // Bölüm G: Yönetici Özeti → "Bekleyen Bakiye" (?filter=debt) / "Bu Ay Yeni Müşteri" (?filter=new).
  const drillFilter = useInitialQueryParam("filter");
  const [customerFilter, setCustomerFilter] = useState<"debt" | "new" | null>(null);
  useEffect(() => {
    if (drillFilter === "debt" || drillFilter === "new") setCustomerFilter(drillFilter);
  }, [drillFilter]);
  const visibleRows = useMemo(() => {
    if (customerFilter === "debt") return rows.filter((r) => r.outstandingBalance > 0);
    if (customerFilter === "new") {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      return rows.filter((r) => new Date(r.createdAt).getTime() >= startOfMonth);
    }
    return rows;
  }, [rows, customerFilter]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sort, setSort] = useState<"newest" | "name" | "balance">("newest");

  const [formOpen, setFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  // Bölüm I (3. tur): global aramadan gelen ?detailId= doğrudan detay panelini açar.
  const searchDetailId = useInitialQueryParam("detailId");
  useEffect(() => {
    if (searchDetailId) setDetailId(searchDetailId);
  }, [searchDetailId]);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const { showToast } = useToast();
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<Paginated<CustomerRow>>(
        `/customers?page=${page}&limit=20&sort=${sort}${search ? `&search=${encodeURIComponent(search)}` : ""}`
      );

      setRows(res.data);
      setTotalPages(res.pagination.totalPages);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Müşteriler yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [page, search, sort]);

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
      showToast("Müşteri silindi.");
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
      accessor: (row) => (
        <span className="inline-flex flex-wrap items-center gap-2 font-medium text-text-primary">
          {row.fullName}
          {row.isLoyal && <LoyalCustomerBadge />}
        </span>
      ),
    },
    { header: "Telefon", accessor: (row) => <span className="font-mono text-xs">{row.phone}</span> },
    {
      header: "Semt",
      accessor: (row) =>
        row.district ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-subtle px-2.5 py-1 text-xs font-medium text-text-secondary">
            <MapPin size={12} strokeWidth={2} />
            {row.district}
          </span>
        ) : (
          <span className="text-text-faint">—</span>
        ),
    },
    { header: "Son İş", accessor: (row) => formatDate(row.lastJobDate) },
    {
      header: "Sözleşme",
      accessor: (row) =>
        row.activeContractCount > 0 ? (
          <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-semibold text-primary-600">
            {row.activeContractCount} aktif
          </span>
        ) : (
          <span className="text-text-faint">—</span>
        ),
    },
    {
      header: "Bekleyen Bakiye",
      accessor: (row) => (
        <span className={row.outstandingBalance > 0 ? "font-medium text-danger-500" : "text-primary-600"}>
          {currencyFormatter.format(Math.max(row.outstandingBalance, 0))}
        </span>
      ),
    },
  ];

  // Sayfadaki müşterilerin bakiye dağılımı — ek istek olmadan mevcut satırlardan.
  const balanceSegments = useMemo(() => {
    const withDebt = rows.filter((r) => r.outstandingBalance > 0).length;
    const withRecentJob = rows.filter((r) => r.outstandingBalance <= 0 && r.lastJobDate !== null).length;
    const idle = rows.length - withDebt - withRecentJob;
    return [
      { label: "bakiyesi olan", count: withDebt, color: "#C0392B" },
      { label: "güncel", count: withRecentJob, color: "#15803D" },
      { label: "hiç iş almamış", count: Math.max(0, idle), color: "rgb(var(--border-strong))" },
    ];
  }, [rows]);

  const totalOutstanding = useMemo(
    () => rows.reduce((sum, r) => sum + Math.max(r.outstandingBalance, 0), 0),
    [rows]
  );

  const editingTarget = rows.find((r) => r.id === detailId) ?? deleteTarget;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Users}
        title="Müşteriler"
        description="Tüm müşterilerinizi buradan yönetin."
        actions={
          <>
            <button
              type="button"
              onClick={() => downloadFile("/customers/export/excel", "musteriler.xlsx")}
              className="flex items-center gap-2 rounded-2xl border border-border bg-surface-base px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:border-border-strong hover:bg-surface-subtle hover:text-text-primary"
            >
              <FileSpreadsheet size={16} strokeWidth={1.75} />
              Excel&apos;e Aktar
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingCustomer(null);
                setFormOpen(true);
              }}
              className="flex items-center gap-2 rounded-2xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition hover:bg-primary-700"
            >
              <Plus size={16} strokeWidth={2} />
              Yeni Müşteri
            </button>
          </>
        }
      />

      {/* [Durum dağılımı şeridi] */}
      <StatusStrip
        loading={loading}
        totalLabel={`${rows.length} müşteri`}
        segments={balanceSegments}
        action={
          <span className="flex items-center gap-2 rounded-full bg-danger-50 px-3 py-1 text-xs font-semibold text-danger-500">
            <Wallet size={13} strokeWidth={2} />
            {currencyFormatter.format(totalOutstanding)} bekleyen bakiye
          </span>
        }
      />

      {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

      {/* [Sıralama] — bakiyeye göre sıralama, sunucudan gelen bakiye alanını kullanır. */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { key: "newest", label: "En Yeni" },
            { key: "name", label: "İsme Göre" },
            { key: "balance", label: "Bakiyeye Göre" },
          ] as const
        ).map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => {
              setSort(option.key);
              setPage(1);
            }}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              sort === option.key
                ? "bg-primary-600 text-white"
                : "border border-border bg-surface-base text-text-secondary hover:bg-surface-subtle"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {customerFilter && (
        <DrillDownChip
          label={customerFilter === "debt" ? "Bakiyesi olan müşteriler" : "Bu ay eklenen müşteriler"}
          onClear={() => setCustomerFilter(null)}
        />
      )}

      <Table
        columns={columns}
        data={visibleRows}
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

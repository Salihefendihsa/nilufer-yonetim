"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, PackagePlus, Boxes, Trash2, AlertTriangle } from "lucide-react";
import { RequireRole } from "@/components/RequireRole";
import { Table, type Column } from "@/components/Table";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { api, ApiError } from "@/lib/api";
import type { Product, Paginated } from "@/lib/types";
import { ProductFormModal } from "./ProductFormModal";
import { RestockModal } from "./RestockModal";

export default function StockPage() {
  return (
    <RequireRole roles={["OWNER", "MANAGER"]}>
      <StockPageContent />
    </RequireRole>
  );
}

function StockPageContent() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [restockTarget, setRestockTarget] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<Paginated<Product>>(
        `/products?page=${page}&limit=20${search ? `&search=${encodeURIComponent(search)}` : ""}`
      );
      setProducts(res.data);
      setTotalPages(res.pagination.totalPages);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Ürünler yüklenemedi");
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
      await api.delete(`/products/${deleteTarget.id}`);
      setDeleteTarget(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Silinemedi");
    } finally {
      setDeleting(false);
    }
  }

  const columns: Column<Product>[] = [
    {
      header: "Ürün",
      isPrimary: true,
      avatarLabel: (row) => row.name,
      accessor: (row) => <span className="font-medium text-text-primary">{row.name}</span>,
    },
    {
      header: "Mevcut Stok",
      accessor: (row) => {
        const critical = row.currentStock <= row.criticalThreshold;
        return (
          <span className="flex items-center gap-2">
            <span className={critical ? "font-semibold text-primary-redLight" : "text-text-primary"}>
              {row.currentStock} {row.unit}
            </span>
            {critical && (
              <span className="inline-flex items-center gap-1 rounded-full border border-primary-redLight/30 bg-primary-redLight/10 px-2 py-0.5 text-[10px] font-semibold text-primary-redLight">
                <AlertTriangle size={10} strokeWidth={2} />
                Kritik
              </span>
            )}
          </span>
        );
      },
    },
    { header: "Kritik Seviye", accessor: (row) => `${row.criticalThreshold} ${row.unit}` },
    {
      header: "",
      className: "text-right",
      accessor: (row) => (
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setRestockTarget(row)}
            className="flex items-center gap-1.5 rounded-2xl bg-white/5 px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-white/10"
          >
            <PackagePlus size={13} strokeWidth={1.75} />
            Stok Ekle
          </button>
          <button
            type="button"
            onClick={() => setDeleteTarget(row)}
            className="flex items-center gap-1.5 rounded-2xl bg-primary-redLight/10 px-3 py-1.5 text-xs font-medium text-primary-redLight transition hover:bg-primary-redLight/20"
          >
            <Trash2 size={13} strokeWidth={1.75} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-text-primary">Stok</h1>
          <p className="mt-1 text-sm text-text-secondary">İlaç ve ekipman stoğunuzu buradan takip edin.</p>
        </div>
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-primary-green to-primary-green/90 px-4 py-2.5 text-sm font-semibold text-white transition hover:shadow-[0_0_20px_rgba(212,174,61,0.22)]"
        >
          <Plus size={16} strokeWidth={2} />
          Yeni Ürün
        </button>
      </div>

      {error && <p className="rounded-2xl bg-primary-redLight/10 px-4 py-3 text-sm text-primary-redLight">{error}</p>}

      <Table
        columns={columns}
        data={products}
        keyField={(row) => row.id}
        loading={loading}
        search={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder="Ürün ara..."
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        emptyState={
          <EmptyState
            icon={Boxes}
            title="Henüz ürün yok"
            description="İlk ürününüzü ekleyerek stok takibine başlayın."
            actionLabel="Yeni Ürün"
            onAction={() => setFormOpen(true)}
          />
        }
      />

      <ProductFormModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} />
      <RestockModal open={!!restockTarget} onClose={() => setRestockTarget(null)} onSaved={load} product={restockTarget} />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Ürünü sil"
        description={`"${deleteTarget?.name}" ürününü silmek istediğinize emin misiniz?`}
        loading={deleting}
      />
    </div>
  );
}

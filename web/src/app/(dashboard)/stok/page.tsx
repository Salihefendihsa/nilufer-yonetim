"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, PackagePlus, Boxes, Trash2, AlertTriangle, PackageCheck, Layers } from "lucide-react";
import { RequireRole } from "@/components/RequireRole";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { StatusStrip } from "@/components/StatusStrip";
import { ChartCard, RankBars } from "@/components/ChartCard";
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

  // Kart, şerit ve grafik aynı ürün listesinden hesaplanır — ek istek yok.
  const stock = useMemo(() => {
    const critical = products.filter((p) => Number(p.currentStock) <= Number(p.criticalThreshold)).length;
    return { critical, healthy: products.length - critical };
  }, [products]);

  const stockRows = useMemo(
    () =>
      products
        .slice()
        .sort((a, b) => Number(a.currentStock) - Number(b.currentStock))
        .slice(0, 8)
        .map((p) => ({
          label: p.name,
          value: Number(p.currentStock),
          meta: `${p.currentStock} ${p.unit}`,
        })),
    [products]
  );

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
            <span className={critical ? "font-semibold text-danger-500" : "text-text-primary"}>
              {row.currentStock} {row.unit}
            </span>
            {critical && (
              <span className="inline-flex items-center gap-1 rounded-full border border-danger-100 bg-danger-50 px-2 py-0.5 text-[10px] font-semibold text-danger-500">
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
            className="flex items-center gap-1.5 rounded-xl border border-border bg-surface-base px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:border-border-strong hover:bg-surface-subtle hover:text-text-primary"
          >
            <PackagePlus size={13} strokeWidth={1.75} />
            Stok Ekle
          </button>
          <button
            type="button"
            onClick={() => setDeleteTarget(row)}
            className="flex items-center gap-1.5 rounded-xl border border-danger-100 bg-danger-50 px-3 py-1.5 text-xs font-medium text-danger-500 transition hover:bg-danger-100"
          >
            <Trash2 size={13} strokeWidth={1.75} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Boxes}
        title="Stok"
        description="İlaç ve ekipman stoğunuzu buradan takip edin."
        actions={
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="flex items-center gap-2 rounded-2xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition hover:bg-primary-700"
          >
            <Plus size={16} strokeWidth={2} />
            Yeni Ürün
          </button>
        }
      />

      {/* [Özet kartlar] */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Ürün çeşidi" value={loading ? "—" : String(products.length)} icon={Layers} mono />
        <StatCard
          label="Kritik seviyede"
          value={loading ? "—" : String(stock.critical)}
          icon={AlertTriangle}
          accent="red"
          mono
          badge={stock.critical > 0 ? { label: "Kritik", tone: "critical" } : undefined}
        />
        <StatCard
          label="Yeterli stoklu"
          value={loading ? "—" : String(stock.healthy)}
          icon={PackageCheck}
          mono
          progress={products.length > 0 ? (stock.healthy / products.length) * 100 : 0}
        />
      </div>

      {/* [Durum dağılımı şeridi] */}
      <StatusStrip
        loading={loading}
        totalLabel={`${products.length} ürün`}
        segments={[
          { label: "yeterli", count: stock.healthy, color: "#15803D" },
          { label: "kritik", count: stock.critical, color: "#C0392B" },
        ]}
      />

      {/* [Grafik] */}
      <ChartCard title="Stok Seviyeleri" description="Kritik eşiğe göre mevcut miktar" icon={Boxes} height={220}>
        <RankBars rows={stockRows} emptyLabel={loading ? "Yükleniyor..." : "Ürün yok"} />
      </ChartCard>

      {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

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

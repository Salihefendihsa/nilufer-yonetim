"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, PackagePlus, Boxes, Trash2, AlertTriangle,
  Timer, PackageCheck, Layers, ShoppingCart, History, ClipboardList } from "lucide-react";
import { RequireRole } from "@/components/RequireRole";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { StatusStrip } from "@/components/StatusStrip";
import { ChartCard, RankBars } from "@/components/ChartCard";
import { Table, type Column } from "@/components/Table";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthProvider";
import { useToast } from "@/lib/ToastProvider";
import type { Product, ProductCategory, Paginated } from "@/lib/types";
import { formatDateTime, decimalValue } from "@/lib/format";
import { useInitialQueryParam } from "@/lib/useDrillDownFilter";
import { DrillDownChip } from "@/components/DrillDownChip";
import { ProductFormModal } from "./ProductFormModal";
import { RestockModal } from "./RestockModal";
import { PurchaseRequestModal } from "./PurchaseRequestModal";
import { PurchaseRequestsPanel } from "./PurchaseRequestsPanel";
import { SuppliersPanel } from "./SuppliersPanel";
import { MovementsModal } from "./MovementsModal";
import { StockCountModal } from "./StockCountModal";

const CATEGORY_LABELS: Record<ProductCategory, string> = {
  BIOCIDAL: "Kimyasal",
  CONSUMABLE: "Sarf Malzemesi",
  EQUIPMENT: "Ekipman",
  DISINFECTANT: "Dezenfektan",
};
const CATEGORY_FILTERS: { key: ProductCategory | "ALL"; label: string }[] = [
  { key: "ALL", label: "Tüm Kalemler" },
  { key: "BIOCIDAL", label: "Kimyasallar" },
  { key: "CONSUMABLE", label: "Sarf Malzemesi" },
  { key: "EQUIPMENT", label: "Ekipman & Parça" },
  { key: "DISINFECTANT", label: "Dezenfektan" },
];

export default function StockPage() {
  return (
    // Şef stok sayfasını SALT OKUNUR görür; tek yazma aksiyonu "Satın Alma
    // Talebi"dir (backend: POST /products/:id/purchase-requests TEAM_LEAD'e
    // açık, listeleme/mal kabul/iptal OWNER-MANAGER'da kalır).
    <RequireRole roles={["OWNER", "MANAGER", "TEAM_LEAD"]}>
      <StockPageContent />
    </RequireRole>
  );
}

function StockPageContent() {
  const { user } = useAuth();
  /** Ürün ekleme/silme, stok girişi, sayım, hareket geçmişi ve talep kuyruğu
   *  backend'de OWNER/MANAGER'a kısıtlı — şefe hiç gösterilmez. */
  const canManage = user?.role === "OWNER" || user?.role === "MANAGER";

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<ProductCategory | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [restockTarget, setRestockTarget] = useState<Product | null>(null);
  const [purchaseTarget, setPurchaseTarget] = useState<Product | null>(null);
  const [movementsTarget, setMovementsTarget] = useState<Product | null>(null);
  const [countTarget, setCountTarget] = useState<Product | null>(null);
  // Mal kabulü stoğu değiştirdiği için panelin de yenilenmesi gerekir.
  const [purchaseRefreshKey, setPurchaseRefreshKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Bölüm G: Yönetici Özeti → "Kritik Stok" kartı (?filter=critical).
  const drillFilter = useInitialQueryParam("filter");
  const [criticalOnly, setCriticalOnly] = useState(false);
  useEffect(() => {
    if (drillFilter === "critical") setCriticalOnly(true);
  }, [drillFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const categoryQuery = category === "ALL" ? "" : `&category=${category}`;
      const res = await api.get<Paginated<Product>>(
        `/products?page=${page}&limit=20${search ? `&search=${encodeURIComponent(search)}` : ""}${categoryQuery}`
      );
      setProducts(res.data);
      setTotalPages(res.pagination.totalPages);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Ürünler yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [page, search, category]);

  useEffect(() => {
    load();
  }, [load]);

  const { showToast } = useToast();

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/products/${deleteTarget.id}`);
      setDeleteTarget(null);
      load();
      showToast("Ürün silindi.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Silinemedi");
    } finally {
      setDeleting(false);
    }
  }

  // Kart, şerit ve grafik aynı ürün listesinden hesaplanır — ek istek yok.
  const stock = useMemo(() => {
    const critical = products.filter((p) => decimalValue(p.currentStock) <= decimalValue(p.criticalThreshold)).length;
    return { critical, healthy: products.length - critical };
  }, [products]);

  const visibleProducts = useMemo(
    () =>
      criticalOnly
        ? products.filter((p) => decimalValue(p.currentStock) <= decimalValue(p.criticalThreshold))
        : products,
    [products, criticalOnly]
  );

  const stockRows = useMemo(
    () =>
      products
        .slice()
        .sort((a, b) => decimalValue(a.currentStock) - decimalValue(b.currentStock))
        .slice(0, 8)
        .map((p) => ({
          label: p.name,
          value: decimalValue(p.currentStock),
          meta: `${p.currentStock} ${p.unit}`,
        })),
    [products]
  );

  const columns: Column<Product>[] = [
    {
      header: "Ürün",
      isPrimary: true,
      avatarLabel: (row) => row.name,
      accessor: (row) => (
        <span className="flex flex-col">
          <span className="font-medium text-text-primary">{row.name}</span>
          {(row.code || row.description) && (
            <span className="text-xs text-text-secondary">
              {row.code ? <span className="font-mono">{row.code}</span> : null}
              {row.code && row.description ? " · " : ""}
              {row.description ?? ""}
            </span>
          )}
        </span>
      ),
    },
    {
      header: "Mevcut Stok",
      accessor: (row) => {
        const critical = decimalValue(row.currentStock) <= decimalValue(row.criticalThreshold);
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
            {/* Bölüm W (5. tur): kullanım bazlı tahmin — veri yoksa hiçbir şey gösterilmez */}
            {row.forecast?.estimatedDaysRemaining !== null && row.forecast?.estimatedDaysRemaining !== undefined && (
              <span
                title={`Son ${row.forecast.windowDays} günde ${row.forecast.usedInWindow} ${row.unit} kullanıldı · günde ~${row.forecast.dailyAverageUsage} ${row.unit}`}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  row.forecast.estimatedDaysRemaining <= 7 ? "bg-danger-50 text-danger-500" : row.forecast.estimatedDaysRemaining <= 30 ? "bg-warning-50 text-warning-600" : "bg-surface-subtle text-text-secondary"
                }`}
              >
                <Timer size={10} strokeWidth={2} />
                {row.forecast.estimatedDaysRemaining === 0 ? "Tükendi" : `Tahmini ${row.forecast.estimatedDaysRemaining} gün sonra biter`}
              </span>
            )}
          </span>
        );
      },
    },
    {
      header: "Kategori",
      accessor: (row) => (
        <span className="rounded-full bg-surface-subtle px-2.5 py-1 text-xs font-medium text-text-secondary">
          {CATEGORY_LABELS[row.category]}
        </span>
      ),
    },
    { header: "Kritik Seviye", accessor: (row) => `${row.criticalThreshold} ${row.unit}` },
    {
      header: "Son Hareket",
      accessor: (row) =>
        row.lastMovement ? (
          <span className="flex flex-col text-xs">
            <span className={row.lastMovement.type === "IN" ? "text-success-500" : "text-danger-500"}>
              {row.lastMovement.type === "IN" ? "+" : "−"}
              {decimalValue(row.lastMovement.quantity)} {row.unit}
            </span>
            <span className="text-text-secondary">{formatDateTime(row.lastMovement.createdAt)}</span>
          </span>
        ) : (
          <span className="text-xs text-text-secondary">Hareket yok</span>
        ),
    },
    {
      header: "Sipariş Bekleyen",
      accessor: (row) =>
        row.pendingPurchaseQuantity ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-info-100 bg-info-50 px-2 py-0.5 text-[11px] font-semibold text-info-500">
            <ShoppingCart size={11} strokeWidth={2} />
            {row.pendingPurchaseQuantity} {row.unit}
          </span>
        ) : (
          <span className="text-xs text-text-secondary">—</span>
        ),
    },
    {
      header: "",
      className: "text-right",
      accessor: (row) => (
        <div className="flex justify-end gap-2">
          {canManage && (
          <button
            type="button"
            onClick={() => setMovementsTarget(row)}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-surface-base px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:border-border-strong hover:bg-surface-subtle hover:text-text-primary"
          >
            <History size={13} strokeWidth={1.75} />
            Hareketler
          </button>
          )}
          {canManage && (
          <button
            type="button"
            onClick={() => setCountTarget(row)}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-surface-base px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:border-border-strong hover:bg-surface-subtle hover:text-text-primary"
          >
            <ClipboardList size={13} strokeWidth={1.75} />
            Fiili Sayım Gir
          </button>
          )}
          <button
            type="button"
            onClick={() => setPurchaseTarget(row)}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-surface-base px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:border-border-strong hover:bg-surface-subtle hover:text-text-primary"
          >
            <ShoppingCart size={13} strokeWidth={1.75} />
            Satın Alma Talebi
          </button>
          {canManage && (
          <button
            type="button"
            onClick={() => setRestockTarget(row)}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-surface-base px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:border-border-strong hover:bg-surface-subtle hover:text-text-primary"
          >
            <PackagePlus size={13} strokeWidth={1.75} />
            Stok Ekle
          </button>
          )}
          {canManage && (
          <button
            type="button"
            onClick={() => setDeleteTarget(row)}
            className="flex items-center gap-1.5 rounded-xl border border-danger-100 bg-danger-50 px-3 py-1.5 text-xs font-medium text-danger-500 transition hover:bg-danger-100"
          >
            <Trash2 size={13} strokeWidth={1.75} />
          </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Boxes}
        title="Stok"
        description={
          canManage
            ? "İlaç ve ekipman stoğunuzu buradan takip edin."
            : "Stok durumunu görüntüleyebilir ve takviye talebi açabilirsiniz; talebi yönetim sonuçlandırır."
        }
        actions={
          canManage ? (
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="flex items-center gap-2 rounded-2xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition hover:bg-primary-700"
            >
              <Plus size={16} strokeWidth={2} />
              Yeni Ürün
            </button>
          ) : undefined
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

      {/* [Kategori filtresi] */}
      <div className="flex flex-wrap gap-2">
        {CATEGORY_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => {
              setCategory(f.key);
              setPage(1);
            }}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              category === f.key
                ? "bg-primary-600 text-white"
                : "border border-border bg-surface-base text-text-secondary hover:bg-surface-subtle"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {criticalOnly && <DrillDownChip label="Yalnızca kritik stok" onClear={() => setCriticalOnly(false)} />}

      <Table
        columns={columns}
        data={visibleProducts}
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
            actionLabel={canManage ? "Yeni Ürün" : undefined}
            onAction={canManage ? () => setFormOpen(true) : undefined}
          />
        }
      />

      {canManage && <PurchaseRequestsPanel key={purchaseRefreshKey} onChanged={load} />}
      {canManage && <SuppliersPanel />}

      <ProductFormModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} />
      <RestockModal open={!!restockTarget} onClose={() => setRestockTarget(null)} onSaved={load} product={restockTarget} />
      <PurchaseRequestModal
        open={!!purchaseTarget}
        onClose={() => setPurchaseTarget(null)}
        onSaved={() => {
          load();
          setPurchaseRefreshKey((k) => k + 1);
        }}
        product={purchaseTarget}
      />
      <MovementsModal open={!!movementsTarget} onClose={() => setMovementsTarget(null)} product={movementsTarget} />
      <StockCountModal
        open={!!countTarget}
        onClose={() => setCountTarget(null)}
        onSaved={load}
        product={countTarget}
      />

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

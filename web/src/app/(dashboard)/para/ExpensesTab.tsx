"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Receipt, Pencil, Trash2 } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { Table, type Column } from "@/components/Table";
import { EmptyState } from "@/components/EmptyState";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/lib/ToastProvider";
import { currencyFormatter, formatDate } from "@/lib/format";
import type { Expense, ExpenseCategory, Paginated } from "@/lib/types";
import { ExpenseFormModal, EXPENSE_CATEGORY_LABELS } from "./ExpenseFormModal";

const ALL_CATEGORIES: ExpenseCategory[] = ["FUEL", "CHEMICALS", "EQUIPMENT", "RENT", "UTILITIES", "OTHER"];

export function ExpensesTab() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [category, setCategory] = useState<ExpenseCategory | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { showToast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ page: String(page), limit: "20" });
      if (category) qs.set("category", category);
      const res = await api.get<Paginated<Expense>>(`/expenses?${qs.toString()}`);
      setExpenses(res.data);
      setTotalPages(res.pagination.totalPages);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Giderler yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [page, category]);

  useEffect(() => {
    load();
  }, [load]);

  const categoryTotals = useMemo(() => {
    const totals: Partial<Record<ExpenseCategory, number>> = {};
    for (const e of expenses) {
      totals[e.category] = (totals[e.category] ?? 0) + e.amount;
    }
    return totals;
  }, [expenses]);

  const monthTotal = useMemo(() => expenses.reduce((sum, e) => sum + e.amount, 0), [expenses]);

  async function handleDelete(id: string) {
    if (!confirm("Bu gideri silmek istediğinize emin misiniz?")) return;
    setDeletingId(id);
    try {
      await api.delete(`/expenses/${id}`);
      showToast("Gider silindi.");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Silinemedi");
    } finally {
      setDeletingId(null);
    }
  }

  const columns: Column<Expense>[] = [
    {
      header: "Kategori",
      isPrimary: true,
      accessor: (row) => <span className="font-medium text-text-primary">{EXPENSE_CATEGORY_LABELS[row.category]}</span>,
    },
    { header: "Tutar", accessor: (row) => <span className="font-medium text-text-primary">{currencyFormatter.format(row.amount)}</span> },
    { header: "Açıklama", accessor: (row) => row.description ?? <span className="text-text-faint">—</span> },
    { header: "Tarih", accessor: (row) => formatDate(row.date) },
    { header: "Kaydeden", accessor: (row) => row.recordedByUser?.fullName ?? <span className="text-text-faint">—</span> },
    {
      header: "İşlemler",
      accessor: (row) => (
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Düzenle"
            title="Düzenle"
            onClick={() => {
              setEditingExpense(row);
              setFormOpen(true);
            }}
            className="flex h-7 w-7 items-center justify-center rounded-xl text-text-faint transition hover:bg-surface-subtle hover:text-text-primary"
          >
            <Pencil size={15} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            aria-label="Sil"
            title="Sil"
            disabled={deletingId === row.id}
            onClick={() => handleDelete(row.id)}
            className="flex h-7 w-7 items-center justify-center rounded-xl text-text-faint transition hover:bg-danger-50 hover:text-danger-500 disabled:opacity-50"
          >
            <Trash2 size={15} strokeWidth={1.75} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Bu sayfadaki toplam gider" value={currencyFormatter.format(monthTotal)} icon={Receipt} accent="red" mono />
        {ALL_CATEGORIES.filter((c) => categoryTotals[c]).map((c) => (
          <StatCard key={c} label={EXPENSE_CATEGORY_LABELS[c]} value={currencyFormatter.format(categoryTotals[c] ?? 0)} icon={Receipt} accent="neutral" mono />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setCategory("");
              setPage(1);
            }}
            className={`rounded-xl px-3.5 py-2 text-sm font-medium transition ${
              category === "" ? "bg-primary-600 text-white shadow-card" : "border border-border bg-surface-card text-text-secondary hover:bg-surface-subtle"
            }`}
          >
            Tümü
          </button>
          {ALL_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                setCategory(c);
                setPage(1);
              }}
              className={`rounded-xl px-3.5 py-2 text-sm font-medium transition ${
                category === c ? "bg-primary-600 text-white shadow-card" : "border border-border bg-surface-card text-text-secondary hover:bg-surface-subtle"
              }`}
            >
              {EXPENSE_CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingExpense(null);
            setFormOpen(true);
          }}
          className="flex items-center gap-2 rounded-2xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition hover:bg-primary-700"
        >
          <Plus size={16} strokeWidth={2} />
          Yeni Gider
        </button>
      </div>

      <Table
        columns={columns}
        data={expenses}
        keyField={(row) => row.id}
        loading={loading}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        emptyState={
          <EmptyState
            icon={Receipt}
            title="Henüz gider yok"
            description="İlk gideri kaydederek başlayın."
            actionLabel="Yeni Gider"
            onAction={() => {
              setEditingExpense(null);
              setFormOpen(true);
            }}
          />
        }
      />

      <ExpenseFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={load}
        expense={editingExpense}
      />
    </div>
  );
}

"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Modal } from "@/components/Modal";
import { useToast } from "@/lib/ToastProvider";
import { api, ApiError } from "@/lib/api";
import type { Expense, ExpenseCategory } from "@/lib/types";

interface ExpenseFormModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  expense?: Expense | null;
}

const EXPENSE_CATEGORIES: ExpenseCategory[] = ["FUEL", "CHEMICALS", "EQUIPMENT", "RENT", "UTILITIES", "OTHER"];
export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  FUEL: "Yakıt",
  CHEMICALS: "Kimyasal/İlaç",
  EQUIPMENT: "Ekipman",
  RENT: "Kira",
  UTILITIES: "Faturalar",
  OTHER: "Diğer",
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function ExpenseFormModal({ open, onClose, onSaved, expense }: ExpenseFormModalProps) {
  const [category, setCategory] = useState<ExpenseCategory>(EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(todayIso());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (open) {
      setCategory(expense?.category ?? EXPENSE_CATEGORIES[0]);
      setAmount(expense ? String(expense.amount) : "");
      setDescription(expense?.description ?? "");
      setDate(expense ? expense.date.slice(0, 10) : todayIso());
      setError(null);
    }
  }, [open, expense]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const payload = {
        category,
        amount: Number(amount),
        description: description.trim() || undefined,
        date,
      };
      if (expense) {
        await api.patch(`/expenses/${expense.id}`, payload);
        showToast("Gider güncellendi.");
      } else {
        await api.post("/expenses", payload);
        showToast("Gider kaydedildi.");
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kaydedilemedi, tekrar deneyin");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={expense ? "Gideri Düzenle" : "Yeni Gider Ekle"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Kategori</label>
          <select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)} className="input">
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {EXPENSE_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Tutar (₺)</label>
            <input
              required
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input"
              placeholder="Örn. 850"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Tarih</label>
            <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Açıklama (opsiyonel)</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input"
            placeholder="Örn. Şirket aracı yakıt gideri"
          />
        </div>

        {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

        <div className="mt-2 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-2xl px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:bg-surface-subtle">
            Vazgeç
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-2xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition hover:bg-primary-700 disabled:opacity-60"
          >
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

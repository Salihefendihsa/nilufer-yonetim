"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Modal } from "@/components/Modal";
import { api, ApiError } from "@/lib/api";

interface ProductFormModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: "BIOCIDAL", label: "Kimyasal (Biyosidal)" },
  { value: "CONSUMABLE", label: "Sarf Malzemesi (Kemirgen Yemi vb.)" },
  { value: "EQUIPMENT", label: "Ekipman" },
  { value: "DISINFECTANT", label: "Dezenfektan" },
];

export function ProductFormModal({ open, onClose, onSaved }: ProductFormModalProps) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [unit, setUnit] = useState("litre");
  const [category, setCategory] = useState("BIOCIDAL");
  const [currentStock, setCurrentStock] = useState("0");
  const [criticalThreshold, setCriticalThreshold] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setCode("");
      setName("");
      setDescription("");
      setUnit("litre");
      setCategory("BIOCIDAL");
      setCurrentStock("0");
      setCriticalThreshold("");
      setError(null);
    }
  }, [open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      await api.post("/products", {
        code: code.trim() || undefined,
        description: description.trim() || undefined,
        name,
        unit,
        category,
        currentStock: Number(currentStock),
        criticalThreshold: Number(criticalThreshold),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kaydedilemedi, tekrar deneyin");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Yeni Ürün">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Ürün Kodu</label>
            <input value={code} onChange={(e) => setCode(e.target.value)} className="input" placeholder="Örn. KM-1042" />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label className="text-sm font-medium text-text-secondary">Ürün Adı</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Örn. Deltamethrin" />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Açıklama (opsiyonel)</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className="input" placeholder="Kullanım alanı, doz notu vb." />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Birim</label>
            <select value={unit} onChange={(e) => setUnit(e.target.value)} className="input">
              <option value="litre">Litre</option>
              <option value="kg">Kg</option>
              <option value="adet">Adet</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Kategori</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="input">
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Başlangıç Stoğu</label>
            <input required type="number" min={0} step="0.01" value={currentStock} onChange={(e) => setCurrentStock(e.target.value)} className="input" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Kritik Seviye</label>
            <input required type="number" min={0} step="0.01" value={criticalThreshold} onChange={(e) => setCriticalThreshold(e.target.value)} className="input" />
          </div>
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

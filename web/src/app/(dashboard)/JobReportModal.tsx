"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Camera } from "lucide-react";
import { Modal } from "@/components/Modal";
import { SignaturePad } from "@/components/SignaturePad";
import { JobChecklist } from "@/components/JobChecklist";
import { api, ApiError, uploadFile } from "@/lib/api";
import type { Product, Paginated } from "@/lib/types";

interface JobReportModalProps {
  open: boolean;
  onClose: () => void;
  onCompleted: () => void;
  jobId: string | null;
}

interface UsedProductRow {
  productId: string;
  quantity: string;
}

export function JobReportModal({ open, onClose, onCompleted, jobId }: JobReportModalProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [usedProducts, setUsedProducts] = useState<UsedProductRow[]>([{ productId: "", quantity: "" }]);
  const [dosage, setDosage] = useState("");
  const [note, setNote] = useState("");
  const [beforePhoto, setBeforePhoto] = useState<File | null>(null);
  const [afterPhoto, setAfterPhoto] = useState<File | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const signatureKeyRef = useRef(0);
  // Fotoğraflar rapordan ÖNCE yüklenir (rapor işi tamamlar ve nihai durumdur).
  // Rapor başarısız olup kullanıcı tekrar denerse aynı fotoğraf ikinci kez yüklenmesin.
  const uploadedRef = useRef({ BEFORE: false, AFTER: false });

  useEffect(() => {
    if (open) {
      setUsedProducts([{ productId: "", quantity: "" }]);
      setDosage("");
      setNote("");
      setBeforePhoto(null);
      setAfterPhoto(null);
      setSignature(null);
      setError(null);
      signatureKeyRef.current += 1;
      uploadedRef.current = { BEFORE: false, AFTER: false };
      api
        .get<Paginated<Product>>("/products?limit=100")
        .then((res) => setProducts(res.data))
        .catch(() => setProducts([]));
    }
  }, [open]);

  async function uploadPhoto(id: string, file: File, type: "BEFORE" | "AFTER") {
    const formData = new FormData();
    formData.append("photo", file);
    formData.append("type", type);
    await uploadFile(`/jobs/${id}/photos`, formData);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!jobId) return;
    setError(null);

    const rows = usedProducts.filter((r) => r.productId);
    const ids = rows.map((r) => r.productId);
    if (new Set(ids).size !== ids.length) {
      setError("Aynı ürün birden fazla kez seçilemez");
      return;
    }
    if (rows.some((r) => !r.quantity || Number(r.quantity) <= 0)) {
      setError("Seçilen her ürün için geçerli bir miktar girin");
      return;
    }

    setSaving(true);

    try {
      // 1) Harici adım (dosya yükleme): başarısız olursa hiçbir rapor/stok/durum
      //    değişikliği yapılmamıştır; kullanıcı formu tekrar gönderebilir.
      if (beforePhoto && !uploadedRef.current.BEFORE) {
        await uploadPhoto(jobId, beforePhoto, "BEFORE");
        uploadedRef.current.BEFORE = true;
      }
      if (afterPhoto && !uploadedRef.current.AFTER) {
        await uploadPhoto(jobId, afterPhoto, "AFTER");
        uploadedRef.current.AFTER = true;
      }

      // 2) Rapor + stok çıkışı + işi tamamlama backend'de TEK transaction'dır;
      //    ayrı bir durum PATCH'i yoktur, yarım kalan durum oluşmaz.
      await api.post(`/jobs/${jobId}/report`, {
        products: rows.map((r) => ({ productId: r.productId, quantity: Number(r.quantity) })),
        dosage,
        notes: note || undefined,
        signatureBase64: signature ?? undefined,
      });
      onCompleted();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Tamamlanamadı, tekrar deneyin");
    } finally {
      setSaving(false);
    }
  }

  function updateRow(index: number, patch: Partial<UsedProductRow>) {
    setUsedProducts((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setUsedProducts((rows) => [...rows, { productId: "", quantity: "" }]);
  }

  function removeRow(index: number) {
    setUsedProducts((rows) => rows.filter((_, i) => i !== index));
  }

  return (
    <Modal open={open} onClose={onClose} title="İşi Tamamla">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Bölüm N: rapor öncesi kontrol listesi — eksikler görünür kalır, gönderim engellenmez. */}
        <JobChecklist jobId={open ? jobId : null} />

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-text-secondary">Kullanılan Ürünler (Stoktan Düşüm)</label>
          {usedProducts.map((row, i) => {
            const selected = products.find((p) => p.id === row.productId);
            return (
              <div key={i} className="flex items-center gap-2">
                <select
                  value={row.productId}
                  onChange={(e) => updateRow(i, { productId: e.target.value })}
                  className="input flex-1"
                >
                  <option value="">Stoktan seçin (opsiyonel)</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.currentStock} {p.unit} kaldı)
                    </option>
                  ))}
                </select>
                {row.productId && (
                  <input
                    required
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder={selected?.unit ?? "Miktar"}
                    value={row.quantity}
                    onChange={(e) => updateRow(i, { quantity: e.target.value })}
                    className="input w-28"
                  />
                )}
                {usedProducts.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    className="rounded-xl px-2 py-2 text-text-secondary hover:bg-surface-subtle"
                    aria-label="Ürünü kaldır"
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}
          <button
            type="button"
            onClick={addRow}
            className="self-start text-sm font-semibold text-primary-600 hover:text-primary-700"
          >
            + Ürün Ekle
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Doz</label>
          <input required value={dosage} onChange={(e) => setDosage(e.target.value)} className="input" placeholder="Örn. 5ml/L" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Not (opsiyonel)</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} className="input" rows={3} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Öncesi Fotoğraf</label>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-border-strong px-3 py-4 text-xs text-text-secondary transition hover:bg-surface-subtle">
              <Camera size={16} strokeWidth={1.75} />
              {beforePhoto ? beforePhoto.name : "Seç"}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => setBeforePhoto(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Sonrası Fotoğraf</label>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-border-strong px-3 py-4 text-xs text-text-secondary transition hover:bg-surface-subtle">
              <Camera size={16} strokeWidth={1.75} />
              {afterPhoto ? afterPhoto.name : "Seç"}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => setAfterPhoto(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Müşteri İmzası (opsiyonel)</label>
          <SignaturePad key={signatureKeyRef.current} onChange={setSignature} />
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
            {saving ? "Kaydediliyor..." : "Tamamla"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

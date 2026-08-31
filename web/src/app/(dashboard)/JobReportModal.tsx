"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Camera } from "lucide-react";
import { Modal } from "@/components/Modal";
import { SignaturePad } from "@/components/SignaturePad";
import { api, ApiError, uploadFile } from "@/lib/api";
import type { Product, Paginated } from "@/lib/types";

interface JobReportModalProps {
  open: boolean;
  onClose: () => void;
  onCompleted: () => void;
  jobId: string | null;
}

export function JobReportModal({ open, onClose, onCompleted, jobId }: JobReportModalProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [dosage, setDosage] = useState("");
  const [note, setNote] = useState("");
  const [beforePhoto, setBeforePhoto] = useState<File | null>(null);
  const [afterPhoto, setAfterPhoto] = useState<File | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const signatureKeyRef = useRef(0);

  useEffect(() => {
    if (open) {
      setProductId("");
      setQuantity("");
      setDosage("");
      setNote("");
      setBeforePhoto(null);
      setAfterPhoto(null);
      setSignature(null);
      setError(null);
      signatureKeyRef.current += 1;
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
    setSaving(true);

    try {
      await api.post(`/jobs/${jobId}/report`, {
        productId: productId || undefined,
        quantity: productId && quantity ? Number(quantity) : undefined,
        dosage,
        notes: note || undefined,
        signatureBase64: signature ?? undefined,
      });

      if (beforePhoto) await uploadPhoto(jobId, beforePhoto, "BEFORE");
      if (afterPhoto) await uploadPhoto(jobId, afterPhoto, "AFTER");

      await api.patch(`/jobs/${jobId}`, { status: "COMPLETED" });
      onCompleted();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Tamamlanamadı, tekrar deneyin");
    } finally {
      setSaving(false);
    }
  }

  const selectedProduct = products.find((p) => p.id === productId);

  return (
    <Modal open={open} onClose={onClose} title="İşi Tamamla">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Kullanılan Ürün</label>
          <select value={productId} onChange={(e) => setProductId(e.target.value)} className="input">
            <option value="">Stoktan seçin (opsiyonel)</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.currentStock} {p.unit} kaldı)
              </option>
            ))}
          </select>
        </div>

        {productId && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Kullanılan Miktar {selectedProduct ? `(${selectedProduct.unit})` : ""}</label>
            <input required type="number" min={0} step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="input" />
          </div>
        )}

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
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 px-3 py-4 text-xs text-text-secondary transition hover:bg-white/5">
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
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 px-3 py-4 text-xs text-text-secondary transition hover:bg-white/5">
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

        {error && <p className="rounded-2xl bg-primary-redLight/10 px-4 py-3 text-sm text-primary-redLight">{error}</p>}

        <div className="mt-2 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-2xl px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:bg-white/5">
            Vazgeç
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-2xl bg-gradient-to-r from-primary-green to-primary-green/90 px-4 py-2.5 text-sm font-semibold text-white transition hover:shadow-[0_0_20px_rgba(212,174,61,0.22)] disabled:opacity-60"
          >
            {saving ? "Kaydediliyor..." : "Tamamla"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

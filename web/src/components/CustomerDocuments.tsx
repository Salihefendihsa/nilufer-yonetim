"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LoadingBlock } from "@/components/LoadingBlock";
import { FileText, Image as ImageIcon, Upload, Trash2, Download, FolderOpen } from "lucide-react";
import { api, ApiError, uploadFile, downloadFile, fileUrl } from "@/lib/api";
import { useToast } from "@/lib/ToastProvider";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { formatDate } from "@/lib/format";
import type { CustomerDocument } from "@/lib/types";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Bölüm AB (6. tur): Müşteri detayı → "Belgeler" — yükleme alanı (tıkla/sürükle),
 * indirilebilir liste, onaylı silme (DB + disk sunucuda birlikte silinir).
 * Yalnızca OWNER/MANAGER (sunucu da zorlar).
 */
export function CustomerDocuments({ customerId }: { customerId: string }) {
  const { showToast } = useToast();
  const [docs, setDocs] = useState<CustomerDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CustomerDocument | null>(null);
  const [deleting, setDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: CustomerDocument[] }>(`/customers/${customerId}/documents`);
      setDocs(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Belgeler yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        await uploadFile(`/customers/${customerId}/documents`, fd);
      }
      showToast(files.length === 1 ? "Belge yüklendi." : `${files.length} belge yüklendi.`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Yüklenemedi");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/customers/${customerId}/documents/${deleteTarget.id}`);
      setDeleteTarget(null);
      showToast("Belge silindi.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Silinemedi");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-text-faint">
        <FolderOpen size={12} strokeWidth={1.75} />
        Belgeler
      </p>

      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed px-4 py-5 text-center text-sm transition ${
          dragOver ? "border-primary-500 bg-primary-50 text-primary-700" : "border-border bg-surface-subtle text-text-secondary hover:border-border-strong hover:text-text-primary"
        } disabled:opacity-60`}
      >
        <Upload size={18} strokeWidth={1.75} />
        <span className="font-medium">{uploading ? "Yükleniyor..." : "Belge yükle"}</span>
        <span className="text-2xs text-text-faint">PDF, resim veya ofis belgesi · en fazla 15 MB · tıkla ya da sürükle</span>
      </button>
      <input ref={inputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" className="hidden" onChange={(e) => handleFiles(e.target.files)} />

      {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

      {loading ? (
        <LoadingBlock lines={2} className="py-3" />
      ) : docs.length === 0 ? (
        <p className="py-3 text-center text-xs text-text-faint">Henüz belge yok.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border">
          {docs.map((d) => {
            const isImage = d.fileType.startsWith("image/");
            const Icon = isImage ? ImageIcon : FileText;
            return (
              <li key={d.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-subtle text-text-secondary">
                  <Icon size={16} strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text-primary">{d.fileName}</p>
                  <p className="text-xs text-text-faint">
                    {formatSize(d.fileSize)} · {formatDate(d.uploadedAt)}
                    {d.uploadedBy ? ` · ${d.uploadedBy.fullName}` : ""}
                  </p>
                </div>
                {/* Bölüm AC: kimlik doğrulamalı indirme (Authorization header) */}
                <button
                  type="button"
                  onClick={() => downloadFile(fileUrl("customer-document", d.id), d.fileName).catch((err) => setError(err instanceof ApiError ? err.message : "İndirilemedi"))}
                  aria-label="İndir"
                  className="rounded-lg p-1.5 text-text-faint transition hover:bg-surface-subtle hover:text-text-primary"
                >
                  <Download size={15} strokeWidth={1.75} />
                </button>
                <button type="button" onClick={() => setDeleteTarget(d)} aria-label="Sil" className="rounded-lg p-1.5 text-text-faint transition hover:bg-danger-50 hover:text-danger-500">
                  <Trash2 size={15} strokeWidth={1.75} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Belgeyi sil"
        description={`"${deleteTarget?.fileName}" kalıcı olarak silinecek (dosya diskten de kaldırılır).`}
        confirmLabel="Sil"
        loading={deleting}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

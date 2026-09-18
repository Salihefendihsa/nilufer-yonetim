"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Tags, Plus, X, Pencil, Trash2, Check, RotateCcw } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CustomerTagBadge } from "@/components/CustomerTagBadge";
import type { CustomerTag } from "@/lib/types";

const PRESET_COLORS = ["#3D8A4E", "#1F6FA8", "#B57F13", "#C0392B", "#6B4FBB", "#0F766E", "#7C8A7F", "#D97706"];

/**
 * Bölüm X (6. tur): Ayarlar → "Müşteri Etiketleri" — ad + renk (hazır palet
 * veya serbest hex), satır içi düzenleme, pasife alma / geri alma ve kalıcı
 * silme (atamalar Cascade ile temizlenir — onay ister).
 */
export function CustomerTagsSection() {
  const [items, setItems] = useState<CustomerTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState(PRESET_COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CustomerTag | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: CustomerTag[] }>("/customer-tags?includeInactive=true");
      setItems(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Etiketler yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function run(fn: () => Promise<unknown>, fallback: string) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : fallback);
    } finally {
      setBusy(false);
    }
  }

  function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    run(async () => {
      await api.post("/customer-tags", { name: name.trim(), color });
      setName("");
      setShowForm(false);
    }, "Eklenemedi");
  }

  const ColorPicker = ({ value, onChange }: { value: string; onChange: (c: string) => void }) => (
    <div className="flex flex-wrap items-center gap-1.5">
      {PRESET_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={c}
          onClick={() => onChange(c)}
          className={`h-6 w-6 rounded-full ring-2 transition ${value.toLowerCase() === c.toLowerCase() ? "ring-text-primary" : "ring-transparent hover:ring-border-strong"}`}
          style={{ backgroundColor: c }}
        />
      ))}
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label="Özel renk" className="h-6 w-8 cursor-pointer rounded border border-border bg-transparent p-0" />
    </div>
  );

  return (
    <div className="flex flex-col rounded-2xl border border-border bg-surface-card p-6 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 ring-1 ring-primary-100">
            <Tags size={17} strokeWidth={1.75} />
          </span>
          <div>
            <h2 className="text-base font-semibold text-text-primary">Müşteri Etiketleri</h2>
            <p className="mt-0.5 text-sm text-text-secondary">VIP, Kurumsal, Konut gibi segmentler — müşteri listesinde filtre ve rozet olarak görünür.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-xl border border-border bg-surface-base px-3 py-1.5 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
        >
          {showForm ? <X size={13} strokeWidth={2} /> : <Plus size={13} strokeWidth={2} />}
          {showForm ? "Kapat" : "Yeni etiket"}
        </button>
      </div>

      <div className="mt-5 flex flex-col gap-4">
        {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

        {showForm && (
          <form onSubmit={handleAdd} className="flex flex-col gap-3 rounded-xl border border-border bg-surface-subtle p-4">
            <div className="flex flex-wrap items-center gap-3">
              <input required value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className="input flex-1" placeholder="Etiket adı (örn. VIP)" />
              <CustomerTagBadge tag={{ name: name || "Önizleme", color }} size="md" />
            </div>
            <ColorPicker value={color} onChange={setColor} />
            <div className="flex justify-end">
              <button type="submit" disabled={busy} className="rounded-xl bg-primary-600 px-4 py-2 text-xs font-semibold text-white shadow-card transition hover:bg-primary-700 disabled:opacity-60">
                Ekle
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <p className="text-sm text-text-secondary">Yükleniyor...</p>
        ) : items.length === 0 ? (
          <p className="py-4 text-center text-sm text-text-faint">Henüz etiket yok — &quot;Yeni etiket&quot; ile ilkini ekleyin.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {items.map((t) => (
              <li key={t.id} className="py-3">
                {editingId === t.id ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={40} className="input flex-1" />
                      <CustomerTagBadge tag={{ name: editName || t.name, color: editColor }} size="md" />
                    </div>
                    <ColorPicker value={editColor} onChange={setEditColor} />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          run(async () => {
                            await api.patch(`/customer-tags/${t.id}`, { name: editName.trim(), color: editColor });
                            setEditingId(null);
                          }, "Güncellenemedi")
                        }
                        className="flex items-center gap-1 rounded-xl border border-primary-100 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700 transition hover:bg-primary-100"
                      >
                        <Check size={13} strokeWidth={2} /> Kaydet
                      </button>
                      <button type="button" onClick={() => setEditingId(null)} className="rounded-xl border border-border bg-surface-base px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-surface-subtle">
                        Vazgeç
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className={t.isActive ? "" : "opacity-50"}>
                        <CustomerTagBadge tag={t} size="md" />
                      </span>
                      <span className="text-xs text-text-faint">
                        {t.customerCount ?? 0} müşteri{!t.isActive ? " · pasif" : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setEditingId(t.id);
                          setEditName(t.name);
                          setEditColor(t.color);
                        }}
                        aria-label="Düzenle"
                        className="rounded-lg p-1.5 text-text-faint transition hover:bg-surface-subtle hover:text-text-primary"
                      >
                        <Pencil size={14} strokeWidth={1.75} />
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => run(() => api.patch(`/customer-tags/${t.id}`, { isActive: !t.isActive }), "Güncellenemedi")}
                        aria-label={t.isActive ? "Pasife al" : "Geri al"}
                        className="rounded-lg p-1.5 text-text-faint transition hover:bg-surface-subtle hover:text-text-primary"
                      >
                        {t.isActive ? <X size={14} strokeWidth={1.75} /> : <RotateCcw size={14} strokeWidth={1.75} />}
                      </button>
                      <button type="button" disabled={busy} onClick={() => setDeleteTarget(t)} aria-label="Sil" className="rounded-lg p-1.5 text-text-faint transition hover:bg-danger-50 hover:text-danger-500">
                        <Trash2 size={14} strokeWidth={1.75} />
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Etiketi sil"
        description={`"${deleteTarget?.name}" etiketi silinecek ve ${deleteTarget?.customerCount ?? 0} müşteriden kaldırılacak. Bu işlem geri alınamaz.`}
        confirmLabel="Sil"
        loading={busy}
        onConfirm={() =>
          deleteTarget &&
          run(async () => {
            await api.delete(`/customer-tags/${deleteTarget.id}`);
            setDeleteTarget(null);
          }, "Silinemedi")
        }
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

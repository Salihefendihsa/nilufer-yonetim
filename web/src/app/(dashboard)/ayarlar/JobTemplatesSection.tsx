"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { LayoutTemplate, Pencil, Plus, Trash2, RotateCcw, X, Check } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { currencyFormatter } from "@/lib/format";
import type { JobTemplate } from "@/lib/types";

interface DraftState {
  name: string;
  serviceType: string;
  defaultPrice: string;
  defaultDurationMinutes: string;
  defaultNotes: string;
}

const EMPTY_DRAFT: DraftState = { name: "", serviceType: "", defaultPrice: "", defaultDurationMinutes: "", defaultNotes: "" };

function toPayload(d: DraftState) {
  return {
    name: d.name.trim(),
    serviceType: d.serviceType.trim(),
    defaultPrice: d.defaultPrice.trim() ? Number(d.defaultPrice) : null,
    defaultDurationMinutes: d.defaultDurationMinutes.trim() ? Number(d.defaultDurationMinutes) : null,
    defaultNotes: d.defaultNotes.trim() || null,
  };
}

/**
 * Bölüm T (5. tur): Ayarlar → "İş Şablonları" — Hizmet Türleri/Semtler ile
 * aynı CRUD stili (satır içi düzenleme, yumuşak silme/geri alma). OWNER ve
 * MANAGER kullanır; iş formundaki "Şablondan Doldur" bu listeden beslenir.
 */
export function JobTemplatesSection() {
  const [items, setItems] = useState<JobTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: JobTemplate[] }>("/job-templates?includeInactive=true");
      setItems(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Şablonlar yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!draft.name.trim() || !draft.serviceType.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.post("/job-templates", toPayload(draft));
      setDraft(EMPTY_DRAFT);
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Eklenemedi");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(t: JobTemplate) {
    setEditingId(t.id);
    setEditDraft({
      name: t.name,
      serviceType: t.serviceType,
      defaultPrice: t.defaultPrice !== null ? String(t.defaultPrice) : "",
      defaultDurationMinutes: t.defaultDurationMinutes !== null ? String(t.defaultDurationMinutes) : "",
      defaultNotes: t.defaultNotes ?? "",
    });
  }

  async function handleSave(id: string) {
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/job-templates/${id}`, toPayload(editDraft));
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Güncellenemedi");
    } finally {
      setBusy(false);
    }
  }

  async function handleToggle(t: JobTemplate) {
    setBusy(true);
    setError(null);
    try {
      if (t.isActive) await api.delete(`/job-templates/${t.id}`);
      else await api.patch(`/job-templates/${t.id}`, { isActive: true });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Güncellenemedi");
    } finally {
      setBusy(false);
    }
  }

  const fields = (d: DraftState, set: (d: DraftState) => void) => (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <input required value={d.name} onChange={(e) => set({ ...d, name: e.target.value })} className="input" placeholder="Şablon adı (örn. Standart Ev İlaçlama)" />
      <input required value={d.serviceType} onChange={(e) => set({ ...d, serviceType: e.target.value })} className="input" placeholder="Hizmet türü" />
      <input type="number" min={0} step="0.01" value={d.defaultPrice} onChange={(e) => set({ ...d, defaultPrice: e.target.value })} className="input" placeholder="Varsayılan fiyat (₺)" />
      <input type="number" min={1} step={5} value={d.defaultDurationMinutes} onChange={(e) => set({ ...d, defaultDurationMinutes: e.target.value })} className="input" placeholder="Süre (dk)" />
      <input value={d.defaultNotes} onChange={(e) => set({ ...d, defaultNotes: e.target.value })} className="input sm:col-span-2" placeholder="Varsayılan not (opsiyonel)" />
    </div>
  );

  return (
    <div className="flex flex-col rounded-2xl border border-border bg-surface-card p-6 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 ring-1 ring-primary-100">
            <LayoutTemplate size={17} strokeWidth={1.75} />
          </span>
          <div>
            <h2 className="text-base font-semibold text-text-primary">İş Şablonları</h2>
            <p className="mt-0.5 text-sm text-text-secondary">Sık kullanılan iş türleri — yeni iş formunda &quot;Şablondan Doldur&quot; ile tek tıkla.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-xl border border-border bg-surface-base px-3 py-1.5 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
        >
          {showForm ? <X size={13} strokeWidth={2} /> : <Plus size={13} strokeWidth={2} />}
          {showForm ? "Kapat" : "Yeni şablon"}
        </button>
      </div>

      <div className="mt-5 flex flex-col gap-4">
        {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

        {showForm && (
          <form onSubmit={handleAdd} className="flex flex-col gap-3 rounded-xl border border-border bg-surface-subtle p-4">
            {fields(draft, setDraft)}
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
          <p className="py-4 text-center text-sm text-text-faint">Henüz şablon yok — &quot;Yeni şablon&quot; ile ilkini ekleyin.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {items.map((t) => (
              <li key={t.id} className="py-3">
                {editingId === t.id ? (
                  <div className="flex flex-col gap-3">
                    {fields(editDraft, setEditDraft)}
                    <div className="flex justify-end gap-2">
                      <button type="button" disabled={busy} onClick={() => handleSave(t.id)} className="flex items-center gap-1 rounded-xl border border-primary-100 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700 transition hover:bg-primary-100">
                        <Check size={13} strokeWidth={2} /> Kaydet
                      </button>
                      <button type="button" onClick={() => setEditingId(null)} className="rounded-xl border border-border bg-surface-base px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-surface-subtle">
                        Vazgeç
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`text-sm font-medium ${t.isActive ? "text-text-primary" : "text-text-faint line-through"}`}>{t.name}</p>
                      <p className="text-xs text-text-secondary">
                        {t.serviceType}
                        {t.defaultPrice !== null ? ` · ${currencyFormatter.format(Number(t.defaultPrice))}` : ""}
                        {t.defaultDurationMinutes !== null ? ` · ${t.defaultDurationMinutes} dk` : ""}
                        {t.defaultNotes ? ` · ${t.defaultNotes}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {t.isActive && (
                        <button type="button" disabled={busy} onClick={() => startEdit(t)} aria-label="Düzenle" className="rounded-lg p-1.5 text-text-faint transition hover:bg-surface-subtle hover:text-text-primary">
                          <Pencil size={14} strokeWidth={1.75} />
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleToggle(t)}
                        aria-label={t.isActive ? "Pasife al" : "Geri al"}
                        className={`rounded-lg p-1.5 transition ${t.isActive ? "text-text-faint hover:bg-danger-50 hover:text-danger-500" : "text-primary-600 hover:bg-primary-50"}`}
                      >
                        {t.isActive ? <Trash2 size={14} strokeWidth={1.75} /> : <RotateCcw size={14} strokeWidth={1.75} />}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

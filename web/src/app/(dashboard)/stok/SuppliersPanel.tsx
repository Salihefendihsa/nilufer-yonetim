"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Truck, Plus, Pencil, X, Check } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/lib/ToastProvider";
import type { Supplier } from "@/lib/types";

interface SupplierFormState {
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
}

const EMPTY_FORM: SupplierFormState = { name: "", contactPerson: "", phone: "", email: "", address: "" };

/** Tedarikçi kataloğu — ServiceType/District ile aynı isim + isActive deseni. */
export function SuppliersPanel() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<SupplierFormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { showToast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: Supplier[] }>("/suppliers");
      setSuppliers(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Tedarikçiler yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function startEdit(s: Supplier) {
    setEditingId(s.id);
    setForm({
      name: s.name,
      contactPerson: s.contactPerson ?? "",
      phone: s.phone ?? "",
      email: s.email ?? "",
      address: s.address ?? "",
    });
    setAddOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        contactPerson: form.contactPerson.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
      };
      if (editingId) {
        await api.patch(`/suppliers/${editingId}`, payload);
        showToast("Tedarikçi güncellendi.");
      } else {
        await api.post("/suppliers", payload);
        showToast("Tedarikçi eklendi.");
      }
      setForm(EMPTY_FORM);
      setEditingId(null);
      setAddOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kaydedilemedi");
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleActive(s: Supplier) {
    setBusy(true);
    setError(null);
    try {
      if (s.isActive) {
        await api.delete(`/suppliers/${s.id}`);
      } else {
        await api.patch(`/suppliers/${s.id}`, { isActive: true });
      }
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Güncellenemedi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-3xl border border-border bg-surface-base p-5 shadow-card">
      <header className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => setExpanded((v) => !v)} className="flex items-center gap-2">
          <Truck size={16} strokeWidth={1.75} className="text-text-secondary" />
          <h2 className="text-sm font-semibold text-text-primary">Tedarikçiler</h2>
          {!loading && (
            <span className="rounded-full bg-surface-subtle px-2 py-0.5 text-[11px] font-semibold text-text-secondary">
              {suppliers.filter((s) => s.isActive).length} aktif
            </span>
          )}
        </button>
        {expanded && (
          <button
            type="button"
            onClick={() => {
              setForm(EMPTY_FORM);
              setEditingId(null);
              setAddOpen((v) => !v);
            }}
            className="flex items-center gap-1.5 rounded-xl bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-700"
          >
            <Plus size={13} strokeWidth={2} />
            Yeni Tedarikçi
          </button>
        )}
      </header>

      {expanded && (
        <div className="mt-4">
          {error && (
            <p className="mb-3 rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>
          )}

          {addOpen && (
            <form onSubmit={handleSubmit} className="mb-4 grid grid-cols-1 gap-3 rounded-2xl border border-border bg-surface-subtle p-4 sm:grid-cols-2">
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Firma adı *"
                className="input"
              />
              <input
                value={form.contactPerson}
                onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                placeholder="Yetkili kişi"
                className="input"
              />
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="Telefon"
                className="input"
              />
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="E-posta"
                className="input"
              />
              <input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Adres"
                className="input sm:col-span-2"
              />
              <div className="flex justify-end gap-2 sm:col-span-2">
                <button
                  type="button"
                  onClick={() => {
                    setAddOpen(false);
                    setEditingId(null);
                  }}
                  className="rounded-xl px-3 py-2 text-xs font-medium text-text-secondary transition hover:bg-surface-base"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-xl bg-primary-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-primary-700 disabled:opacity-60"
                >
                  {busy ? "Kaydediliyor..." : "Kaydet"}
                </button>
              </div>
            </form>
          )}

          {loading ? (
            <p className="text-sm text-text-secondary">Yükleniyor...</p>
          ) : suppliers.length === 0 ? (
            <p className="text-sm text-text-secondary">Henüz tedarikçi eklenmemiş.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {suppliers.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className={`text-sm font-medium ${s.isActive ? "text-text-primary" : "text-text-faint line-through"}`}>
                      {s.name}
                    </p>
                    <p className="text-xs text-text-secondary">
                      {[s.contactPerson, s.phone, s.email].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(s)}
                      aria-label="Düzenle"
                      className="flex h-8 w-8 items-center justify-center rounded-xl text-text-faint transition hover:bg-surface-subtle hover:text-text-primary"
                    >
                      <Pencil size={14} strokeWidth={1.75} />
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleToggleActive(s)}
                      className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-medium transition hover:bg-surface-subtle ${
                        s.isActive ? "text-danger-500" : "text-primary-600"
                      }`}
                    >
                      {s.isActive ? <X size={13} strokeWidth={2} /> : <Check size={13} strokeWidth={2} />}
                      {s.isActive ? "Pasifleştir" : "Aktifleştir"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

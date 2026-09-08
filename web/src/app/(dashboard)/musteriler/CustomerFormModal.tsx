"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Modal } from "@/components/Modal";
import { api, ApiError } from "@/lib/api";
import type { Customer, District } from "@/lib/types";

interface CustomerFormModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  customer?: Customer | null;
}

interface FormState {
  fullName: string;
  phone: string;
  email: string;
  address: string;
  district: string;
}

const EMPTY_FORM: FormState = { fullName: "", phone: "", email: "", address: "", district: "" };

export function CustomerFormModal({ open, onClose, onSaved, customer }: CustomerFormModalProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [districts, setDistricts] = useState<District[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(
        customer
          ? {
              fullName: customer.fullName,
              phone: customer.phone,
              email: customer.email ?? "",
              address: customer.address ?? "",
              district: customer.district ?? "",
            }
          : EMPTY_FORM
      );
      setError(null);
      api
        .get<{ data: District[] }>("/districts")
        .then((res) => setDistricts(res.data.filter((d) => d.isActive)))
        .catch(() => setDistricts([]));
    }
  }, [open, customer]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const payload = {
      fullName: form.fullName,
      phone: form.phone,
      email: form.email || undefined,
      address: form.address || undefined,
      district: form.district || undefined,
    };

    try {
      if (customer) {
        await api.patch(`/customers/${customer.id}`, payload);
      } else {
        await api.post("/customers", payload);
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
    <Modal open={open} onClose={onClose} title={customer ? "Müşteriyi Düzenle" : "Yeni Müşteri"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Ad Soyad">
          <input
            required
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            className="input"
          />
        </Field>
        <Field label="Telefon">
          <input
            required
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="input"
          />
        </Field>
        <Field label="E-posta (opsiyonel)">
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="input"
          />
        </Field>
        <Field label="Adres (opsiyonel)">
          <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="input" />
        </Field>
        <Field label="Semt (opsiyonel)">
          <select
            value={form.district}
            onChange={(e) => setForm({ ...form, district: e.target.value })}
            className="input"
          >
            <option value="">Seçilmedi</option>
            {districts.map((d) => (
              <option key={d.id} value={d.name}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-text-secondary">{label}</label>
      {children}
    </div>
  );
}

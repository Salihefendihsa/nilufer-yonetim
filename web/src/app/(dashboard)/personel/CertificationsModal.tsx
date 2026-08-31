"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { Modal } from "@/components/Modal";
import { api, ApiError } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Staff, StaffCertification } from "@/lib/types";

interface CertificationsModalProps {
  open: boolean;
  onClose: () => void;
  staff: Staff | null;
}

const EMPTY_FORM = { name: "", issuedDate: "", expiryDate: "" };

export function CertificationsModal({ open, onClose, staff }: CertificationsModalProps) {
  const [certifications, setCertifications] = useState<StaffCertification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    if (!staff) return;
    setLoading(true);
    setError(null);
    api
      .get<{ data: StaffCertification[] }>(`/staff/${staff.id}/certifications`)
      .then((res) => setCertifications(res.data))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Sertifikalar yüklenemedi"))
      .finally(() => setLoading(false));
  }, [staff]);

  useEffect(() => {
    if (open && staff) {
      setForm(EMPTY_FORM);
      load();
    }
  }, [open, staff, load]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!staff) return;
    setSaving(true);
    setError(null);
    try {
      await api.post(`/staff/${staff.id}/certifications`, {
        name: form.name,
        issuedDate: new Date(form.issuedDate).toISOString(),
        expiryDate: new Date(form.expiryDate).toISOString(),
      });
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Eklenemedi");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(certId: string) {
    if (!staff) return;
    try {
      await api.delete(`/staff/${staff.id}/certifications/${certId}`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Silinemedi");
    }
  }

  function isExpiringSoon(expiryDate: string): boolean {
    const days = (new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return days <= 30;
  }

  return (
    <Modal open={open} onClose={onClose} title={staff ? `${staff.user.fullName} — Belgeler` : "Belgeler"}>
      <div className="flex flex-col gap-4">
        {error && <p className="rounded-2xl bg-primary-red/10 px-4 py-3 text-sm text-primary-redLight">{error}</p>}

        {loading ? (
          <p className="py-6 text-center text-sm text-text-faint">Yükleniyor...</p>
        ) : (
          <ul className="flex flex-col divide-y divide-white/5">
            {certifications.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium text-text-primary">{c.name}</p>
                  <p className={`mt-0.5 text-xs ${isExpiringSoon(c.expiryDate) ? "text-amber-400" : "text-text-faint"}`}>
                    {formatDate(c.issuedDate)} — {formatDate(c.expiryDate)}
                    {isExpiringSoon(c.expiryDate) ? " · süresi doluyor" : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(c.id)}
                  aria-label="Sil"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-text-faint transition hover:bg-primary-redLight/10 hover:text-primary-redLight"
                >
                  <Trash2 size={15} strokeWidth={1.75} />
                </button>
              </li>
            ))}
            {certifications.length === 0 && <p className="py-4 text-sm text-text-secondary">Henüz belge eklenmemiş.</p>}
          </ul>
        )}

        <form onSubmit={handleAdd} className="flex flex-col gap-3 border-t border-white/10 pt-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Belge Adı</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input"
              placeholder="Örn. Biyosidal Ürün Uygulayıcı Belgesi"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-secondary">Veriliş Tarihi</label>
              <input
                required
                type="date"
                value={form.issuedDate}
                onChange={(e) => setForm({ ...form, issuedDate: e.target.value })}
                className="input"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-secondary">Bitiş Tarihi</label>
              <input
                required
                type="date"
                value={form.expiryDate}
                onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
                className="input"
              />
            </div>
          </div>

          <div className="mt-1 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="rounded-2xl px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:bg-white/5">
              Kapat
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-2xl bg-gradient-to-r from-primary-green to-primary-green/90 px-4 py-2.5 text-sm font-semibold text-white transition hover:shadow-[0_0_20px_rgba(212,174,61,0.22)] disabled:opacity-60"
            >
              {saving ? "Ekleniyor..." : "Belge Ekle"}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

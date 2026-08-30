"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Modal } from "@/components/Modal";
import { api, ApiError } from "@/lib/api";
import type { AuthUser } from "@/lib/auth";

interface QuoteRequestModalProps {
  open: boolean;
  onClose: () => void;
  onSent: () => void;
  user: AuthUser | null;
}

export function QuoteRequestModal({ open, onClose, onSent, user }: QuoteRequestModalProps) {
  const [phone, setPhone] = useState("");
  const [propertyType, setPropertyType] = useState("Ev");
  const [serviceType, setServiceType] = useState("");
  const [address, setAddress] = useState("");
  const [district, setDistrict] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setPhone("");
      setPropertyType("Ev");
      setServiceType("");
      setAddress("");
      setDistrict("");
      setError(null);
    }
  }, [open, user]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      await api.post("/quotes", {
        fullName: user?.fullName ?? "Müşteri",
        phone,
        propertyType,
        serviceType,
        address: address || undefined,
        district: district || undefined,
      });
      onSent();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Talep gönderilemedi, tekrar deneyin");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Yeni Randevu İste">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Telefon</label>
          <input required value={phone} onChange={(e) => setPhone(e.target.value)} className="input" placeholder="Size ulaşabileceğimiz numara" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Konut Türü</label>
          <select value={propertyType} onChange={(e) => setPropertyType(e.target.value)} className="input">
            <option value="Ev">Ev</option>
            <option value="Apartman">Apartman</option>
            <option value="İşyeri">İşyeri</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Talep Ettiğiniz Hizmet</label>
          <input
            required
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value)}
            className="input"
            placeholder="Örn. Genel İlaçlama"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Adres (opsiyonel)</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} className="input" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Semt (opsiyonel)</label>
          <input value={district} onChange={(e) => setDistrict(e.target.value)} className="input" />
        </div>

        {error && <p className="rounded-2xl bg-primary-red/10 px-4 py-3 text-sm text-primary-redLight">{error}</p>}

        <div className="mt-2 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-2xl px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:bg-white/5">
            Vazgeç
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-2xl bg-gradient-to-r from-primary-green to-primary-green/90 px-4 py-2.5 text-sm font-semibold text-white transition hover:shadow-[0_0_20px_rgba(212,174,61,0.22)] disabled:opacity-60"
          >
            {saving ? "Gönderiliyor..." : "Talebi Gönder"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

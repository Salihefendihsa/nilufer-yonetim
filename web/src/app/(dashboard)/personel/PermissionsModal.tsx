"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { Toggle } from "@/components/Toggle";
import { api, ApiError } from "@/lib/api";
import { PERMISSION_LABELS, type PermissionEntry } from "@/lib/permissions";
import type { Staff } from "@/lib/types";

interface PermissionsModalProps {
  open: boolean;
  onClose: () => void;
  staff: Staff | null;
}

export function PermissionsModal({ open, onClose, staff }: PermissionsModalProps) {
  const [permissions, setPermissions] = useState<PermissionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open || !staff) return;
    setLoading(true);
    setError(null);
    setSaved(false);
    api
      .get<{ data: PermissionEntry[] }>(`/staff/${staff.id}/permissions`)
      .then((res) => setPermissions(res.data))
      .catch((err) => setError(err instanceof ApiError ? err.message : "İzinler yüklenemedi"))
      .finally(() => setLoading(false));
  }, [open, staff]);

  function toggle(key: string, value: boolean) {
    setPermissions((prev) => prev.map((p) => (p.key === key ? { ...p, value } : p)));
  }

  async function handleSave() {
    if (!staff) return;
    setSaving(true);
    setError(null);
    try {
      const payload = Object.fromEntries(permissions.map((p) => [p.key, p.value]));
      await api.patch(`/staff/${staff.id}/permissions`, payload);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kaydedilemedi, tekrar deneyin");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={staff ? `${staff.user.fullName} — Yetkiler` : "Yetkiler"}>
      {loading ? (
        <p className="py-8 text-center text-sm text-text-faint">Yükleniyor...</p>
      ) : (
        <div className="flex flex-col gap-4">
          <ul className="flex flex-col divide-y divide-border">
            {permissions.map((p) => (
              <li key={p.key} className="flex items-center justify-between gap-4 py-3">
                <span className="text-sm text-text-secondary">{PERMISSION_LABELS[p.key] ?? p.key}</span>
                <Toggle checked={p.value} onChange={(value) => toggle(p.key, value)} label={PERMISSION_LABELS[p.key] ?? p.key} />
              </li>
            ))}
          </ul>

          {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}
          {saved && <p className="rounded-2xl bg-primary-50 px-4 py-3 text-sm text-primary-600">Yetkiler kaydedildi.</p>}

          <div className="mt-2 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="rounded-2xl px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:bg-surface-subtle">
              Kapat
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-2xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition hover:bg-primary-700 disabled:opacity-60"
            >
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

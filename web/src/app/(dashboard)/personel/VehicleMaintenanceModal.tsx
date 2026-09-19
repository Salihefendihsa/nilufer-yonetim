"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Trash2, Truck } from "lucide-react";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/lib/ToastProvider";
import { api, ApiError } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Staff, VehicleMaintenance, VehicleMaintenanceType } from "@/lib/types";

interface VehicleMaintenanceModalProps {
  open: boolean;
  onClose: () => void;
  staff: Staff | null;
  /** STAFF/TEAM_LEAD kendi kaydını salt-okunur görür (backend yazmayı zaten 403'ler). */
  readOnly?: boolean;
}

export const MAINTENANCE_TYPE_LABELS: Record<VehicleMaintenanceType, string> = {
  INSPECTION: "Muayene",
  OIL_CHANGE: "Yağ Değişimi",
  TIRE: "Lastik",
  OTHER: "Diğer",
};

const EMPTY_FORM = { maintenanceType: "INSPECTION" as VehicleMaintenanceType, lastServiceDate: "", nextDueDate: "", note: "" };

/** Vade rozeti: gecikmiş/≤7 gün kırmızı, ≤14 sarı, aksi yeşil. */
function dueTone(row: VehicleMaintenance): string {
  if (row.isOverdue || row.daysLeft <= 7) return "border-danger-100 bg-danger-50 text-danger-500";
  if (row.daysLeft <= 14) return "border-warning-100 bg-warning-50 text-warning-600";
  return "border-success-100 bg-success-50 text-success-600";
}
function dueLabel(row: VehicleMaintenance): string {
  if (row.isOverdue) return `${Math.abs(row.daysLeft)} gün gecikti`;
  if (row.daysLeft === 0) return "Bugün";
  return `${row.daysLeft} gün kaldı`;
}

/**
 * Bölüm AQ (9. tur): "Araç Bakımı" — yalnızca vehiclePlate dolu personelde
 * açılır (buton personel kartında koşullu). GET/POST/PATCH/DELETE
 * /staff/:id/vehicle-maintenance.
 */
export function VehicleMaintenanceModal({ open, onClose, staff, readOnly = false }: VehicleMaintenanceModalProps) {
  const [rows, setRows] = useState<VehicleMaintenance[]>([]);
  const [plate, setPlate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<VehicleMaintenance | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { showToast } = useToast();

  const load = useCallback(() => {
    if (!staff) return;
    setLoading(true);
    setError(null);
    api
      .get<{ vehiclePlate: string | null; data: VehicleMaintenance[] }>(`/staff/${staff.id}/vehicle-maintenance`)
      .then((res) => {
        setRows(res.data);
        setPlate(res.vehiclePlate);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Bakım kayıtları yüklenemedi"))
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
      await api.post(`/staff/${staff.id}/vehicle-maintenance`, {
        maintenanceType: form.maintenanceType,
        lastServiceDate: form.lastServiceDate,
        nextDueDate: form.nextDueDate,
        note: form.note.trim() || undefined,
      });
      setForm(EMPTY_FORM);
      load();
      showToast("Bakım kaydı eklendi.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!staff || !deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/staff/${staff.id}/vehicle-maintenance/${deleteTarget.id}`);
      setDeleteTarget(null);
      load();
      showToast("Bakım kaydı silindi.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Silinemedi");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={staff ? `${staff.user.fullName} — Araç Bakımı` : "Araç Bakımı"}>
      <div className="flex flex-col gap-4">
        <p className="flex items-center gap-2 text-sm text-text-secondary">
          <Truck size={14} strokeWidth={1.75} />
          Plaka: <span className="font-mono font-medium text-text-primary">{plate ?? staff?.vehiclePlate ?? "—"}</span>
        </p>

        {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

        {loading ? (
          <p className="text-sm text-text-secondary">Yükleniyor...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-text-secondary">Henüz bakım kaydı yok.</p>
        ) : (
          <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto">
            {rows.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface-subtle px-4 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary">{MAINTENANCE_TYPE_LABELS[row.maintenanceType]}</p>
                  <p className="truncate text-xs text-text-secondary">
                    Son: {formatDate(row.lastServiceDate)} · Sonraki: {formatDate(row.nextDueDate)}
                    {row.note ? ` · ${row.note}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${dueTone(row)}`}>{dueLabel(row)}</span>
                  {!readOnly && (
                    <button type="button" onClick={() => setDeleteTarget(row)} className="rounded-xl border border-danger-100 bg-danger-50 p-1.5 text-danger-500 transition hover:bg-danger-100" aria-label="Sil">
                      <Trash2 size={13} strokeWidth={1.75} />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {!readOnly && (
          <form onSubmit={handleAdd} className="flex flex-col gap-3 rounded-2xl border border-border p-4">
            <p className="text-sm font-semibold text-text-primary">Yeni bakım kaydı</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-secondary">Tür</label>
                <select value={form.maintenanceType} onChange={(e) => setForm({ ...form, maintenanceType: e.target.value as VehicleMaintenanceType })} className="input">
                  {(Object.keys(MAINTENANCE_TYPE_LABELS) as VehicleMaintenanceType[]).map((t) => (
                    <option key={t} value={t}>
                      {MAINTENANCE_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-secondary">Son bakım</label>
                <input required type="date" value={form.lastServiceDate} onChange={(e) => setForm({ ...form, lastServiceDate: e.target.value })} className="input" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-secondary">Sonraki bakım</label>
                <input required type="date" value={form.nextDueDate} min={form.lastServiceDate || undefined} onChange={(e) => setForm({ ...form, nextDueDate: e.target.value })} className="input" />
              </div>
            </div>
            <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="input" placeholder="Not (opsiyonel) — örn. TÜVTÜRK Nilüfer" maxLength={500} />
            <button type="submit" disabled={saving} className="self-end rounded-2xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-60">
              {saving ? "Kaydediliyor..." : "Ekle"}
            </button>
          </form>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Bakım kaydını sil"
        description="Bu bakım kaydı kalıcı olarak silinecek."
        loading={deleting}
      />
    </Modal>
  );
}

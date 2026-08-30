"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, HardHat, Pencil, Trash2, CalendarCheck, ShieldCheck } from "lucide-react";
import { RequireRole } from "@/components/RequireRole";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthProvider";
import { todayIsoDate } from "@/lib/format";
import type { Staff, Paginated } from "@/lib/types";
import { StaffFormModal } from "./StaffFormModal";
import { PermissionsModal } from "./PermissionsModal";

interface StaffRow extends Staff {
  todaysJobsCount: number;
}

export default function StaffPage() {
  return (
    <RequireRole roles={["OWNER", "MANAGER"]}>
      <StaffPageContent />
    </RequireRole>
  );
}

function StaffPageContent() {
  const { user } = useAuth();
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Staff | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [permissionsTarget, setPermissionsTarget] = useState<Staff | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<Paginated<Staff>>("/staff?limit=100");

      const withCounts = await Promise.all(
        res.data.map(async (staff) => {
          try {
            const jobsRes = await api.get<Paginated<unknown>>(
              `/jobs?staffId=${staff.id}&date=${todayIsoDate()}&limit=1`
            );
            return { ...staff, todaysJobsCount: jobsRes.pagination.total };
          } catch {
            return { ...staff, todaysJobsCount: 0 };
          }
        })
      );

      setRows(withCounts);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Personel listesi yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/staff/${deleteTarget.id}`);
      setDeleteTarget(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Silinemedi");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-text-primary">Personel</h1>
          <p className="mt-1 text-sm text-text-secondary">Ekibinizi ve günlük iş yükünü buradan takip edin.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingStaff(null);
            setFormOpen(true);
          }}
          className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-primary-green to-primary-green/90 px-4 py-2.5 text-sm font-semibold text-white transition hover:shadow-[0_0_20px_rgba(212,174,61,0.22)]"
        >
          <Plus size={16} strokeWidth={2} />
          Yeni Personel
        </button>
      </div>

      {error && <p className="rounded-2xl bg-primary-red/10 px-4 py-3 text-sm text-primary-redLight">{error}</p>}

      {loading ? (
        <p className="py-16 text-center text-sm text-text-faint">Yükleniyor...</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl bg-surface-card shadow-[0_8px_24px_rgba(0,0,0,0.22)]">
          <EmptyState
            icon={HardHat}
            title="Henüz personel yok"
            description="İlk personelinizi ekleyerek başlayın."
            actionLabel="Yeni Personel"
            onAction={() => setFormOpen(true)}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((staff) => (
            <div key={staff.id} className="flex flex-col gap-4 rounded-2xl bg-surface-card p-6 shadow-[0_8px_24px_rgba(0,0,0,0.22)]">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-green/10 text-lg font-semibold text-primary-greenLight">
                  {staff.user.fullName[0]?.toUpperCase() ?? "?"}
                </div>
                <div>
                  <p className="font-medium text-text-primary">{staff.user.fullName}</p>
                  <p className="text-sm text-text-secondary">{staff.position}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-2xl bg-white/[0.03] px-4 py-3">
                <CalendarCheck size={16} strokeWidth={1.75} className="text-text-faint" />
                <p className="text-sm text-text-secondary">
                  Bugün <span className="font-semibold text-text-primary">{staff.todaysJobsCount}</span> iş
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingStaff(staff);
                    setFormOpen(true);
                  }}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white/5 px-3 py-2 text-xs font-medium text-text-primary transition hover:bg-white/10"
                >
                  <Pencil size={14} strokeWidth={1.75} />
                  Düzenle
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(staff)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary-red/10 px-3 py-2 text-xs font-medium text-primary-redLight transition hover:bg-primary-red/20"
                >
                  <Trash2 size={14} strokeWidth={1.75} />
                  Sil
                </button>
              </div>

              {user?.role === "OWNER" && (
                <button
                  type="button"
                  onClick={() => setPermissionsTarget(staff)}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-white/[0.03] px-3 py-2 text-xs font-medium text-text-secondary transition hover:bg-white/10"
                >
                  <ShieldCheck size={14} strokeWidth={1.75} />
                  Yetkiler
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <StaffFormModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} staff={editingStaff} />

      <PermissionsModal open={!!permissionsTarget} onClose={() => setPermissionsTarget(null)} staff={permissionsTarget} />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Personeli sil"
        description={`"${deleteTarget?.user.fullName}" adlı personeli silmek istediğinize emin misiniz?`}
        loading={deleting}
      />
    </div>
  );
}

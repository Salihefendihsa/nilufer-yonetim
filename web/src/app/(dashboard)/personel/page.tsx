"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  HardHat,
  Pencil,
  Trash2,
  CalendarCheck,
  ShieldCheck,
  FileBadge,
  Users2,
  Briefcase,
  Coffee,
  Truck,
  Star,
  AlertTriangle,
} from "lucide-react";
import { RequireRole } from "@/components/RequireRole";
import { PageHeader } from "@/components/PageHeader";
import { StatusStrip } from "@/components/StatusStrip";
import { StatCard } from "@/components/StatCard";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthProvider";
import type { Staff, Paginated } from "@/lib/types";
import { StaffFormModal } from "./StaffFormModal";
import { PermissionsModal } from "./PermissionsModal";
import { CertificationsModal } from "./CertificationsModal";

/**
 * Bugünkü iş sayısı, biten sertifika sayısı ve ortalama puan artık /staff
 * yanıtında sunucu tarafında hesaplanıyor — eskiden personel başına ayrı bir
 * /jobs isteği atılıyordu (N+1).
 */
interface StaffRow extends Staff {
  todaysJobsCount: number;
  expiringCertificationCount: number;
  averageRating: number | null;
  ratedJobsCount: number;
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
  const [certificationsTarget, setCertificationsTarget] = useState<Staff | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<Paginated<Staff>>("/staff?limit=100");

      setRows(
        res.data.map((staff) => ({
          ...staff,
          todaysJobsCount: staff.todaysJobsCount ?? 0,
          expiringCertificationCount: staff.expiringCertificationCount ?? 0,
          averageRating: staff.averageRating ?? null,
          ratedJobsCount: staff.ratedJobsCount ?? 0,
        }))
      );
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

  // Kart ve şerit değerleri, halihazırda çekilen todaysJobsCount alanından türetilir.
  const workload = useMemo(() => {
    const busy = rows.filter((r) => r.todaysJobsCount > 0).length;
    const totalJobs = rows.reduce((sum, r) => sum + r.todaysJobsCount, 0);
    return { busy, idle: rows.length - busy, totalJobs };
  }, [rows]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={HardHat}
        title="Personel"
        description="Ekibinizi ve günlük iş yükünü buradan takip edin."
        actions={
          <button
            type="button"
            onClick={() => {
              setEditingStaff(null);
              setFormOpen(true);
            }}
            className="flex items-center gap-2 rounded-2xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition hover:bg-primary-700"
          >
            <Plus size={16} strokeWidth={2} />
            Yeni Personel
          </button>
        }
      />

      {/* [Özet kartlar] */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Toplam personel" value={loading ? "—" : String(rows.length)} icon={Users2} mono />
        <StatCard
          label="Bugün işi olan"
          value={loading ? "—" : String(workload.busy)}
          icon={Briefcase}
          accent="blue"
          mono
          progress={rows.length > 0 ? (workload.busy / rows.length) * 100 : 0}
        />
        <StatCard
          label="Bugün toplam iş"
          value={loading ? "—" : String(workload.totalJobs)}
          icon={CalendarCheck}
          accent="gold"
          mono
          hint={rows.length > 0 ? `Kişi başı ${(workload.totalJobs / rows.length).toFixed(1)}` : undefined}
        />
      </div>

      {/* [Durum dağılımı şeridi] */}
      <StatusStrip
        loading={loading}
        totalLabel={`${rows.length} personel`}
        segments={[
          { label: "bugün işi var", count: workload.busy, color: "#3D8A4E" },
          { label: "bugün boşta", count: workload.idle, color: "#CFD8D0" },
        ]}
      />

      {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

      {loading ? (
        <p className="py-16 text-center text-sm text-text-faint">Yükleniyor...</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface-card shadow-card">
          <EmptyState
            icon={HardHat}
            title="Henüz personel yok"
            description="İlk personelinizi ekleyerek başlayın."
            actionLabel="Yeni Personel"
            onAction={() => setFormOpen(true)}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((staff) => (
            <div
              key={staff.id}
              className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-card p-5 shadow-card transition hover:shadow-cardHover"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-600 text-lg font-semibold text-white">
                  {staff.user.fullName[0]?.toUpperCase() ?? "?"}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-text-primary">{staff.user.fullName}</p>
                  <p className="text-sm text-text-secondary">{staff.position}</p>
                  {staff.vehiclePlate && (
                    <p className="flex items-center gap-1 text-xs text-text-faint">
                      <Truck size={11} strokeWidth={1.75} />
                      <span className="font-mono">{staff.vehiclePlate}</span>
                    </p>
                  )}
                </div>
                <div className="ml-auto flex flex-col items-end gap-1">
                  {staff.averageRating !== null && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-warning-50 px-2 py-0.5 text-[11px] font-semibold text-warning-600">
                      <Star size={10} strokeWidth={2} />
                      {staff.averageRating.toFixed(1)}
                      <span className="font-normal text-text-faint">({staff.ratedJobsCount})</span>
                    </span>
                  )}
                  {staff.expiringCertificationCount > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-danger-50 px-2 py-0.5 text-[11px] font-semibold text-danger-500">
                      <AlertTriangle size={10} strokeWidth={2} />
                      {staff.expiringCertificationCount} belge
                    </span>
                  )}
                </div>
              </div>

              <div
                className={`flex items-center gap-2 rounded-2xl border px-4 py-3 ${
                  staff.todaysJobsCount > 0 ? "border-primary-100 bg-primary-50" : "border-border bg-surface-subtle"
                }`}
              >
                {staff.todaysJobsCount > 0 ? (
                  <CalendarCheck size={16} strokeWidth={1.75} className="text-primary-600" />
                ) : (
                  <Coffee size={16} strokeWidth={1.75} className="text-text-faint" />
                )}
                <p className="text-sm text-text-secondary">
                  Bugün <span className="font-semibold text-text-primary">{staff.todaysJobsCount}</span> iş
                  {staff.dailyJobCapacity ? (
                    <span className="text-text-faint"> / {staff.dailyJobCapacity} kapasite</span>
                  ) : null}
                </p>
                <span className="ml-auto h-1.5 w-16 overflow-hidden rounded-full bg-surface-muted">
                  {/* Kapasite tanımlıysa doluluk gerçek kapasiteye göre; tanımlı
                      değilse çubuk gösterilmez (uydurma bir üst sınır kullanılmaz). */}
                  {staff.dailyJobCapacity ? (
                    <span
                      className={`block h-full rounded-full ${
                        staff.todaysJobsCount > staff.dailyJobCapacity ? "bg-danger-500" : "bg-primary-500"
                      }`}
                      style={{
                        width: `${Math.min(100, (staff.todaysJobsCount / staff.dailyJobCapacity) * 100)}%`,
                      }}
                    />
                  ) : null}
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingStaff(staff);
                    setFormOpen(true);
                  }}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-surface-base px-3 py-2 text-xs font-medium text-text-primary transition hover:border-border-strong hover:bg-surface-subtle"
                >
                  <Pencil size={14} strokeWidth={1.75} />
                  Düzenle
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(staff)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-danger-100 bg-danger-50 px-3 py-2 text-xs font-medium text-danger-500 transition hover:bg-danger-100"
                >
                  <Trash2 size={14} strokeWidth={1.75} />
                  Sil
                </button>
              </div>

              <button
                type="button"
                onClick={() => setCertificationsTarget(staff)}
                className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-base px-3 py-2 text-xs font-medium text-text-secondary transition hover:border-border-strong hover:bg-surface-subtle hover:text-text-primary"
              >
                <FileBadge size={14} strokeWidth={1.75} />
                Belgeler
              </button>

              {user?.role === "OWNER" && (
                <button
                  type="button"
                  onClick={() => setPermissionsTarget(staff)}
                  className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-base px-3 py-2 text-xs font-medium text-text-secondary transition hover:border-border-strong hover:bg-surface-subtle hover:text-text-primary"
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

      <CertificationsModal open={!!certificationsTarget} onClose={() => setCertificationsTarget(null)} staff={certificationsTarget} />

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

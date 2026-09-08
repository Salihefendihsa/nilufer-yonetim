"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Wrench, List, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { StatusStrip } from "@/components/StatusStrip";
import { StatusBadge, STATUS_COLORS, STATUS_TEXT } from "@/components/StatusBadge";
import { useAuth } from "@/lib/AuthProvider";
import { api, ApiError } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { Customer, Staff, Job, JobStatus, Paginated } from "@/lib/types";
import { JobFormModal } from "./JobFormModal";
import { WeekCalendar } from "./WeekCalendar";

const STATUS_OPTIONS: JobStatus[] = ["PENDING", "SCHEDULED", "COMPLETED", "CANCELLED"];
const STATUS_FILTER_LABELS: Record<"ALL" | JobStatus, string> = {
  ALL: "Tümü",
  PENDING: "Bekliyor",
  SCHEDULED: "Planlandı",
  COMPLETED: "Tamamlandı",
  CANCELLED: "İptal edildi",
};

export default function JobsPage() {
  const { user } = useAuth();
  const [view, setView] = useState<"list" | "calendar">("list");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [statusFilter, setStatusFilter] = useState<"ALL" | JobStatus>("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [statusCounts, setStatusCounts] = useState<Record<JobStatus, number> | null>(null);

  const canManage = user?.role === "OWNER" || user?.role === "MANAGER";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const statusQuery = statusFilter === "ALL" ? "" : `&status=${statusFilter}`;
      const limit = view === "calendar" ? 200 : 20;
      const jobsRes = await api.get<Paginated<Job>>(`/jobs?page=${page}&limit=${limit}${statusQuery}`);
      setJobs(jobsRes.data);
      setTotalPages(jobsRes.pagination.totalPages);

      // Müşteri/personel adları artık /jobs yanıtına gömülü geliyor; ayrı
      // /customers ve /staff listeleri yalnızca yeni iş formundaki seçim
      // kutuları için gerekli, o da sadece OWNER/MANAGER'da açılıyor.
      const calls: Promise<unknown>[] = STATUS_OPTIONS.map((status) =>
        api.get<Paginated<Job>>(`/jobs?limit=1&status=${status}`)
      );
      if (canManage) {
        calls.push(api.get<Paginated<Customer>>("/customers?limit=100"), api.get<Paginated<Staff>>("/staff?limit=100"));
      }
      const results = await Promise.allSettled(calls);

      const counts = {} as Record<JobStatus, number>;
      STATUS_OPTIONS.forEach((status, i) => {
        const result = results[i] as PromiseSettledResult<Paginated<Job>>;
        counts[status] = result?.status === "fulfilled" ? result.value.pagination.total : 0;
      });
      setStatusCounts(counts);

      if (canManage) {
        const customersRes = results[STATUS_OPTIONS.length] as PromiseSettledResult<Paginated<Customer>>;
        const staffRes = results[STATUS_OPTIONS.length + 1] as PromiseSettledResult<Paginated<Staff>>;
        if (customersRes.status === "fulfilled") setCustomers(customersRes.value.data);
        if (staffRes.status === "fulfilled") setStaff(staffRes.value.data);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "İşler yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, view, canManage]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleStatusChange(jobId: string, status: JobStatus) {
    setUpdatingId(jobId);
    try {
      await api.patch(`/jobs/${jobId}`, { status });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Durum güncellenemedi");
    } finally {
      setUpdatingId(null);
    }
  }

  const canChangeStatus = user?.role === "OWNER" || user?.role === "MANAGER" || user?.role === "STAFF";
  const totalJobs = statusCounts ? Object.values(statusCounts).reduce((sum, n) => sum + n, 0) : 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Wrench}
        title="İşler"
        description="Planlanan ve tamamlanan işleri buradan takip edin."
        actions={
          <>
            <div className="flex items-center rounded-2xl border border-border bg-surface-subtle p-1">
              <button
                type="button"
                onClick={() => setView("list")}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition ${
                  view === "list" ? "bg-surface-card text-text-primary shadow-card" : "text-text-secondary hover:text-text-primary"
                }`}
              >
                <List size={15} strokeWidth={1.75} />
                Liste
              </button>
              <button
                type="button"
                onClick={() => setView("calendar")}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition ${
                  view === "calendar" ? "bg-surface-card text-text-primary shadow-card" : "text-text-secondary hover:text-text-primary"
                }`}
              >
                <CalendarDays size={15} strokeWidth={1.75} />
                Takvim
              </button>
            </div>

            {(user?.role === "OWNER" || user?.role === "MANAGER") && (
              <button
                type="button"
                onClick={() => setFormOpen(true)}
                className="flex items-center gap-2 rounded-2xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition hover:bg-primary-700"
              >
                <Plus size={16} strokeWidth={2} />
                Yeni İş
              </button>
            )}
          </>
        }
      />

      {/* [Durum dağılımı şeridi] */}
      <StatusStrip
        loading={statusCounts === null}
        totalLabel={statusCounts ? `${totalJobs} iş` : undefined}
        segments={STATUS_OPTIONS.map((status) => ({
          label: STATUS_TEXT[status],
          count: statusCounts?.[status] ?? 0,
          color: STATUS_COLORS[status],
        }))}
      />

      <div className="flex flex-wrap gap-2">
        {(["ALL", ...STATUS_OPTIONS] as const).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => {
              setStatusFilter(status);
              setPage(1);
            }}
            className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
              statusFilter === status
                ? "border-primary-600 bg-primary-600 text-white shadow-card"
                : "border-border bg-surface-card text-text-secondary hover:border-border-strong hover:bg-surface-subtle hover:text-text-primary"
            }`}
          >
            {STATUS_FILTER_LABELS[status]}
            {status !== "ALL" && statusCounts && (
              <span
                className={`font-mono text-2xs ${statusFilter === status ? "text-white/80" : "text-text-faint"}`}
              >
                {statusCounts[status]}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

      {loading ? (
        <p className="py-16 text-center text-sm text-text-faint">Yükleniyor...</p>
      ) : jobs.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface-card shadow-card">
          <EmptyState icon={Wrench} title="Gösterilecek iş yok" description="Filtreyi değiştirin veya yeni bir iş oluşturun." />
        </div>
      ) : view === "calendar" ? (
        <WeekCalendar jobs={jobs} />
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border border-l-4 bg-surface-card p-5 shadow-card transition hover:shadow-cardHover"
                style={{ borderLeftColor: STATUS_COLORS[job.status] }}
              >
                <div className="flex flex-col gap-1">
                  <p className="font-medium text-text-primary">{job.customer?.fullName ?? "Müşteri"}</p>
                  <p className="text-sm text-text-secondary">
                    {job.serviceType} · {job.assignedStaffId ? job.assignedStaff?.user.fullName ?? "Personel" : "Atanmadı"}
                  </p>
                  <p className="text-xs text-text-faint">{formatDateTime(job.scheduledAt)}</p>
                </div>

                {canChangeStatus ? (
                  <select
                    value={job.status}
                    disabled={updatingId === job.id}
                    onChange={(e) => handleStatusChange(job.id, e.target.value as JobStatus)}
                    className="rounded-xl border border-border bg-surface-base px-3 py-2 text-sm font-medium text-text-primary outline-none transition hover:border-border-strong focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 disabled:opacity-50"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_FILTER_LABELS[s]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <StatusBadge status={job.status} />
                )}
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-end gap-2 text-sm text-text-secondary">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-surface-base transition hover:bg-surface-subtle disabled:opacity-40"
              >
                <ChevronLeft size={16} strokeWidth={1.75} />
              </button>
              <span>
                {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-surface-base transition hover:bg-surface-subtle disabled:opacity-40"
              >
                <ChevronRight size={16} strokeWidth={1.75} />
              </button>
            </div>
          )}
        </>
      )}

      <JobFormModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} customers={customers} staff={staff} />
    </div>
  );
}

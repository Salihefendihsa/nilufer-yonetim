"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Wrench, List, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const statusQuery = statusFilter === "ALL" ? "" : `&status=${statusFilter}`;
      const limit = view === "calendar" ? 200 : 20;
      const jobsRes = await api.get<Paginated<Job>>(`/jobs?page=${page}&limit=${limit}${statusQuery}`);
      setJobs(jobsRes.data);
      setTotalPages(jobsRes.pagination.totalPages);

      const [customersRes, staffRes] = await Promise.allSettled([
        api.get<Paginated<Customer>>("/customers?limit=100"),
        api.get<Paginated<Staff>>("/staff?limit=100"),
      ]);
      if (customersRes.status === "fulfilled") setCustomers(customersRes.value.data);
      if (staffRes.status === "fulfilled") setStaff(staffRes.value.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "İşler yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, view]);

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

  const customerNames = Object.fromEntries(customers.map((c) => [c.id, c.fullName]));
  const staffNames = Object.fromEntries(staff.map((s) => [s.id, s.user.fullName]));
  const canChangeStatus = user?.role === "OWNER" || user?.role === "MANAGER" || user?.role === "STAFF";

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-text-primary">İşler</h1>
          <p className="mt-1 text-sm text-text-secondary">Planlanan ve tamamlanan işleri buradan takip edin.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-2xl bg-white/5 p-1">
            <button
              type="button"
              onClick={() => setView("list")}
              className={`flex items-center gap-1.5 rounded-2xl px-3 py-1.5 text-sm font-medium transition ${
                view === "list" ? "bg-surface-card text-text-primary shadow-sm" : "text-text-secondary"
              }`}
            >
              <List size={15} strokeWidth={1.75} />
              Liste
            </button>
            <button
              type="button"
              onClick={() => setView("calendar")}
              className={`flex items-center gap-1.5 rounded-2xl px-3 py-1.5 text-sm font-medium transition ${
                view === "calendar" ? "bg-surface-card text-text-primary shadow-sm" : "text-text-secondary"
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
              className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-primary-green to-primary-green/90 px-4 py-2.5 text-sm font-semibold text-white transition hover:shadow-[0_0_20px_rgba(212,174,61,0.22)]"
            >
              <Plus size={16} strokeWidth={2} />
              Yeni İş
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["ALL", ...STATUS_OPTIONS] as const).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => {
              setStatusFilter(status);
              setPage(1);
            }}
            className={`rounded-2xl px-3.5 py-1.5 text-sm font-medium transition ${
              statusFilter === status ? "bg-primary-green text-white" : "bg-surface-card text-text-secondary hover:bg-white/5"
            }`}
          >
            {STATUS_FILTER_LABELS[status]}
          </button>
        ))}
      </div>

      {error && <p className="rounded-2xl bg-primary-red/10 px-4 py-3 text-sm text-primary-redLight">{error}</p>}

      {loading ? (
        <p className="py-16 text-center text-sm text-text-faint">Yükleniyor...</p>
      ) : jobs.length === 0 ? (
        <div className="rounded-2xl bg-surface-card shadow-[0_8px_24px_rgba(0,0,0,0.22)]">
          <EmptyState icon={Wrench} title="Gösterilecek iş yok" description="Filtreyi değiştirin veya yeni bir iş oluşturun." />
        </div>
      ) : view === "calendar" ? (
        <WeekCalendar jobs={jobs} customerNames={customerNames} />
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {jobs.map((job) => (
              <div key={job.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-surface-card p-5 shadow-[0_8px_24px_rgba(0,0,0,0.22)]">
                <div className="flex flex-col gap-1">
                  <p className="font-medium text-text-primary">{customerNames[job.customerId] ?? "Müşteri"}</p>
                  <p className="text-sm text-text-secondary">
                    {job.serviceType} · {job.assignedStaffId ? staffNames[job.assignedStaffId] ?? "Personel" : "Atanmadı"}
                  </p>
                  <p className="text-xs text-text-faint">{formatDateTime(job.scheduledAt)}</p>
                </div>

                {canChangeStatus ? (
                  <select
                    value={job.status}
                    disabled={updatingId === job.id}
                    onChange={(e) => handleStatusChange(job.id, e.target.value as JobStatus)}
                    className="rounded-2xl border border-white/10 bg-surface-card px-3 py-2 text-sm text-text-primary outline-none disabled:opacity-50"
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
                className="flex h-8 w-8 items-center justify-center rounded-2xl transition hover:bg-white/5 disabled:opacity-30"
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
                className="flex h-8 w-8 items-center justify-center rounded-2xl transition hover:bg-white/5 disabled:opacity-30"
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

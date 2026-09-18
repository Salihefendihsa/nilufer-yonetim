"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Wrench, List, CalendarDays, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { StatusStrip } from "@/components/StatusStrip";
import { StatusBadge, STATUS_COLORS, STATUS_TEXT } from "@/components/StatusBadge";
import { getValidNextStatuses, JOB_STATUS_VALUES } from "@/lib/jobStatus";
import { useAuth } from "@/lib/AuthProvider";
import { useToast } from "@/lib/ToastProvider";
import { api, ApiError } from "@/lib/api";
import { formatDateTime, formatTime } from "@/lib/format";
import { Modal } from "@/components/Modal";
import type { Customer, Staff, Job, JobStatus, Paginated } from "@/lib/types";
import { JobFormModal } from "./JobFormModal";
import { WarrantyBadge } from "@/components/WarrantyBadge";
import { WeekCalendar } from "./WeekCalendar";

const STATUS_OPTIONS: JobStatus[] = ["PENDING", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
const STATUS_FILTER_LABELS: Record<"ALL" | JobStatus, string> = {
  ALL: "Tümü",
  PENDING: "Bekliyor",
  SCHEDULED: "Planlandı",
  IN_PROGRESS: "Devam Ediyor",
  COMPLETED: "Tamamlandı",
  CANCELLED: "İptal edildi",
};

export default function JobsPage() {
  // Bölüm E (2. tur): useSearchParams (?customerId=&serviceType= deep-link)
  // Next.js'te bir Suspense sınırı gerektiriyor, aksi halde statik dışa
  // aktarım sırasında derleme hatası veriyor.
  return (
    <Suspense fallback={null}>
      <JobsPageContent />
    </Suspense>
  );
}

function JobsPageContent() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [view, setView] = useState<"list" | "calendar">("list");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [statusFilter, setStatusFilter] = useState<"ALL" | JobStatus>("ALL");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formPrefill, setFormPrefill] = useState<{ customerId?: string; serviceType?: string; scheduledAt?: string; notes?: string } | undefined>(undefined);
  // Bölüm J (3. tur): Bekleyen Onaylar → "Planla" ile gelindiyse, oluşturulan iş
  // bu randevu talebine bağlanır (POST /appointment-requests/:id/schedule).
  const [appointmentRequestId, setAppointmentRequestId] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [statusCounts, setStatusCounts] = useState<Record<JobStatus, number> | null>(null);
  // İptal, gerekçe olmadan kaydedilmez — Stitch Müdür → İşler → "İptal Gerekçesi".
  const [cancelTarget, setCancelTarget] = useState<Job | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const canManage = user?.role === "OWNER" || user?.role === "MANAGER";

  // Bölüm E (2. tur): Sözleşmeler → "Şimdi İş Oluştur" kısayolu (?customerId=&serviceType=).
  // Bölüm G (2. tur): Yönetici Özeti → durum filtresiyle gelme (?status=COMPLETED).
  useEffect(() => {
    const customerId = searchParams.get("customerId");
    if (customerId) {
      setFormPrefill({
        customerId,
        serviceType: searchParams.get("serviceType") ?? undefined,
        scheduledAt: searchParams.get("scheduledAt") ?? undefined,
        notes: searchParams.get("notes") ?? undefined,
      });
      setAppointmentRequestId(searchParams.get("appointmentRequestId"));
      setFormOpen(true);
    }
    const status = searchParams.get("status");
    if (status && (JOB_STATUS_VALUES as readonly string[]).includes(status)) {
      setStatusFilter(status as JobStatus);
    }
    // Bölüm I (3. tur): global aramadan gelen ?search= (müşteri adı) arama kutusunu doldurur.
    const initialSearch = searchParams.get("search");
    if (initialSearch) setSearch(initialSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const statusQuery = statusFilter === "ALL" ? "" : `&status=${statusFilter}`;
      const searchQuery = search ? `&search=${encodeURIComponent(search)}` : "";
      const limit = view === "calendar" ? 200 : 20;
      const jobsRes = await api.get<Paginated<Job>>(`/jobs?page=${page}&limit=${limit}${statusQuery}${searchQuery}`);
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
  }, [page, statusFilter, search, view, canManage]);

  // Arama kutusu 400ms debounce ile /jobs?search= parametresine yansır;
  // sayfa 1'e sıfırlanır (yeni bir filtre uygulanmış gibi davranır).
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleStatusChange(jobId: string, status: JobStatus, cancellationReason?: string) {
    setUpdatingId(jobId);
    try {
      await api.patch(`/jobs/${jobId}`, { status, ...(cancellationReason ? { cancellationReason } : {}) });
      load();
      showToast(`İş durumu "${STATUS_FILTER_LABELS[status]}" olarak güncellendi.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Durum güncellenemedi");
    } finally {
      setUpdatingId(null);
    }
  }

  function handleStatusSelect(job: Job, status: JobStatus) {
    if (status === "CANCELLED") {
      setCancelReason("");
      setCancelTarget(job);
      return;
    }
    handleStatusChange(job.id, status);
  }

  async function submitCancellation() {
    if (!cancelTarget || cancelReason.trim() === "") return;
    const job = cancelTarget;
    setCancelTarget(null);
    await handleStatusChange(job.id, "CANCELLED", cancelReason.trim());
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

      {/* [Arama kutusu] */}
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface-card px-4 py-2.5">
        <Search size={16} strokeWidth={1.75} className="text-text-faint" />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="İş no, müşteri, adres veya hizmet türü ara..."
          className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-faint"
        />
      </div>

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
                  <p className="flex items-center gap-2 font-medium text-text-primary">
                    <span className="rounded-md bg-surface-subtle px-1.5 py-0.5 font-mono text-2xs text-text-secondary">
                      #{job.sequenceNo}
                    </span>
                    {job.customer?.fullName ?? "Müşteri"}
                  </p>
                  <p className="flex flex-wrap items-center gap-2 text-sm text-text-secondary">
                    <span>
                      {job.serviceType} · {job.assignedStaffId ? job.assignedStaff?.user.fullName ?? "Personel" : "Atanmadı"}
                    </span>
                    {/* Bölüm Y (6. tur): geçerli garanti rozeti */}
                    <WarrantyBadge expiresAt={job.warrantyExpiresAt} />
                  </p>
                  <p className="text-xs text-text-faint">
                    {formatDateTime(job.scheduledAt)}
                    {job.scheduledEndAt ? ` – ${formatTime(job.scheduledEndAt)}` : ""}
                  </p>
                  {job.status === "CANCELLED" && job.cancellationReason && (
                    <p className="text-xs text-danger-500">İptal gerekçesi: {job.cancellationReason}</p>
                  )}
                </div>

                {canChangeStatus && getValidNextStatuses(job.status).length > 1 ? (
                  <select
                    value={job.status}
                    disabled={updatingId === job.id}
                    onChange={(e) => handleStatusSelect(job, e.target.value as JobStatus)}
                    className="rounded-xl border border-border bg-surface-base px-3 py-2 text-sm font-medium text-text-primary outline-none transition hover:border-border-strong focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 disabled:opacity-50"
                  >
                    {getValidNextStatuses(job.status).map((s) => (
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

      <JobFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setFormPrefill(undefined);
        }}
        onSaved={async (job) => {
          if (appointmentRequestId) {
            try {
              await api.post(`/appointment-requests/${appointmentRequestId}/schedule`, { jobId: job.id });
              showToast("Randevu talebi planlandı, müşteriye bildirildi.");
            } catch (err) {
              setError(err instanceof ApiError ? err.message : "İş oluşturuldu ama randevu talebine bağlanamadı");
            }
            setAppointmentRequestId(null);
          }
          load();
        }}
        customers={customers}
        staff={staff}
        prefill={formPrefill}
      />

      <Modal open={!!cancelTarget} onClose={() => setCancelTarget(null)} title="İşi iptal et">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-secondary">
            {cancelTarget?.customer?.fullName ?? "Bu iş"} için iptal gerekçesini yazın. Gerekçe iş kaydında saklanır.
          </p>
          <input
            autoFocus
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            className="input"
            placeholder="Örn. Müşteri randevuyu erteledi"
          />
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setCancelTarget(null)}
              className="rounded-2xl px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:bg-surface-subtle"
            >
              Vazgeç
            </button>
            <button
              type="button"
              disabled={cancelReason.trim() === ""}
              onClick={submitCancellation}
              className="rounded-2xl bg-danger-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-danger-600 disabled:opacity-60"
            >
              İptal Et
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

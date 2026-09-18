"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ClipboardCheck,
  Inbox,
  HandCoins,
  FileSignature,
  Check,
  X,
  ArrowRightCircle,
  AlertTriangle,
  ClipboardList,
  CalendarOff,
  CalendarPlus,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { RequireRole } from "@/components/RequireRole";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { StatusStrip } from "@/components/StatusStrip";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthProvider";
import { useToast } from "@/lib/ToastProvider";
import { formatDate, currencyFormatter } from "@/lib/format";
import { formatDateTime } from "@/lib/format";
import type { QuoteRequest, AdvanceRequest, Contract, Customer, Job, Paginated, LeaveRequest, AppointmentRequest } from "@/lib/types";

/** /jobs?pendingReportApproval=true yanıtında onaysız rapor özeti gömülü gelir. */
interface JobWithPendingReport extends Job {
  jobReports?: { id: string; createdAt: string; dosage: string; notes: string | null }[];
}

/** Onay kuyruğundaki üç kalem türünün ortak renk/etiket eşlemesi. */
const QUEUE_COLORS = {
  contract: "#B57F13",
  advance: "#3D8A4E",
  quote: "#1F6FA8",
  report: "#5A6B5E",
  leave: "#9B1C1C",
  appointment: "#6B4FBB",
} as const;

/** Bitişine 7 günden az kalan sözleşme "acil" sayılır ve kırmızı kodlanır. */
const URGENT_DAY_THRESHOLD = 7;

export default function ApprovalQueuePage() {
  return (
    <RequireRole roles={["OWNER", "MANAGER", "TEAM_LEAD"]}>
      <ApprovalQueueContent />
    </RequireRole>
  );
}

function ApprovalQueueContent() {
  const { user } = useAuth();
  // TEAM_LEAD yalnızca kendi ekibinin izin taleplerini ve saha raporu
  // onaylarını görebilir — teklif/avans/sözleşme uçları OWNER/MANAGER'a
  // özel (bkz. backend routes), bu yüzden TEAM_LEAD için hiç çağrılmaz.
  const isTeamLead = user?.role === "TEAM_LEAD";

  const [quotes, setQuotes] = useState<QuoteRequest[]>([]);
  const [advances, setAdvances] = useState<AdvanceRequest[]>([]);
  const [expiringContracts, setExpiringContracts] = useState<(Contract & { customer: Customer })[]>([]);
  const [pendingReports, setPendingReports] = useState<JobWithPendingReport[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  // Bölüm J (3. tur): müşteri randevu talepleri (OWNER/MANAGER).
  const [appointmentRequests, setAppointmentRequests] = useState<AppointmentRequest[]>([]);
  const [declineTarget, setDeclineTarget] = useState<AppointmentRequest | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { showToast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // allSettled: bu kalemlerden biri yetki/ağ hatası verirse sayfanın tamamı
      // çökmesin, yalnızca o kalem boş listeyle gösterilsin.
      const [quotesRes, advancesRes, expiringRes, reportsRes, leaveRes, appointmentRes] = await Promise.allSettled([
        isTeamLead ? Promise.resolve({ data: [], pagination: null } as never) : api.get<Paginated<QuoteRequest>>("/quotes?status=NEW&limit=50"),
        isTeamLead ? Promise.resolve({ data: [], pagination: null } as never) : api.get<Paginated<AdvanceRequest>>("/advances?status=PENDING&limit=50"),
        isTeamLead ? Promise.resolve({ data: [] } as never) : api.get<{ data: (Contract & { customer: Customer })[] }>("/contracts/expiring"),
        api.get<Paginated<JobWithPendingReport>>("/jobs?pendingReportApproval=true&limit=50"),
        api.get<Paginated<LeaveRequest>>("/leave-requests?status=PENDING&limit=50"),
        isTeamLead
          ? Promise.resolve({ data: [], pagination: null } as never)
          : api.get<Paginated<AppointmentRequest>>("/appointment-requests?status=PENDING&limit=50"),
      ]);
      setAppointmentRequests(appointmentRes.status === "fulfilled" ? appointmentRes.value.data : []);
      setQuotes(quotesRes.status === "fulfilled" ? quotesRes.value.data : []);
      setAdvances(advancesRes.status === "fulfilled" ? advancesRes.value.data : []);
      setExpiringContracts(expiringRes.status === "fulfilled" ? expiringRes.value.data : []);
      setPendingReports(reportsRes.status === "fulfilled" ? reportsRes.value.data : []);
      setLeaveRequests(
        leaveRes.status === "fulfilled" ? leaveRes.value.data.filter((l) => l.status === "PENDING") : []
      );

      const firstError = [quotesRes, advancesRes, expiringRes, reportsRes, leaveRes, appointmentRes].find((r) => r.status === "rejected");
      if (firstError && firstError.status === "rejected") {
        const reason = firstError.reason;
        setError(reason instanceof ApiError ? reason.message : "Kuyruğun bir kısmı yüklenemedi");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kuyruk yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [isTeamLead]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleQuoteContact(id: string) {
    setBusyId(id);
    try {
      await api.patch(`/quotes/${id}`, { status: "CONTACTED" });
      load();
      showToast("Teklif talebi iletişime geçildi olarak işaretlendi.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Güncellenemedi");
    } finally {
      setBusyId(null);
    }
  }

  async function handleQuoteConvert(id: string) {
    setBusyId(id);
    try {
      await api.post(`/quotes/${id}/convert`);
      load();
      showToast("Teklif işe dönüştürüldü.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Dönüştürülemedi");
    } finally {
      setBusyId(null);
    }
  }

  async function handleAdvanceDecision(id: string, status: "APPROVED" | "REJECTED") {
    setBusyId(id);
    try {
      await api.patch(`/advances/${id}`, { status });
      load();
      showToast(status === "APPROVED" ? "Avans onaylandı." : "Avans reddedildi.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Güncellenemedi");
    } finally {
      setBusyId(null);
    }
  }

  /** Saha raporunu onaylar (POST /jobs/:id/report/approve). */
  async function handleReportApprove(jobId: string) {
    setBusyId(jobId);
    try {
      await api.post(`/jobs/${jobId}/report/approve`, {});
      load();
      showToast("Saha raporu onaylandı.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Rapor onaylanamadı");
    } finally {
      setBusyId(null);
    }
  }

  async function handleLeaveDecision(id: string, status: "APPROVED" | "REJECTED") {
    setBusyId(id);
    try {
      await api.patch(`/leave-requests/${id}/decide`, { status });
      load();
      showToast(status === "APPROVED" ? "İzin talebi onaylandı." : "İzin talebi reddedildi.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Güncellenemedi");
    } finally {
      setBusyId(null);
    }
  }

  /** "Planla": iş formu müşteri + hizmet türü + tercih edilen ilk gün ile önceden dolu açılır; kaydedince talep işe bağlanır. */
  function handleAppointmentSchedule(r: AppointmentRequest) {
    const params = new URLSearchParams({ customerId: r.customerId, appointmentRequestId: r.id });
    if (r.serviceType?.name) params.set("serviceType", r.serviceType.name);
    // datetime-local biçimi (yerel saat): tercih edilen aralığın ilk günü 09:00.
    const start = new Date(r.preferredDateStart);
    const pad = (n: number) => String(n).padStart(2, "0");
    params.set("scheduledAt", `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}T09:00`);
    if (r.note) params.set("notes", `Müşteri notu: ${r.note}`);
    router.push(`/isler?${params.toString()}`);
  }

  async function handleAppointmentDecline() {
    if (!declineTarget || !declineReason.trim()) return;
    setBusyId(declineTarget.id);
    try {
      await api.post(`/appointment-requests/${declineTarget.id}/decline`, { reason: declineReason.trim() });
      setDeclineTarget(null);
      setDeclineReason("");
      load();
      showToast("Randevu talebi reddedildi, müşteriye bildirildi.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Reddedilemedi");
    } finally {
      setBusyId(null);
    }
  }

  const total = quotes.length + advances.length + expiringContracts.length + pendingReports.length + leaveRequests.length + appointmentRequests.length;

  const daysLeftOf = (contract: Contract) =>
    Math.max(0, Math.ceil((new Date(contract.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  // Aciliyet şeridi: acil (7 günden az kalan sözleşmeler) / normal kuyruk kalemleri.
  const urgency = useMemo(() => {
    const urgent = expiringContracts.filter((c) => daysLeftOf(c) <= URGENT_DAY_THRESHOLD).length;
    return { urgent, normal: total - urgent };
  }, [expiringContracts, total]);

  const advanceTotal = useMemo(
    () => advances.reduce((sum, a) => sum + Number(a.amount), 0),
    [advances]
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={ClipboardCheck}
        title="Bekleyen Onaylar"
        description={total > 0 ? `${total} işlem sizi bekliyor.` : "Bekleyen bir işlem yok."}
      />

      {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

      {/* [Özet kartlar] */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Toplam bekleyen"
          value={loading ? "—" : String(total)}
          icon={ClipboardCheck}
          accent={total > 0 ? "gold" : "neutral"}
          mono
          badge={urgency.urgent > 0 ? { label: "Acil", tone: "critical" } : undefined}
        />
        <StatCard
          label="Teklif talebi"
          value={loading ? "—" : String(quotes.length)}
          icon={Inbox}
          accent="blue"
          mono
          hint="Yeni gelen web talepleri"
        />
        <StatCard
          label="Avans talebi"
          value={loading ? "—" : String(advances.length)}
          icon={HandCoins}
          mono
          hint={advances.length > 0 ? `Toplam ${currencyFormatter.format(advanceTotal)}` : undefined}
        />
        <StatCard
          label="Saha raporu onayı"
          value={loading ? "—" : String(pendingReports.length)}
          icon={ClipboardList}
          accent="neutral"
          mono
          hint="Personelin gönderdiği, onay bekleyen raporlar"
        />
        <StatCard
          label="Bitmek üzere sözleşme"
          value={loading ? "—" : String(expiringContracts.length)}
          icon={FileSignature}
          accent="red"
          mono
          hint={urgency.urgent > 0 ? `${urgency.urgent} tanesi ${URGENT_DAY_THRESHOLD} günden az` : undefined}
        />
        <StatCard
          label="İzin talebi"
          value={loading ? "—" : String(leaveRequests.length)}
          icon={CalendarOff}
          accent="red"
          mono
          hint="Karar bekleyen izin talepleri"
        />
        {!isTeamLead && (
          <StatCard
            label="Randevu talebi"
            value={loading ? "—" : String(appointmentRequests.length)}
            icon={CalendarPlus}
            accent="blue"
            mono
            hint="Müşterilerin hesabından açtığı talepler"
          />
        )}
      </div>

      {/* [Aciliyet / tür dağılımı şeridi] */}
      <StatusStrip
        loading={loading}
        totalLabel={`${total} kalem`}
        segments={[
          { label: "sözleşme", count: expiringContracts.length, color: QUEUE_COLORS.contract },
          { label: "avans", count: advances.length, color: QUEUE_COLORS.advance },
          { label: "teklif", count: quotes.length, color: QUEUE_COLORS.quote },
          { label: "saha raporu", count: pendingReports.length, color: QUEUE_COLORS.report },
          { label: "izin", count: leaveRequests.length, color: QUEUE_COLORS.leave },
          { label: "randevu", count: appointmentRequests.length, color: QUEUE_COLORS.appointment },
        ]}
        action={
          urgency.urgent > 0 ? (
            <span className="flex items-center gap-1.5 rounded-full bg-danger-50 px-3 py-1 text-xs font-semibold text-danger-500">
              <AlertTriangle size={13} strokeWidth={2} />
              {urgency.urgent} acil kalem
            </span>
          ) : (
            <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700">Acil kalem yok</span>
          )
        }
      />

      {/* [Kuyruk listesi] */}
      {loading ? (
        <p className="py-16 text-center text-sm text-text-faint">Yükleniyor...</p>
      ) : total === 0 ? (
        <div className="rounded-2xl border border-border bg-surface-card shadow-card">
          <EmptyState icon={Inbox} title="Kuyruk boş" description="Yeni bir teklif, avans talebi veya bitmek üzere olan sözleşme geldiğinde burada görünecek." />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {appointmentRequests.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border border-l-4 bg-surface-card p-5 shadow-card transition hover:shadow-cardHover"
              style={{ borderLeftColor: QUEUE_COLORS.appointment }}
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-600 ring-1 ring-primary-100">
                  <CalendarPlus size={16} strokeWidth={1.75} />
                </span>
                <div>
                  <p className="text-2xs font-semibold uppercase tracking-wide text-primary-600">Randevu Talebi</p>
                  <p className="mt-0.5 font-medium text-text-primary">
                    {r.customer?.fullName ?? "Müşteri"} · {r.serviceType?.name ?? "Hizmet"}
                  </p>
                  <p className="text-sm text-text-secondary">
                    {formatDate(r.preferredDateStart)} – {formatDate(r.preferredDateEnd)}
                    {r.customer?.phone ? ` · ${r.customer.phone}` : ""}
                    {r.note ? ` · ${r.note}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => handleAppointmentSchedule(r)}
                  className="flex items-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-card transition hover:bg-primary-700 disabled:opacity-50"
                >
                  <CalendarPlus size={15} strokeWidth={2} />
                  Planla
                </button>
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => {
                    setDeclineReason("");
                    setDeclineTarget(r);
                  }}
                  className="flex items-center gap-1.5 rounded-xl border border-danger-100 bg-danger-50 px-4 py-2 text-sm font-semibold text-danger-500 transition hover:bg-danger-100 disabled:opacity-50"
                >
                  <X size={15} strokeWidth={2} />
                  Reddet
                </button>
              </div>
            </div>
          ))}

          {leaveRequests.map((leave) => (
            <div
              key={leave.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border border-l-4 bg-surface-card p-5 shadow-card transition hover:shadow-cardHover"
              style={{ borderLeftColor: QUEUE_COLORS.leave }}
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-danger-50 text-danger-500 ring-1 ring-danger-100">
                  <CalendarOff size={16} strokeWidth={1.75} />
                </span>
                <div>
                  <p className="text-2xs font-semibold uppercase tracking-wide text-danger-500">İzin Talebi</p>
                  <p className="mt-0.5 font-medium text-text-primary">{leave.staff?.user.fullName ?? "Personel"}</p>
                  <p className="text-sm text-text-secondary">
                    {formatDate(leave.startDate)} – {formatDate(leave.endDate)} · {leave.reason}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busyId === leave.id}
                  onClick={() => handleLeaveDecision(leave.id, "APPROVED")}
                  className="flex items-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-card transition hover:bg-primary-700 disabled:opacity-50"
                >
                  <Check size={15} strokeWidth={2} />
                  Onayla
                </button>
                <button
                  type="button"
                  disabled={busyId === leave.id}
                  onClick={() => handleLeaveDecision(leave.id, "REJECTED")}
                  className="flex items-center gap-1.5 rounded-xl border border-danger-100 bg-danger-50 px-4 py-2 text-sm font-semibold text-danger-500 transition hover:bg-danger-100 disabled:opacity-50"
                >
                  <X size={15} strokeWidth={2} />
                  Reddet
                </button>
              </div>
            </div>
          ))}

          {pendingReports.map((job) => (
            <div
              key={job.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border border-l-4 bg-surface-card p-5 shadow-card transition hover:shadow-cardHover"
              style={{ borderLeftColor: QUEUE_COLORS.report }}
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-subtle text-text-secondary ring-1 ring-border">
                  <ClipboardList size={16} strokeWidth={1.75} />
                </span>
                <div>
                  <p className="text-2xs font-semibold uppercase tracking-wide text-text-secondary">Saha Raporu</p>
                  <p className="mt-0.5 font-medium text-text-primary">
                    {job.customer?.fullName ?? "Müşteri"} · {job.serviceType}
                  </p>
                  <p className="text-sm text-text-secondary">
                    {job.assignedStaff?.user.fullName ?? "Personel"}
                    {job.jobReports?.[0] ? ` · ${formatDateTime(job.jobReports[0].createdAt)}` : ""}
                    {job.jobReports?.[0]?.dosage ? ` · Doz: ${job.jobReports[0].dosage}` : ""}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={busyId === job.id}
                onClick={() => handleReportApprove(job.id)}
                className="flex items-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-card transition hover:bg-primary-700 disabled:opacity-50"
              >
                <Check size={15} strokeWidth={2} />
                Raporu Onayla
              </button>
            </div>
          ))}

          {expiringContracts.map((contract) => {
            const daysLeft = daysLeftOf(contract);
            const urgent = daysLeft <= URGENT_DAY_THRESHOLD;

            return (
              <div
                key={contract.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border border-l-4 bg-surface-card p-5 shadow-card transition hover:shadow-cardHover"
                style={{ borderLeftColor: urgent ? "#C0392B" : QUEUE_COLORS.contract }}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1 ${
                      urgent ? "bg-danger-50 text-danger-500 ring-danger-100" : "bg-warning-50 text-warning-500 ring-warning-100"
                    }`}
                  >
                    <FileSignature size={16} strokeWidth={1.75} />
                  </span>
                  <div>
                    <p className="flex flex-wrap items-center gap-2">
                      <span className={`text-2xs font-semibold uppercase tracking-wide ${urgent ? "text-danger-500" : "text-warning-600"}`}>
                        Sözleşme
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-2xs font-semibold ${
                          urgent ? "bg-danger-50 text-danger-500" : "bg-warning-50 text-warning-600"
                        }`}
                      >
                        {daysLeft} gün kaldı
                      </span>
                    </p>
                    <p className="mt-0.5 font-medium text-text-primary">{contract.customer.fullName}</p>
                    <p className="text-sm text-text-secondary">Bitiş: {formatDate(contract.endDate)}</p>
                  </div>
                </div>
                <a
                  href="/sozlesmeler"
                  className="flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-border bg-surface-base px-3.5 py-2 text-sm font-medium text-text-secondary transition hover:border-border-strong hover:bg-surface-subtle hover:text-text-primary"
                >
                  Sözleşmeye Git
                  <ArrowRightCircle size={15} strokeWidth={1.75} />
                </a>
              </div>
            );
          })}

          {advances.map((advance) => (
            <div
              key={advance.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border border-l-4 bg-surface-card p-5 shadow-card transition hover:shadow-cardHover"
              style={{ borderLeftColor: QUEUE_COLORS.advance }}
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-600 ring-1 ring-primary-100">
                  <HandCoins size={16} strokeWidth={1.75} />
                </span>
                <div>
                  <p className="text-2xs font-semibold uppercase tracking-wide text-primary-700">Avans Talebi</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 font-medium text-text-primary">
                    {advance.staff?.user.fullName ?? "Personel"}
                    <span className="rounded-full bg-primary-50 px-2 py-0.5 font-mono text-2xs font-semibold text-primary-700">
                      {currencyFormatter.format(advance.amount)}
                    </span>
                  </p>
                  <p className="text-sm text-text-secondary">{advance.reason}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busyId === advance.id}
                  onClick={() => handleAdvanceDecision(advance.id, "APPROVED")}
                  className="flex items-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-card transition hover:bg-primary-700 disabled:opacity-50"
                >
                  <Check size={15} strokeWidth={2} />
                  Onayla
                </button>
                <button
                  type="button"
                  disabled={busyId === advance.id}
                  onClick={() => handleAdvanceDecision(advance.id, "REJECTED")}
                  className="flex items-center gap-1.5 rounded-xl border border-danger-100 bg-danger-50 px-4 py-2 text-sm font-semibold text-danger-500 transition hover:bg-danger-100 disabled:opacity-50"
                >
                  <X size={15} strokeWidth={2} />
                  Reddet
                </button>
              </div>
            </div>
          ))}

          {quotes.map((quote) => (
            <div
              key={quote.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border border-l-4 bg-surface-card p-5 shadow-card transition hover:shadow-cardHover"
              style={{ borderLeftColor: QUEUE_COLORS.quote }}
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-info-50 text-info-500 ring-1 ring-info-100">
                  <Inbox size={16} strokeWidth={1.75} />
                </span>
                <div>
                  <p className="text-2xs font-semibold uppercase tracking-wide text-info-600">Teklif Talebi</p>
                  <p className="mt-0.5 font-medium text-text-primary">{quote.fullName}</p>
                  <p className="text-sm text-text-secondary">
                    {quote.serviceType} · <span className="font-mono text-xs">{quote.phone}</span>
                    {quote.district && ` · ${quote.district}`}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busyId === quote.id}
                  onClick={() => handleQuoteContact(quote.id)}
                  className="flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-border bg-surface-base px-3.5 py-2 text-sm font-medium text-text-secondary transition hover:border-border-strong hover:bg-surface-subtle hover:text-text-primary disabled:opacity-50"
                >
                  İletişime Geçildi
                </button>
                <button
                  type="button"
                  disabled={busyId === quote.id}
                  onClick={() => handleQuoteConvert(quote.id)}
                  className="flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-primary-600 px-3.5 py-2 text-sm font-semibold text-white shadow-card transition hover:bg-primary-700 disabled:opacity-50"
                >
                  <ArrowRightCircle size={15} strokeWidth={2} />
                  Dönüştür
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal open={!!declineTarget} onClose={() => setDeclineTarget(null)} title="Randevu talebini reddet">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-secondary">
            {declineTarget?.customer?.fullName ?? "Müşteri"} · {declineTarget?.serviceType?.name ?? "Hizmet"} — gerekçe müşteriye bildirim olarak iletilir.
          </p>
          <textarea
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            rows={3}
            maxLength={1000}
            className="input"
            placeholder="Örn. O tarihlerde ekip dolu, sonraki hafta için tekrar talep açabilirsiniz"
          />
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setDeclineTarget(null)} className="rounded-2xl px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:bg-surface-subtle">
              Vazgeç
            </button>
            <button
              type="button"
              disabled={!declineReason.trim() || busyId === declineTarget?.id}
              onClick={handleAppointmentDecline}
              className="rounded-2xl bg-danger-500 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition hover:bg-danger-600 disabled:opacity-60"
            >
              Reddet
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

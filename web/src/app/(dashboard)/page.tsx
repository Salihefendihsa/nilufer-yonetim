"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarCheck,
  Wallet,
  MessageSquarePlus,
  HardHat,
  Clock,
  CheckCircle2,
  History,
  Plus,
  Bug,
  ChevronDown,
  Beaker,
  Users2,
  Shuffle,
  HandCoins,
  ClipboardCheck,
  Users,
  PiggyBank,
  Timer,
  Server,
  MessageCircle,
  Activity,
  BarChart3,
  MapPin,
  Calendar,
  Wrench,
} from "lucide-react";
import { api, ApiError, resolveUploadUrl } from "@/lib/api";
import { useAuth } from "@/lib/AuthProvider";
import { StatCard } from "@/components/StatCard";
import { PageHeader } from "@/components/PageHeader";
import { StatusStrip } from "@/components/StatusStrip";
import { ChartCard, DonutChart, RankBars, SimpleBarChart } from "@/components/ChartCard";
import { StatusBadge, STATUS_COLORS, STATUS_TEXT } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { StarRating } from "@/components/StarRating";
import { ActivityFeed } from "@/components/ActivityFeed";
import { PhotoLightbox } from "@/components/PhotoLightbox";
import { currencyFormatter, formatDateTime, todayIsoDate, toIsoDate } from "@/lib/format";
import type { Job, JobReport, JobPhoto, JobStatus, Staff, Paginated, Customer, ActivityEvent, SystemHealth } from "@/lib/types";
import { QuoteRequestModal } from "./QuoteRequestModal";
import { JobReportModal } from "./JobReportModal";
import { AdvanceRequestModal } from "./AdvanceRequestModal";

interface DashboardSummary {
  todaysJobsCount: number;
  thisMonthPaymentsTotal: number;
  newQuoteRequestsCount: number;
  activeStaffCount: number;
  completedJobsThisMonth: number;
}

const KPI_REFRESH_MS = 30000;

export default function DashboardPage() {
  const { user, loading } = useAuth();

  if (loading || !user) return null;
  if (user.role === "MANAGER") return <ManagerDashboard />;
  if (user.role === "TEAM_LEAD") return <TeamLeadDashboard />;
  if (user.role === "STAFF") return <StaffDashboard />;
  if (user.role === "CUSTOMER") return <CustomerDashboard />;
  return <OwnerDashboard />;
}

interface CommandCenterData {
  summary: DashboardSummary | null;
  netProfitThisMonth: number | null;
  totalCustomers: number | null;
  pendingQuotes: number;
  pendingAdvances: number;
  expiringContracts: number;
  cancelledJobs: number;
  lowStockCount: number;
  expiringCertifications: number;
  avgCompletionHours: number | null;
  weekCounts: { label: string; count: number }[];
  districtCounts: { district: string; count: number }[];
  activity: ActivityEvent[];
  health: SystemHealth | null;
}

const ALL_STATUSES: JobStatus[] = ["PENDING", "SCHEDULED", "COMPLETED", "CANCELLED"];

/** Bir iş listesini StatusStrip segmentlerine çevirir — beş dashboard da aynı eşlemeyi kullanır. */
function toStatusSegments(jobs: Job[]) {
  return ALL_STATUSES.map((status) => ({
    label: STATUS_TEXT[status],
    count: jobs.filter((j) => j.status === status).length,
    color: STATUS_COLORS[status],
  }));
}

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);
  return now;
}

function WeekBarChart({ data }: { data: { label: string; count: number }[] }) {
  return <SimpleBarChart data={data} xKey="label" series={[{ key: "count", name: "İş sayısı" }]} />;
}

function OwnerDashboard() {
  const clock = useClock();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [data, setData] = useState<CommandCenterData>({
    summary: null,
    netProfitThisMonth: null,
    totalCustomers: null,
    pendingQuotes: 0,
    pendingAdvances: 0,
    expiringContracts: 0,
    cancelledJobs: 0,
    lowStockCount: 0,
    expiringCertifications: 0,
    avgCompletionHours: null,
    weekCounts: [],
    districtCounts: [],
    activity: [],
    health: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadKpis = useCallback(async () => {
    try {
      const [summary, paymentsSummary, customersRes, quotesRes, advancesRes, expiringRes, cancelledRes, lowStockRes, expiringCertsRes, health] = await Promise.all([
        api.get<DashboardSummary>("/dashboard/summary"),
        api.get<{ netProfitThisMonth?: number }>("/payments/summary"),
        api.get<Paginated<Customer>>("/customers?limit=200"),
        api.get<Paginated<unknown>>("/quotes?status=NEW&limit=1"),
        api.get<Paginated<unknown>>("/advances?status=PENDING&limit=1"),
        api.get<{ data: unknown[] }>("/contracts/expiring"),
        api.get<Paginated<unknown>>("/jobs?status=CANCELLED&limit=1"),
        api.get<{ data: unknown[] }>("/products/low-stock"),
        api.get<{ data: unknown[] }>("/staff/certifications/expiring"),
        api.get<SystemHealth>("/system/health"),
      ]);

      const districtMap = new Map<string, number>();
      customersRes.data.forEach((c) => {
        const key = c.district?.trim() || "Belirtilmemiş";
        districtMap.set(key, (districtMap.get(key) ?? 0) + 1);
      });
      const districtCounts = Array.from(districtMap.entries())
        .map(([district, count]) => ({ district, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);

      setData((prev) => ({
        ...prev,
        summary,
        netProfitThisMonth: paymentsSummary.netProfitThisMonth ?? null,
        totalCustomers: customersRes.pagination.total,
        pendingQuotes: quotesRes.pagination.total,
        pendingAdvances: advancesRes.pagination.total,
        expiringContracts: expiringRes.data.length,
        cancelledJobs: cancelledRes.pagination.total,
        lowStockCount: lowStockRes.data.length,
        expiringCertifications: expiringCertsRes.data.length,
        districtCounts,
        health,
      }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Veriler yüklenemedi");
    }
  }, []);

  const loadWeekAndActivity = useCallback(async () => {
    try {
      const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return d;
      });

      const [weekResults, activityRes, completedRes] = await Promise.all([
        Promise.all(days.map((d) => api.get<Paginated<unknown>>(`/jobs?date=${toIsoDate(d)}&limit=1`))),
        api.get<{ data: ActivityEvent[] }>("/dashboard/activity-feed"),
        api.get<Paginated<Job>>("/jobs?status=COMPLETED&limit=50"),
      ]);

      const weekCounts = days.map((d, i) => ({
        label: d.toLocaleDateString("tr-TR", { weekday: "short" }),
        count: weekResults[i].pagination.total,
      }));

      const durations = completedRes.data
        .filter((j) => j.completedAt)
        .map((j) => (new Date(j.completedAt as string).getTime() - new Date(j.createdAt).getTime()) / (1000 * 60 * 60));
      const avgCompletionHours = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : null;

      setData((prev) => ({ ...prev, weekCounts, activity: activityRes.data, avgCompletionHours }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Veriler yüklenemedi");
    }
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const jobsRes = await api.get<Paginated<Job>>(`/jobs?date=${todayIsoDate()}&limit=50`);
        setJobs(jobsRes.data);
        await Promise.all([loadKpis(), loadWeekAndActivity()]);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Veriler yüklenemedi");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [loadKpis, loadWeekAndActivity]);

  useEffect(() => {
    const interval = setInterval(loadKpis, KPI_REFRESH_MS);
    return () => clearInterval(interval);
  }, [loadKpis]);

  const pendingApprovalsCount = data.pendingQuotes + data.pendingAdvances + data.expiringContracts;
  const activeJobsCount = jobs.filter((j) => j.status === "PENDING" || j.status === "SCHEDULED").length;
  const completionRate =
    jobs.length > 0 ? (jobs.filter((j) => j.status === "COMPLETED").length / jobs.length) * 100 : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface-card p-6 shadow-card">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-600 text-white">
            <Activity size={20} strokeWidth={1.75} />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-text-primary">Komuta Merkezi</h1>
            <p className="mt-1 text-sm text-text-secondary">Canlı operasyon özeti</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full bg-surface-subtle px-2.5 py-1 text-xs text-text-secondary">
                <span className={`h-1.5 w-1.5 rounded-full ${data.health?.api === "healthy" ? "bg-primary-500" : "bg-danger-500"}`} />
                API
              </span>
              <span className="flex items-center gap-1.5 rounded-full bg-surface-subtle px-2.5 py-1 text-xs text-text-secondary">
                <span className={`h-1.5 w-1.5 rounded-full ${data.health?.database === "healthy" ? "bg-primary-500" : "bg-danger-500"}`} />
                Veritabanı
              </span>
              <span className="rounded-full bg-surface-subtle px-2.5 py-1 font-mono text-xs text-text-faint">
                {clock.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            </div>
          </div>
        </div>
        <Link
          href="/bekleyen-onaylar"
          className="flex items-center gap-2 rounded-2xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition hover:bg-primary-700"
        >
          <ClipboardCheck size={16} strokeWidth={1.75} />
          Bekleyen Onaylar
        </Link>
      </div>

      {/* [Bugünün durum dağılımı] */}
      <StatusStrip loading={loading} totalLabel={`Bugün ${jobs.length} iş`} segments={toStatusSegments(jobs)} />

      {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Toplam Müşteri" value={data.totalCustomers !== null ? String(data.totalCustomers) : "—"} icon={Users} mono />
        <StatCard
          label="Aktif İş"
          value={loading ? "—" : String(activeJobsCount)}
          icon={CalendarCheck}
          badge={{ label: "Bugün", tone: "live" }}
        />
        <StatCard
          label="Bekleyen Onay"
          value={String(pendingApprovalsCount)}
          icon={ClipboardCheck}
          accent="red"
          badge={pendingApprovalsCount > 0 ? { label: "Kritik", tone: "critical" } : undefined}
        />
        <StatCard
          label="Toplam Tahsilat"
          value={data.summary ? currencyFormatter.format(data.summary.thisMonthPaymentsTotal) : "—"}
          icon={Wallet}
          accent="blue"
          mono
          hint="Bu ay tahsil edilen"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Bu Ay Tamamlanan İş"
          value={data.summary ? String(data.summary.completedJobsThisMonth) : "—"}
          icon={CheckCircle2}
          mono
          progress={completionRate}
          hint={`Bugünkü işlerin %${Math.round(completionRate)}'i tamamlandı`}
        />
        <StatCard label="Aktif Personel" value={data.summary ? String(data.summary.activeStaffCount) : "—"} icon={HardHat} accent="neutral" mono />
        <StatCard
          label="Bu Ay Net Kâr"
          value={data.netProfitThisMonth !== null ? currencyFormatter.format(data.netProfitThisMonth) : "—"}
          icon={PiggyBank}
          accent="gold"
        />
        <StatCard
          label="Ort. İş Tamamlama Süresi"
          value={data.avgCompletionHours !== null ? `${data.avgCompletionHours.toFixed(1)} sa` : "—"}
          icon={Timer}
          mono
        />
      </div>

      {/* [Grafikler] */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard
          title="Son 7 Günlük İş Grafiği"
          description="Günlük planlanan iş sayısı"
          icon={BarChart3}
          height={260}
          className="lg:col-span-2"
        >
          <WeekBarChart data={data.weekCounts} />
        </ChartCard>

        <ChartCard title="Bugünün Durum Dağılımı" description="Açık ve kapanan işler" icon={Activity} height={260}>
          <DonutChart
            data={toStatusSegments(jobs).map((seg) => ({ name: seg.label, value: seg.count, color: seg.color }))}
            centerValue={String(jobs.length)}
            centerLabel="bugünkü iş"
            emptyLabel={loading ? "Yükleniyor..." : "Bugün iş yok"}
          />
        </ChartCard>

        <ChartCard title="Bölge Dağılımı" description="Müşterilerin semt kırılımı" icon={MapPin} height={240} className="lg:col-span-2">
          <RankBars
            rows={data.districtCounts.map((d) => ({ label: d.district, value: d.count }))}
            emptyLabel={loading ? "Yükleniyor..." : "Henüz veri yok"}
          />
        </ChartCard>

        <ChartCard title="Bekleyen Uyarılar" description="Aksiyon bekleyen kalemler" icon={ClipboardCheck} height={240}>
          <ul className="flex h-full flex-col justify-center gap-2 text-sm">
            {[
              { label: "Bekleyen onay", value: pendingApprovalsCount, tone: "warning" },
              { label: "Kritik seviyede ürün", value: data.lowStockCount, tone: "warning" },
              { label: "30 gün içi bitecek sözleşme", value: data.expiringContracts, tone: "warning" },
              { label: "Sertifika süresi doluyor", value: data.expiringCertifications, tone: "warning" },
              { label: "İptal edilen iş", value: data.cancelledJobs, tone: "danger" },
            ].map((row) => (
              <li
                key={row.label}
                className={`flex items-center justify-between rounded-xl border px-3 py-2 ${
                  row.value === 0
                    ? "border-border bg-surface-subtle"
                    : row.tone === "danger"
                      ? "border-danger-100 bg-danger-50"
                      : "border-warning-100 bg-warning-50"
                }`}
              >
                <span className="text-text-secondary">{row.label}</span>
                <span
                  className={`font-mono font-semibold ${
                    row.value === 0 ? "text-text-faint" : row.tone === "danger" ? "text-danger-500" : "text-warning-600"
                  }`}
                >
                  {row.value}
                </span>
              </li>
            ))}
          </ul>
        </ChartCard>
      </div>

      <div className="rounded-2xl border border-border bg-surface-card p-6 shadow-card">
        <div className="mb-3 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 ring-1 ring-primary-100">
            <Activity size={17} strokeWidth={1.75} />
          </span>
          <h2 className="text-base font-semibold text-text-primary">Aktivite Akışı</h2>
        </div>
        <ActivityFeed events={data.activity} loading={loading} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <QuickAccessCard href="/bekleyen-onaylar" icon={ClipboardCheck} label="Bekleyen Onaylar" />
        <QuickAccessCard href="/mesajlar" icon={MessageCircle} label="Mesajlar" />
        <QuickAccessCard href="/sistem-durumu" icon={Server} label="Sistem Durumu" />
        <QuickAccessCard href="/para" icon={Wallet} label="Para" />
      </div>
    </div>
  );
}

function QuickAccessCard({ href, icon: Icon, label }: { href: string; icon: typeof Wallet; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl border border-border bg-surface-card p-4 shadow-card transition hover:border-primary-200 hover:bg-primary-50/50 hover:shadow-cardHover"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 ring-1 ring-primary-100">
        <Icon size={18} strokeWidth={1.75} />
      </span>
      <span className="text-sm font-medium text-text-primary">{label}</span>
    </Link>
  );
}

function ManagerDashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const jobsRes = await api.get<{ data: Job[] }>(`/jobs?date=${todayIsoDate()}&limit=50`);
        setJobs(jobsRes.data);
        const summaryRes = await api.get<DashboardSummary>("/dashboard/summary");
        setSummary(summaryRes);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Veriler yüklenemedi");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Hizmet kırılımı bugünkü iş listesinden türetilir; ek istek yok.
  const serviceRows = useMemo(() => {
    const counts = new Map<string, number>();
    for (const job of jobs) counts.set(job.serviceType, (counts.get(job.serviceType) ?? 0) + 1);
    return Array.from(counts.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [jobs]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={BarChart3}
        title={`Merhaba${user ? `, ${user.fullName.split(" ")[0]}` : ""}`}
        description="İşte bugün işletmende olup bitenler."
      />

      {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

      {/* [Özet kartlar] */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Bugünkü işler" value={summary ? String(summary.todaysJobsCount) : "—"} icon={CalendarCheck} mono />
        <StatCard
          label="Bu ay tamamlanan iş"
          value={summary ? String(summary.completedJobsThisMonth) : "—"}
          icon={ClipboardCheck}
          accent="blue"
          mono
        />
        <StatCard
          label="Yeni talepler"
          value={summary ? String(summary.newQuoteRequestsCount) : "—"}
          icon={MessageSquarePlus}
          accent="red"
          mono
        />
        <StatCard
          label="Aktif personel"
          value={summary ? String(summary.activeStaffCount) : "—"}
          icon={HardHat}
          accent="neutral"
          mono
        />
      </div>

      {/* [Durum dağılımı şeridi] */}
      <StatusStrip loading={loading} totalLabel={`Bugün ${jobs.length} iş`} segments={toStatusSegments(jobs)} />

      {/* [Grafik] */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Bugünün Durum Dağılımı" icon={Activity} height={240}>
          <DonutChart
            data={toStatusSegments(jobs).map((seg) => ({ name: seg.label, value: seg.count, color: seg.color }))}
            centerValue={String(jobs.length)}
            centerLabel="bugünkü iş"
            emptyLabel={loading ? "Yükleniyor..." : "Bugün iş yok"}
          />
        </ChartCard>

        <ChartCard title="Hizmet Türü Kırılımı" description="Bugünkü işler" icon={BarChart3} height={240}>
          <RankBars rows={serviceRows} emptyLabel={loading ? "Yükleniyor..." : "Bugün iş yok"} />
        </ChartCard>
      </div>

      {/* [Detaylı liste] */}
      <div className="rounded-2xl border border-border bg-surface-card p-6 shadow-card">
        <div className="mb-5 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 ring-1 ring-primary-100">
            <Clock size={17} strokeWidth={1.75} />
          </span>
          <h2 className="text-base font-semibold text-text-primary">Bugünkü işler</h2>
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-text-faint">Yükleniyor...</p>
        ) : jobs.length === 0 ? (
          <EmptyState icon={CalendarCheck} title="Bugün için planlanmış iş yok" />
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {jobs.map((job) => (
              <li key={job.id} className="flex items-center justify-between gap-4 py-4">
                <div>
                  <p className="text-sm font-medium text-text-primary">{job.serviceType}</p>
                  <p className="mt-0.5 text-xs text-text-secondary">{formatDateTime(job.scheduledAt)}</p>
                </div>
                <StatusBadge status={job.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function TeamLeadDashboard() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [team, setTeam] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reassigningId, setReassigningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [jobsRes, teamRes] = await Promise.all([
        api.get<{ data: Job[] }>(`/jobs?date=${todayIsoDate()}&limit=50`),
        api.get<Paginated<Staff>>("/staff?limit=100"),
      ]);
      setJobs(jobsRes.data);
      setTeam(teamRes.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Veriler yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleReassign(jobId: string, staffId: string) {
    setReassigningId(jobId);
    try {
      await api.patch(`/jobs/${jobId}`, { assignedStaffId: staffId });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Atama güncellenemedi");
    } finally {
      setReassigningId(null);
    }
  }

  const staffNames = Object.fromEntries(team.map((s) => [s.id, s.user.fullName]));

  // İş yükü çubukları mevcut jobs/team dizilerinden hesaplanır.
  const teamLoadRows = useMemo(() => {
    const counts = new Map<string, number>();
    for (const job of jobs) {
      if (!job.assignedStaffId) continue;
      counts.set(job.assignedStaffId, (counts.get(job.assignedStaffId) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([staffId, value]) => ({ label: staffNames[staffId] ?? "Personel", value }))
      .sort((a, b) => b.value - a.value);
  }, [jobs, staffNames]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Users2}
        title="Ekibim"
        description={`Merhaba${user ? `, ${user.fullName.split(" ")[0]}` : ""}. Ekibinin bugünkü işleri burada.`}
      />

      {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

      {/* [Özet kartlar] */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Bugünkü iş" value={loading ? "—" : String(jobs.length)} icon={CalendarCheck} mono />
        <StatCard
          label="Tamamlanan"
          value={loading ? "—" : String(jobs.filter((j) => j.status === "COMPLETED").length)}
          icon={CheckCircle2}
          mono
          progress={jobs.length > 0 ? (jobs.filter((j) => j.status === "COMPLETED").length / jobs.length) * 100 : 0}
        />
        <StatCard label="Ekip mevcudu" value={loading ? "—" : String(team.length)} icon={Users2} accent="blue" mono />
      </div>

      {/* [Durum dağılımı şeridi] */}
      <StatusStrip loading={loading} totalLabel={`${jobs.length} iş`} segments={toStatusSegments(jobs)} />

      {/* [Ekip iş yükü] */}
      <ChartCard title="Ekip İş Yükü" description="Bugün kişi başına düşen iş" icon={Shuffle} height={200}>
        <RankBars rows={teamLoadRows} emptyLabel={loading ? "Yükleniyor..." : "Bugün atanmış iş yok"} />
      </ChartCard>

      {loading ? (
        <p className="py-8 text-center text-sm text-text-faint">Yükleniyor...</p>
      ) : jobs.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface-card shadow-card">
          <EmptyState icon={CalendarCheck} title="Bugün ekibine ait planlanmış iş yok" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border border-l-4 bg-surface-card p-5 shadow-card transition hover:shadow-cardHover"
              style={{ borderLeftColor: STATUS_COLORS[job.status] }}
            >
              <div>
                <p className="text-lg font-semibold text-text-primary">{job.serviceType}</p>
                <p className="mt-1 text-sm text-text-secondary">
                  {job.assignedStaffId ? staffNames[job.assignedStaffId] ?? "Personel" : "Atanmadı"} · {formatDateTime(job.scheduledAt)}
                </p>
                <div className="mt-2">
                  <StatusBadge status={job.status} />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Shuffle size={15} strokeWidth={1.75} className="text-text-faint" />
                <select
                  value={job.assignedStaffId ?? ""}
                  disabled={reassigningId === job.id}
                  onChange={(e) => handleReassign(job.id, e.target.value)}
                  className="rounded-xl border border-border bg-surface-base px-3 py-2 text-sm font-medium text-text-primary outline-none transition hover:border-border-strong focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 disabled:opacity-50"
                >
                  <option value="" disabled>
                    Yeniden ata
                  </option>
                  {team.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.user.fullName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StaffDashboard() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportJobId, setReportJobId] = useState<string | null>(null);
  const [advanceModalOpen, setAdvanceModalOpen] = useState(false);
  const [advanceSent, setAdvanceSent] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: Job[] }>(`/jobs?date=${todayIsoDate()}&limit=50`);
      setJobs(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "İşler yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Wrench}
        title={`Merhaba${user ? `, ${user.fullName.split(" ")[0]}` : ""}`}
        description="Bugünkü işlerin burada."
        actions={
          <button
            type="button"
            onClick={() => setAdvanceModalOpen(true)}
            className="flex items-center gap-2 rounded-2xl border border-border bg-surface-base px-4 py-2.5 text-sm font-medium text-text-primary transition hover:border-border-strong hover:bg-surface-subtle"
          >
            <HandCoins size={16} strokeWidth={1.75} />
            Avans Talep Et
          </button>
        }
      />

      {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

      {/* [Özet kartlar] */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Bugünkü iş" value={loading ? "—" : String(jobs.length)} icon={CalendarCheck} mono />
        <StatCard
          label="Tamamladığın"
          value={loading ? "—" : String(jobs.filter((j) => j.status === "COMPLETED").length)}
          icon={CheckCircle2}
          mono
          progress={jobs.length > 0 ? (jobs.filter((j) => j.status === "COMPLETED").length / jobs.length) * 100 : 0}
          hint="Günlük ilerleme"
        />
        <StatCard
          label="Bekleyen"
          value={loading ? "—" : String(jobs.filter((j) => j.status === "PENDING" || j.status === "SCHEDULED").length)}
          icon={Clock}
          accent="gold"
          mono
        />
      </div>

      {/* [Durum dağılımı şeridi] */}
      <StatusStrip loading={loading} totalLabel={`${jobs.length} iş`} segments={toStatusSegments(jobs)} />
      {advanceSent && (
        <p className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm text-primary-700">
          Avans talebiniz gönderildi, onay bekliyor.
        </p>
      )}

      {loading ? (
        <p className="py-8 text-center text-sm text-text-faint">Yükleniyor...</p>
      ) : jobs.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface-card shadow-card">
          <EmptyState icon={CalendarCheck} title="Bugün için işin yok" description="Yeni bir iş atandığında burada görünecek." />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {jobs.map((job) => {
            const isDone = job.status === "COMPLETED" || job.status === "CANCELLED";
            return (
              <div
                key={job.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border border-l-4 bg-surface-card p-5 shadow-card transition hover:shadow-cardHover"
                style={{ borderLeftColor: STATUS_COLORS[job.status] }}
              >
                <div>
                  <p className="text-lg font-semibold text-text-primary">{job.serviceType}</p>
                  <p className="mt-1 text-sm text-text-secondary">{formatDateTime(job.scheduledAt)}</p>
                  <div className="mt-2">
                    <StatusBadge status={job.status} />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {job.calendarLink && (
                    <a
                      href={job.calendarLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-2xl border border-border bg-surface-base px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:border-border-strong hover:bg-surface-subtle"
                    >
                      <Calendar size={15} strokeWidth={1.75} />
                      Takvime Ekle
                    </a>
                  )}
                  <button
                    type="button"
                    disabled={isDone}
                    onClick={() => setReportJobId(job.id)}
                    className="flex items-center gap-2 rounded-2xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-card transition hover:bg-primary-700 disabled:opacity-40"
                  >
                    <CheckCircle2 size={18} strokeWidth={1.75} />
                    {isDone ? "Tamamlandı" : "Tamamla"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <JobReportModal
        open={!!reportJobId}
        onClose={() => setReportJobId(null)}
        onCompleted={load}
        jobId={reportJobId}
      />

      <AdvanceRequestModal
        open={advanceModalOpen}
        onClose={() => setAdvanceModalOpen(false)}
        onSent={() => setAdvanceSent(true)}
      />
    </div>
  );
}

function CustomerDashboard() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [reports, setReports] = useState<Record<string, JobReport | "loading" | "none">>({});
  const [photos, setPhotos] = useState<Record<string, JobPhoto[]>>({});
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  async function toggleReport(jobId: string) {
    if (expandedJobId === jobId) {
      setExpandedJobId(null);
      return;
    }
    setExpandedJobId(jobId);
    if (reports[jobId]) return;

    setReports((prev) => ({ ...prev, [jobId]: "loading" }));
    try {
      const report = await api.get<JobReport>(`/jobs/${jobId}/report`);
      setReports((prev) => ({ ...prev, [jobId]: report }));
    } catch {
      setReports((prev) => ({ ...prev, [jobId]: "none" }));
    }

    try {
      const res = await api.get<{ data: JobPhoto[] }>(`/jobs/${jobId}/photos`);
      setPhotos((prev) => ({ ...prev, [jobId]: res.data }));
    } catch {
      setPhotos((prev) => ({ ...prev, [jobId]: [] }));
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: Job[] }>("/jobs?limit=50");
      const sorted = [...res.data].sort((a, b) => {
        const dateA = a.scheduledAt ?? a.createdAt;
        const dateB = b.scheduledAt ?? b.createdAt;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });
      setJobs(sorted);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "İşler yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRate(jobId: string, rating: number) {
    try {
      await api.patch(`/jobs/${jobId}/rate`, { rating });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Puanlanamadı");
    }
  }

  const lastJob = jobs[0] ?? null;
  const pastJobs = jobs.slice(1);

  const averageRating = useMemo(() => {
    const rated = jobs.filter((j) => j.rating);
    if (rated.length === 0) return null;
    return rated.reduce((sum, j) => sum + (j.rating ?? 0), 0) / rated.length;
  }, [jobs]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Bug}
        title={`Merhaba${user ? `, ${user.fullName.split(" ")[0]}` : ""}`}
        description="Hizmetlerinizi buradan takip edebilirsiniz."
        actions={
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 rounded-2xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition hover:bg-primary-700"
          >
            <Plus size={16} strokeWidth={2} />
            Yeni Randevu İste
          </button>
        }
      />

      {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

      {/* [Özet kartlar] */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Toplam hizmet" value={loading ? "—" : String(jobs.length)} icon={Bug} mono />
        <StatCard
          label="Tamamlanan"
          value={loading ? "—" : String(jobs.filter((j) => j.status === "COMPLETED").length)}
          icon={CheckCircle2}
          mono
          progress={jobs.length > 0 ? (jobs.filter((j) => j.status === "COMPLETED").length / jobs.length) * 100 : 0}
        />
        <StatCard
          label="Verdiğiniz ortalama puan"
          value={loading || averageRating === null ? "—" : averageRating.toFixed(1)}
          icon={History}
          accent="gold"
          hint="5 üzerinden"
          progress={averageRating ? (averageRating / 5) * 100 : 0}
        />
      </div>

      {/* [Durum dağılımı şeridi] */}
      <StatusStrip loading={loading} totalLabel={`${jobs.length} hizmet`} segments={toStatusSegments(jobs)} />
      {sent && (
        <p className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm text-primary-700">
          Talebiniz alındı, en kısa sürede sizinle iletişime geçeceğiz.
        </p>
      )}

      <div className="rounded-2xl border border-border bg-surface-card p-6 shadow-card">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 ring-1 ring-primary-100">
            <Bug size={17} strokeWidth={1.75} />
          </span>
          <h2 className="text-base font-semibold text-text-primary">Son Uygulamanız</h2>
        </div>

        {loading ? (
          <p className="py-6 text-center text-sm text-text-faint">Yükleniyor...</p>
        ) : lastJob ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xl font-semibold text-text-primary">{lastJob.serviceType}</p>
              <p className="mt-1 text-sm text-text-secondary">{formatDateTime(lastJob.scheduledAt)}</p>
            </div>
            <StatusBadge status={lastJob.status} />
          </div>
        ) : (
          <EmptyState icon={Bug} title="Henüz bir uygulama yapılmadı" description="Randevu talep ettiğinizde burada görünecek." />
        )}
      </div>

      <div className="rounded-2xl border border-border bg-surface-card p-6 shadow-card">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 ring-1 ring-primary-100">
            <History size={17} strokeWidth={1.75} />
          </span>
          <h2 className="text-base font-semibold text-text-primary">Geçmiş İşlemler</h2>
        </div>

        {pastJobs.length === 0 ? (
          <p className="py-6 text-center text-sm text-text-faint">Henüz geçmiş işlem yok.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {pastJobs.map((job) => {
              const isCompleted = job.status === "COMPLETED";
              const report = reports[job.id];
              const isExpanded = expandedJobId === job.id;
              return (
                <li key={job.id} className="py-4">
                  <div
                    onClick={isCompleted ? () => toggleReport(job.id) : undefined}
                    className={`flex items-center justify-between gap-4 ${isCompleted ? "cursor-pointer" : ""}`}
                  >
                    <div>
                      <p className="text-sm font-medium text-text-primary">{job.serviceType}</p>
                      <p className="mt-0.5 text-xs text-text-secondary">{formatDateTime(job.scheduledAt)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={job.status} />
                      {isCompleted && (
                        <ChevronDown
                          size={16}
                          strokeWidth={1.75}
                          className={`text-text-faint transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        />
                      )}
                    </div>
                  </div>

                  {isCompleted && (
                    <div className="mt-2 flex items-center gap-2">
                      {job.rating ? (
                        <p className="text-xs text-text-faint">Puanınız: {"★".repeat(job.rating)}</p>
                      ) : (
                        <>
                          <span className="text-xs text-text-faint">Bu hizmeti puanlayın:</span>
                          <StarRating onRate={(rating) => handleRate(job.id, rating)} />
                        </>
                      )}
                    </div>
                  )}

                  {isExpanded && (
                    <div className="mt-3 rounded-2xl bg-surface-subtle p-4">
                      {report === "loading" ? (
                        <p className="text-sm text-text-faint">Yükleniyor...</p>
                      ) : report === "none" || !report ? (
                        <p className="text-sm text-text-faint">Bu iş için rapor bulunamadı.</p>
                      ) : (
                        <div className="flex flex-col gap-2 text-sm">
                          <div className="flex items-center gap-2 text-text-secondary">
                            <Beaker size={15} strokeWidth={1.75} className="text-text-faint" />
                            {report.productsUsed && <span className="font-medium">{report.productsUsed}</span>}
                            <span className="text-text-faint">· {report.dosage}</span>
                          </div>
                          {report.notes && <p className="text-text-secondary">{report.notes}</p>}
                          {report.signatureUrl && (
                            <div className="mt-2">
                              <p className="mb-1 text-xs text-text-faint">Müşteri İmzası</p>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={resolveUploadUrl(report.signatureUrl)}
                                alt="İmza"
                                className="h-16 rounded-lg bg-surface-base/90 object-contain px-2"
                              />
                            </div>
                          )}
                          {photos[job.id] && photos[job.id].length > 0 && (
                            <div className="mt-2 flex gap-2">
                              {photos[job.id].slice(0, 2).map((photo) => (
                                <button
                                  key={photo.id}
                                  type="button"
                                  onClick={() => setLightboxSrc(resolveUploadUrl(photo.url))}
                                  className="overflow-hidden rounded-xl border border-border transition hover:opacity-80"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={resolveUploadUrl(photo.url)}
                                    alt={photo.type === "BEFORE" ? "Öncesi" : "Sonrası"}
                                    className="h-16 w-16 object-cover"
                                  />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <QuoteRequestModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSent={() => setSent(true)}
        user={user}
      />

      <PhotoLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </div>
  );
}

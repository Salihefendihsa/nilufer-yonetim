"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  KeyRound,
  Pencil,
  Plus,
  ScrollText,
  Shield,
  Trash2,
  UserCog,
  Users2,
  type LucideIcon,
} from "lucide-react";
import { RequireRole } from "@/components/RequireRole";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { ChartCard, DonutChart, RankBars } from "@/components/ChartCard";
import { Timeline, type TimelineItem, type TimelineTone } from "@/components/Timeline";
import { api, ApiError } from "@/lib/api";
import type { AuditLogEntry } from "@/lib/types";

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("tr-TR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/**
 * İşlem adından ikon ve renk tonu türetir. Backend serbest metin `action`
 * kullandığı için tam eşleşme yerine anahtar kelime araması yapılır.
 */
function actionAppearance(action: string): { icon: LucideIcon; tone: TimelineTone } {
  const a = action.toUpperCase();
  if (a.includes("DELETE") || a.includes("SIL")) return { icon: Trash2, tone: "danger" };
  if (a.includes("CREATE") || a.includes("EKLE")) return { icon: Plus, tone: "primary" };
  if (a.includes("UPDATE") || a.includes("GUNCELLE") || a.includes("EDIT")) return { icon: Pencil, tone: "info" };
  if (a.includes("PERMISSION") || a.includes("YETKI") || a.includes("ROLE")) return { icon: Shield, tone: "warning" };
  if (a.includes("LOGIN") || a.includes("PASSWORD") || a.includes("SIFRE")) return { icon: KeyRound, tone: "warning" };
  return { icon: UserCog, tone: "neutral" };
}

export default function AuditLogsPage() {
  return (
    <RequireRole roles={["OWNER"]}>
      <AuditLogsContent />
    </RequireRole>
  );
}

function AuditLogsContent() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [userSearch, setUserSearch] = useState("");

  useEffect(() => {
    api
      .get<{ data: AuditLogEntry[] }>("/audit-logs")
      .then((res) => setLogs(res.data))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Loglar yüklenemedi"))
      .finally(() => setLoading(false));
  }, []);

  const actions = useMemo(() => Array.from(new Set(logs.map((l) => l.action))).sort(), [logs]);

  const filtered = useMemo(() => {
    return logs.filter((log) => {
      const time = new Date(log.createdAt).getTime();
      if (startDate && time < new Date(startDate).getTime()) return false;
      if (endDate && time > new Date(endDate).getTime() + 24 * 60 * 60 * 1000) return false;
      if (actionFilter !== "ALL" && log.action !== actionFilter) return false;
      if (userSearch.trim()) {
        const q = userSearch.toLowerCase();
        const matches =
          log.actor.fullName.toLowerCase().includes(q) ||
          log.actor.email.toLowerCase().includes(q) ||
          log.target.fullName.toLowerCase().includes(q) ||
          log.target.email.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [logs, startDate, endDate, actionFilter, userSearch]);

  // Özet kartlar filtreden bağımsız, tüm log kümesini yansıtır.
  const stats = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    return {
      total: logs.length,
      today: logs.filter((l) => new Date(l.createdAt) >= startOfToday).length,
      week: logs.filter((l) => new Date(l.createdAt).getTime() >= weekAgo).length,
      actors: new Set(logs.map((l) => l.actorUserId)).size,
    };
  }, [logs]);

  /** En çok işlem yapan kullanıcılar — filtrelenmiş kümeden. */
  const actorRows = useMemo(() => {
    const counts = new Map<string, number>();
    for (const log of filtered) counts.set(log.actor.fullName, (counts.get(log.actor.fullName) ?? 0) + 1);
    return Array.from(counts.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [filtered]);

  const actionSlices = useMemo(() => {
    const counts = new Map<string, number>();
    for (const log of filtered) counts.set(log.action, (counts.get(log.action) ?? 0) + 1);
    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [filtered]);

  const timelineItems: TimelineItem[] = useMemo(
    () =>
      filtered.map((log) => {
        const { icon, tone } = actionAppearance(log.action);
        return {
          id: log.id,
          icon,
          tone,
          tag: log.action,
          title: log.actor.fullName,
          description: (
            <>
              <span className="font-medium text-text-primary">{log.target.fullName}</span>
              {log.detail ? ` · ${log.detail}` : ""}
              {log.targetType ? ` · ${log.targetType}` : ""}
            </>
          ),
          timestamp: formatDateTime(log.createdAt),
        };
      }),
    [filtered]
  );

  const hasFilters = !!(startDate || endDate || userSearch.trim() || actionFilter !== "ALL");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={ScrollText}
        title="Denetim Logları"
        description="Kritik işlemlerin kaydı — kim, ne zaman, kime ne yaptı."
      />

      {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

      {/* [Özet kartlar] */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Toplam kayıt" value={loading ? "—" : String(stats.total)} icon={ScrollText} accent="neutral" mono />
        <StatCard label="Bugünkü işlem" value={loading ? "—" : String(stats.today)} icon={CalendarClock} mono />
        <StatCard
          label="Son 7 gün"
          value={loading ? "—" : String(stats.week)}
          icon={Shield}
          accent="blue"
          mono
          hint={stats.week > 0 ? `Günde ortalama ${(stats.week / 7).toFixed(1)} işlem` : undefined}
        />
        <StatCard label="İşlem yapan kişi" value={loading ? "—" : String(stats.actors)} icon={Users2} accent="gold" mono />
      </div>

      {/* [Dağılım grafikleri] */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="En Aktif Kullanıcılar" description="Filtrelenmiş kayıtlara göre" icon={Users2} height={220}>
          <RankBars rows={actorRows} emptyLabel={loading ? "Yükleniyor..." : "Kayıt yok"} />
        </ChartCard>

        <ChartCard title="İşlem Türü Dağılımı" description="En sık görülen 6 işlem" icon={Shield} height={220}>
          <DonutChart
            data={actionSlices}
            centerValue={loading ? "—" : String(filtered.length)}
            centerLabel="kayıt"
            emptyLabel={loading ? "Yükleniyor..." : "Kayıt yok"}
          />
        </ChartCard>
      </div>

      {/* [Filtreler] */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-surface-card p-5 shadow-card">
        <div className="flex flex-col">
          <label className="label">Başlangıç</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input" />
        </div>
        <div className="flex flex-col">
          <label className="label">Bitiş</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input" />
        </div>
        <div className="flex flex-col">
          <label className="label">İşlem Türü</label>
          <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="input">
            <option value="ALL">Tümü</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div className="flex min-w-[12rem] flex-1 flex-col">
          <label className="label">Kullanıcı Ara</label>
          <input
            type="text"
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            placeholder="İsim veya e-posta..."
            className="input"
          />
        </div>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setStartDate("");
              setEndDate("");
              setActionFilter("ALL");
              setUserSearch("");
            }}
            className="rounded-2xl border border-border bg-surface-base px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:border-border-strong hover:bg-surface-subtle hover:text-text-primary"
          >
            Filtreleri Temizle
          </button>
        )}
      </div>

      {/* [Zaman çizelgesi] */}
      {loading ? (
        <p className="py-16 text-center text-sm text-text-faint">Yükleniyor...</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface-card shadow-card">
          <EmptyState icon={ScrollText} title="Kayıt yok" description="Bu filtrelerle eşleşen bir log kaydı bulunamadı." />
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-surface-card p-6 shadow-card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 ring-1 ring-primary-100">
                <CalendarClock size={17} strokeWidth={1.75} />
              </span>
              <h2 className="text-base font-semibold text-text-primary">İşlem Geçmişi</h2>
            </div>
            <span className="rounded-full bg-surface-subtle px-2.5 py-1 font-mono text-2xs text-text-faint">
              {filtered.length} kayıt
            </span>
          </div>

          <Timeline items={timelineItems} />
        </div>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { chartPalette } from "@/lib/chartPalette";
import { Activity, AlertTriangle, Database, Mail, Server, ShieldCheck, Signal, Timer } from "lucide-react";
import { RequireRole } from "@/components/RequireRole";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { ChartCard, TrendChart } from "@/components/ChartCard";
import { api, ApiError } from "@/lib/api";
import type { SystemHealth } from "@/lib/types";

/** Canlı izleme örnekleme aralığı ve grafikte tutulan örnek sayısı. */
const POLL_MS = 10000;
const MAX_SAMPLES = 20;
/** Sunucu serisinden grafikte gösterilen son dakika sayısı. */
const VISIBLE_MINUTES = 30;

interface Sample {
  label: string;
  requests: number;
  errors: number;
}

function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) return `${hours}s ${minutes}dk`;
  if (minutes > 0) return `${minutes}dk ${secs}sn`;
  return `${secs}sn`;
}

type HealthState = "ok" | "warn" | "down";

const STATE_STYLES: Record<HealthState, { dot: string; text: string; icon: string; label: string; ring: string }> = {
  ok: {
    dot: "bg-success-500",
    text: "text-success-600",
    icon: "bg-success-50 text-success-500 ring-success-100",
    label: "Çalışıyor",
    ring: "ring-success-100",
  },
  warn: {
    dot: "bg-warning-500",
    text: "text-warning-600",
    icon: "bg-warning-50 text-warning-500 ring-warning-100",
    label: "Kısıtlı",
    ring: "ring-warning-100",
  },
  down: {
    dot: "bg-danger-500",
    text: "text-danger-500",
    icon: "bg-danger-50 text-danger-500 ring-danger-100",
    label: "Sorunlu",
    ring: "ring-danger-100",
  },
};

/**
 * Canlı durum kartı: pulse animasyonlu nokta, StatCard'ın "critical" rozet
 * deseniyle aynı görsel dili kullanır.
 */
function HealthPill({
  label,
  state,
  icon: Icon,
  hint,
}: {
  label: string;
  state: HealthState;
  icon: typeof Database;
  hint?: string;
}) {
  const style = STATE_STYLES[state];

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface-card p-5 shadow-card">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 ${style.icon}`}>
        <Icon size={19} strokeWidth={1.75} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-text-primary">{label}</p>
        <div className="mt-1 flex items-center gap-1.5 text-xs">
          <span className="relative flex h-2 w-2">
            {state !== "ok" && (
              <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${style.dot}`} />
            )}
            <span className={`relative inline-flex h-2 w-2 rounded-full ${style.dot}`} />
          </span>
          <span className={`font-medium ${style.text}`}>{style.label}</span>
        </div>
        {hint && <p className="mt-0.5 truncate text-xs text-text-faint">{hint}</p>}
      </div>
    </div>
  );
}

export default function SystemHealthPage() {
  return (
    <RequireRole roles={["OWNER"]}>
      <SystemHealthContent />
    </RequireRole>
  );
}

function SystemHealthContent() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Grafik "aralıktaki artış"ı gösterir; bunun için bir önceki okuma saklanır.
  const previousRef = useRef<{ requests: number; errors: number } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get<SystemHealth>("/system/health");
      setHealth(res);
      setError(null);

      const previous = previousRef.current;
      previousRef.current = { requests: res.totalRequestsToday, errors: res.errorCount24h };

      // Backend dakika bazlı gerçek trafiği biriktirir: sayfa açılır açılmaz
      // son dakikalar görünür (önceden yalnızca sayfa açıkken alınan iki
      // okumanın farkıydı — ilk 10-20 sn "İlk örnekler toplanıyor" kalıyordu).
      if (res.trafficPerMinute) {
        setSamples(
          res.trafficPerMinute.slice(-VISIBLE_MINUTES).map((b) => ({
            label: new Date(b.minute).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
            requests: b.requests,
            errors: b.errors,
          }))
        );
      } else if (previous) {
        const label = new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
        setSamples((prev) =>
          [
            ...prev,
            {
              label,
              // Sayaç sıfırlanırsa (gün dönümü, yeniden başlatma) negatif değer üretmeyelim.
              requests: Math.max(0, res.totalRequestsToday - previous.requests),
              errors: Math.max(0, res.errorCount24h - previous.errors),
            },
          ].slice(-MAX_SAMPLES)
        );
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sistem durumu yüklenemedi");
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, [load]);

  const apiState: HealthState = health ? (health.api === "healthy" ? "ok" : "down") : "warn";
  const dbState: HealthState = health ? (health.database === "healthy" ? "ok" : "down") : "warn";
  const emailState: HealthState = health ? (health.emailConfigured ? "ok" : "warn") : "warn";
  const errorCount = health?.errorCount24h ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Activity}
        title="Sistem Durumu"
        description="Altyapının anlık sağlık durumu ve temel metrikler."
        actions={
          <span className="flex items-center gap-2 rounded-2xl border border-border bg-surface-card px-3.5 py-2 text-xs font-medium text-text-secondary shadow-card">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-500 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary-500" />
            </span>
            Canlı · {POLL_MS / 1000} sn&apos;de bir
          </span>
        }
      />

      {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

      {/* Bölüm R (4. tur): ilk ölçüm gelene kadar "uyarı" değil "yükleniyor" gösterilir. */}
      {!health && !error && <p className="py-2 text-center text-sm text-text-faint">İlk ölçüm alınıyor...</p>}

      {/* [Servis durum göstergeleri] */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <HealthPill label="API" state={apiState} icon={Server} hint="Uygulama sunucusu" />
        <HealthPill label="Veritabanı" state={dbState} icon={Database} hint="PostgreSQL bağlantısı" />
        <HealthPill
          label="E-posta"
          state={emailState}
          icon={Mail}
          hint={health?.emailConfigured ? "SMTP yapılandırıldı" : "SMTP yapılandırılmadı"}
        />
        <HealthPill label="Yedekleme" state="ok" icon={ShieldCheck} hint="Manuel dışa aktarma açık" />
      </div>

      {/* [Özet kartlar] */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Çalışma süresi"
          value={health ? formatUptime(health.uptimeSeconds) : "—"}
          icon={Timer}
          mono
          hint="Son yeniden başlatmadan bu yana"
        />
        <StatCard
          label="Bugünkü toplam istek"
          value={health ? String(health.totalRequestsToday) : "—"}
          icon={Signal}
          accent="blue"
          mono
        />
        <StatCard
          label="Son 24 saatte hata"
          value={health ? String(errorCount) : "—"}
          icon={AlertTriangle}
          accent={errorCount > 0 ? "red" : "green"}
          mono
          badge={errorCount > 0 ? { label: "Kritik", tone: "critical" } : { label: "Temiz", tone: "live" }}
        />
      </div>

      {/* [Canlı metrik grafiği] */}
      <ChartCard
        title="Canlı Trafik"
        description={`Son ${VISIBLE_MINUTES} dakika, dakika başına istek/hata (${POLL_MS / 1000} sn aralıkla yenilenir)`}
        icon={Activity}
        height={240}
      >
        <TrendChart
          data={samples}
          xKey="label"
          series={[
            { key: "requests", name: "İstek", color: chartPalette.primaryMid },
            { key: "errors", name: "Hata", color: chartPalette.danger },
          ]}
          area
          emptyLabel="İlk örnekler toplanıyor..."
        />
      </ChartCard>
    </div>
  );
}

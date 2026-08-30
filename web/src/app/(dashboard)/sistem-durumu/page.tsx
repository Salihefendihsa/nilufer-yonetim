"use client";

import { useEffect, useState } from "react";
import { Activity, Database, Server, ShieldCheck } from "lucide-react";
import { RequireRole } from "@/components/RequireRole";
import { api, ApiError } from "@/lib/api";
import type { SystemHealth } from "@/lib/types";

function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) return `${hours}s ${minutes}dk`;
  if (minutes > 0) return `${minutes}dk ${secs}sn`;
  return `${secs}sn`;
}

function HealthPill({ label, healthy, icon: Icon }: { label: string; healthy: boolean; icon: typeof Database }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-surface-card p-5 shadow-[0_8px_24px_rgba(0,0,0,0.22)]">
      <span className={`flex h-10 w-10 items-center justify-center rounded-full ${healthy ? "bg-primary-greenLight/15 text-primary-greenLight" : "bg-primary-redLight/15 text-primary-redLight"}`}>
        <Icon size={18} strokeWidth={1.75} />
      </span>
      <div>
        <p className="text-sm font-medium text-text-primary">{label}</p>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs">
          <span className={`h-1.5 w-1.5 rounded-full ${healthy ? "bg-primary-greenLight" : "bg-primary-redLight"}`} />
          <span className={healthy ? "text-primary-greenLight" : "text-primary-redLight"}>{healthy ? "Çalışıyor" : "Sorunlu"}</span>
        </div>
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<SystemHealth>("/system/health")
      .then(setHealth)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Sistem durumu yüklenemedi"));
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-text-primary">Sistem Durumu</h1>
        <p className="mt-1 text-sm text-text-secondary">Altyapının anlık sağlık durumu ve temel metrikler.</p>
      </div>

      {error && <p className="rounded-2xl bg-primary-redLight/10 px-4 py-3 text-sm text-primary-redLight">{error}</p>}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <HealthPill label="API" healthy={health?.api === "healthy"} icon={Server} />
        <HealthPill label="Veritabanı" healthy={health?.database === "healthy"} icon={Database} />
        <HealthPill label="Yedekleme" healthy icon={ShieldCheck} />
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div className="rounded-2xl bg-surface-card p-6 shadow-[0_8px_24px_rgba(0,0,0,0.22)]">
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-gold/15 text-primary-gold">
            <Activity size={18} strokeWidth={1.75} />
          </div>
          <p className="font-mono text-4xl font-bold tracking-tight text-text-primary">
            {health ? formatUptime(health.uptimeSeconds) : "—"}
          </p>
          <p className="mt-1 text-sm text-text-secondary">Çalışma süresi</p>
        </div>

        <div className="rounded-2xl bg-surface-card p-6 shadow-[0_8px_24px_rgba(0,0,0,0.22)]">
          <p className="font-mono text-4xl font-bold tracking-tight text-text-primary">{health?.totalRequestsToday ?? "—"}</p>
          <p className="mt-1 text-sm text-text-secondary">Bugünkü toplam istek</p>
        </div>

        <div className="rounded-2xl bg-surface-card p-6 shadow-[0_8px_24px_rgba(0,0,0,0.22)]">
          <p className={`font-mono text-4xl font-bold tracking-tight ${(health?.errorCount24h ?? 0) > 0 ? "text-primary-redLight" : "text-text-primary"}`}>
            {health?.errorCount24h ?? "—"}
          </p>
          <p className="mt-1 text-sm text-text-secondary">Son 24 saatte hata</p>
        </div>
      </div>
    </div>
  );
}

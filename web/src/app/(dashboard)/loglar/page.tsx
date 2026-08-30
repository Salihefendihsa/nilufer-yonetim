"use client";

import { useEffect, useMemo, useState } from "react";
import { ScrollText } from "lucide-react";
import { RequireRole } from "@/components/RequireRole";
import { EmptyState } from "@/components/EmptyState";
import { api, ApiError } from "@/lib/api";
import type { AuditLogEntry } from "@/lib/types";

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("tr-TR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
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

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-text-primary">Denetim Logları</h1>
        <p className="mt-1 text-sm text-text-secondary">Kritik işlemlerin kaydı — kim, ne zaman, kime ne yaptı.</p>
      </div>

      {error && <p className="rounded-2xl bg-primary-redLight/10 px-4 py-3 text-sm text-primary-redLight">{error}</p>}

      <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-surface-card p-5 shadow-[0_8px_24px_rgba(0,0,0,0.22)]">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-text-secondary">Başlangıç</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-text-secondary">Bitiş</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-text-secondary">İşlem Türü</label>
          <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="input">
            <option value="ALL">Tümü</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <label className="text-xs font-medium text-text-secondary">Kullanıcı Ara</label>
          <input
            type="text"
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            placeholder="İsim veya e-posta..."
            className="input"
          />
        </div>
      </div>

      {loading ? (
        <p className="py-16 text-center text-sm text-text-faint">Yükleniyor...</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl bg-surface-card">
          <EmptyState icon={ScrollText} title="Kayıt yok" description="Bu filtrelerle eşleşen bir log kaydı bulunamadı." />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-surface-card shadow-[0_8px_24px_rgba(0,0,0,0.22)]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs font-semibold uppercase tracking-wide text-text-faint">
                  <th className="px-6 py-4">Zaman</th>
                  <th className="px-6 py-4">Kim</th>
                  <th className="px-6 py-4">İşlem</th>
                  <th className="px-6 py-4">Hedef</th>
                  <th className="px-6 py-4">Detay</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((log) => (
                  <tr key={log.id} className="border-b border-white/5 last:border-0">
                    <td className="px-6 py-4 font-mono text-xs text-text-faint">{formatDateTime(log.createdAt)}</td>
                    <td className="px-6 py-4 text-text-primary">{log.actor.fullName}</td>
                    <td className="px-6 py-4">
                      <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs font-medium text-text-secondary">{log.action}</span>
                    </td>
                    <td className="px-6 py-4 text-text-primary">{log.target.fullName}</td>
                    <td className="px-6 py-4 text-text-secondary">{log.detail ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

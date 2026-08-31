"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, CheckCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { api, ApiError } from "@/lib/api";
import type { AppNotification, Paginated } from "@/lib/types";

type StatusFilter = "all" | "unread" | "read";

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Tümü" },
  { key: "unread", label: "Okunmadı" },
  { key: "read", label: "Okundu" },
];

function formatTime(value: string): string {
  return new Date(value).toLocaleString("tr-TR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const statusQuery = status === "all" ? "" : `&status=${status}`;
      const res = await api.get<Paginated<AppNotification>>(`/notifications?page=${page}&limit=20${statusQuery}`);
      setNotifications(res.data);
      setTotalPages(res.pagination.totalPages);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Bildirimler yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [status]);

  async function handleMarkOneRead(id: string) {
    if (notifications.find((n) => n.id === id)?.readAt) return;
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
    } catch {
      // best-effort
    }
  }

  async function handleMarkAllRead() {
    try {
      await api.patch("/notifications/read-all");
      load();
    } catch {
      // best-effort
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-text-primary">Bildirimler</h1>
          <p className="mt-1 text-sm text-text-secondary">Tüm bildirim geçmişiniz burada.</p>
        </div>
        <button
          type="button"
          onClick={handleMarkAllRead}
          className="flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:bg-white/5"
        >
          <CheckCheck size={16} strokeWidth={1.75} />
          Tümünü Okundu İşaretle
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setStatus(tab.key)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              status === tab.key ? "bg-primary-green text-white" : "bg-surface-card text-text-secondary hover:bg-white/5"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && <p className="rounded-2xl bg-primary-red/10 px-4 py-3 text-sm text-primary-redLight">{error}</p>}

      <div className="rounded-2xl bg-surface-card shadow-[0_8px_24px_rgba(0,0,0,0.22)]">
        {loading ? (
          <p className="py-16 text-center text-sm text-text-faint">Yükleniyor...</p>
        ) : notifications.length === 0 ? (
          <EmptyState icon={Bell} title="Bildirim yok" description="Bu filtreye uyan bildirim bulunamadı." />
        ) : (
          <ul className="flex flex-col divide-y divide-white/5">
            {notifications.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => handleMarkOneRead(n.id)}
                  className="flex w-full items-start gap-3 px-6 py-4 text-left transition hover:bg-white/[0.03]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-text-primary">{n.title}</span>
                      {!n.readAt && <span className="h-2 w-2 shrink-0 rounded-full bg-primary-gold" />}
                    </span>
                    {n.body && <span className="mt-0.5 block text-sm text-text-secondary">{n.body}</span>}
                    <span className="mt-1 block font-mono text-xs text-text-faint">{formatTime(n.createdAt)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="flex h-9 w-9 items-center justify-center rounded-2xl text-text-secondary transition hover:bg-white/5 disabled:opacity-30"
          >
            <ChevronLeft size={16} strokeWidth={1.75} />
          </button>
          <span className="text-sm text-text-secondary">
            Sayfa {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="flex h-9 w-9 items-center justify-center rounded-2xl text-text-secondary transition hover:bg-white/5 disabled:opacity-30"
          >
            <ChevronRight size={16} strokeWidth={1.75} />
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LoadingBlock } from "@/components/LoadingBlock";
import { useRouter } from "next/navigation";
import { Bell, BellRing, CheckCheck, ChevronLeft, ChevronRight, Inbox, Layers } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { StatusStrip } from "@/components/StatusStrip";
import { ChartCard, DonutChart } from "@/components/ChartCard";
import { api, ApiError } from "@/lib/api";
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CATEGORY_KEYS,
  CATEGORY_API_KEY,
  categorizeNotification,
  getNotificationHref,
  type NotificationCategory,
} from "@/lib/notifications";
import type { AppNotification, NotificationSummary, Paginated } from "@/lib/types";

type StatusFilter = "all" | "unread" | "read";

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Tümü" },
  { key: "unread", label: "Okunmadı" },
  { key: "read", label: "Okundu" },
];

/** Özet kart ve dağılım grafiği için çekilen kayıt sayısı (sayfalamadan bağımsız). */
const SUMMARY_LIMIT = 200;

function formatTime(value: string): string {
  return new Date(value).toLocaleString("tr-TR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [summaryItems, setSummaryItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [category, setCategory] = useState<NotificationCategory | "all">("all");
  const [summary, setSummary] = useState<NotificationSummary | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const statusQuery = status === "all" ? "" : `&status=${status}`;
      const categoryQuery = category === "all" ? "" : `&category=${CATEGORY_API_KEY[category]}`;
      // İkinci çağrı filtreden bağımsız özet için: kartlar ve dağılım grafiği
      // her zaman tüm bildirimleri yansıtsın, seçili sekmeye göre değişmesin.
      const [res, summaryRes, countsRes] = await Promise.all([
        api.get<Paginated<AppNotification>>(`/notifications?page=${page}&limit=20${statusQuery}${categoryQuery}`),
        api.get<Paginated<AppNotification>>(`/notifications?limit=${SUMMARY_LIMIT}`),
        api.get<NotificationSummary>("/notifications/summary"),
      ]);
      setNotifications(res.data);
      setTotalPages(res.pagination.totalPages);
      setSummaryItems(summaryRes.data);
      setSummary(countsRes);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Bildirimler yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [status, page, category]);

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
      const now = new Date().toISOString();
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: now } : n)));
      setSummaryItems((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: now } : n)));
    } catch {
      // best-effort
    }
  }

  function handleNotificationClick(n: AppNotification) {
    handleMarkOneRead(n.id);
    const href = getNotificationHref(n);
    if (href) router.push(href);
  }

  async function handleMarkAllRead() {
    try {
      await api.patch("/notifications/read-all");
      load();
    } catch {
      // best-effort
    }
  }

  // Kartlar, şerit ve donut aynı özet listesinden hesaplanır.
  // Sayımlar sunucudan gelir (GET /notifications/summary) — 200 kayıt çekip
  // istemcide saymaya gerek yok; özet listesi yalnızca yedek olarak durur.
  const stats = useMemo(() => {
    if (summary) {
      return {
        total: summary.total,
        unread: summary.unread,
        read: summary.total - summary.unread,
        todayCount: summary.today,
      };
    }
    const unread = summaryItems.filter((n) => !n.readAt).length;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayCount = summaryItems.filter((n) => new Date(n.createdAt) >= startOfToday).length;
    return { total: summaryItems.length, unread, read: summaryItems.length - unread, todayCount };
  }, [summary, summaryItems]);

  const categorySegments = useMemo(
    () =>
      NOTIFICATION_CATEGORY_KEYS.map((key) => ({
        label: NOTIFICATION_CATEGORIES[key].label,
        count:
          summary?.byCategory[CATEGORY_API_KEY[key]] ??
          summaryItems.filter((n) => categorizeNotification(n.title) === key).length,
        color: NOTIFICATION_CATEGORIES[key].color,
      })),
    [summary, summaryItems]
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Bell}
        title="Bildirimler"
        description="Tüm bildirim geçmişiniz burada."
        actions={
          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={stats.unread === 0}
            className="flex items-center gap-2 rounded-2xl border border-border bg-surface-base px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:border-border-strong hover:bg-surface-subtle hover:text-text-primary disabled:opacity-50"
          >
            <CheckCheck size={16} strokeWidth={1.75} />
            Tümünü Okundu İşaretle
          </button>
        }
      />

      {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

      {/* [Özet kartlar] */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Toplam bildirim" value={loading ? "—" : String(stats.total)} icon={Layers} accent="neutral" mono />
        <StatCard
          label="Okunmamış"
          value={loading ? "—" : String(stats.unread)}
          icon={BellRing}
          accent="gold"
          mono
          badge={stats.unread > 0 ? { label: "Yeni", tone: "critical" } : undefined}
        />
        <StatCard
          label="Okunmuş"
          value={loading ? "—" : String(stats.read)}
          icon={CheckCheck}
          mono
          progress={stats.total > 0 ? (stats.read / stats.total) * 100 : 0}
          hint={`%${stats.total > 0 ? Math.round((stats.read / stats.total) * 100) : 0} okundu`}
        />
        <StatCard label="Bugün gelen" value={loading ? "—" : String(stats.todayCount)} icon={Inbox} accent="blue" mono />
      </div>

      {/* [Tip dağılımı: şerit + donut] */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          <StatusStrip loading={loading} totalLabel={`${stats.total} bildirim`} segments={categorySegments} />

          <div className="flex flex-wrap gap-1.5">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatus(tab.key)}
                className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
                  status === tab.key
                    ? "border-primary-600 bg-primary-600 text-white shadow-card"
                    : "border-border bg-surface-card text-text-secondary hover:border-border-strong hover:bg-surface-subtle hover:text-text-primary"
                }`}
              >
                {tab.label}
                {tab.key !== "all" && (
                  <span className={`font-mono text-2xs ${status === tab.key ? "text-white/80" : "text-text-faint"}`}>
                    {tab.key === "unread" ? stats.unread : stats.read}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* [Kategori sekmeleri] — sunucu tarafında Notification.type'a göre
              filtrelenir (backend/src/lib/notificationCategories.ts). */}
          <div className="flex flex-wrap gap-1.5">
            {(["all", ...NOTIFICATION_CATEGORY_KEYS] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setCategory(key);
                  setPage(1);
                }}
                className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  category === key
                    ? "bg-primary-600 text-white"
                    : "border border-border bg-surface-base text-text-secondary hover:bg-surface-subtle"
                }`}
              >
                {key === "all" ? "Tümü" : NOTIFICATION_CATEGORIES[key].label}
                {key !== "all" && (
                  <span className={`font-mono text-2xs ${category === key ? "text-white/80" : "text-text-faint"}`}>
                    {summary?.byCategory[CATEGORY_API_KEY[key]] ?? 0}
                  </span>
                )}
              </button>
            ))}
            {/* Sınıflandırılamayan kayıtlar (eski, type alanı boş bildirimler)
                gizlenmez; sayı kaybolmasın diye burada gösterilir. */}
            {(summary?.byCategory.other ?? 0) > 0 && (
              <span className="flex items-center gap-1.5 rounded-full border border-border bg-surface-subtle px-3.5 py-1.5 text-xs font-semibold text-text-faint">
                Diğer
                <span className="font-mono text-2xs">{summary?.byCategory.other}</span>
              </span>
            )}
          </div>
        </div>

        <ChartCard title="Tip Dağılımı" description="Kategoriye göre bildirimler" icon={Layers} height={200}>
          <DonutChart
            data={categorySegments.map((seg) => ({ name: seg.label, value: seg.count, color: seg.color }))}
            centerValue={loading ? "—" : String(stats.total)}
            centerLabel="bildirim"
            loading={loading} emptyLabel="Bildirim yok"
          />
        </ChartCard>
      </div>

      {/* [Detay listesi] */}
      <div className="overflow-hidden rounded-2xl border border-border bg-surface-card shadow-card">
        {loading ? (
          <LoadingBlock rows={4} className="py-6" />
        ) : notifications.length === 0 ? (
          <EmptyState icon={Bell} title="Bildirim yok" description="Bu filtreye uyan bildirim bulunamadı." />
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {notifications.map((n) => {
              const category = NOTIFICATION_CATEGORIES[categorizeNotification(n.title)];
              const Icon = category.icon;
              const unread = !n.readAt;
              const isLinked = getNotificationHref(n) !== null;

              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => handleNotificationClick(n)}
                    title={isLinked ? "İlgili kayda git" : undefined}
                    className={`flex w-full items-start gap-3.5 border-l-4 px-6 py-4 text-left transition hover:bg-primary-50/50 ${
                      unread ? `${category.barClass} bg-surface-base` : "border-l-transparent"
                    } ${isLinked ? "cursor-pointer" : ""}`}
                  >
                    <span
                      className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1 ${category.iconClass}`}
                    >
                      <Icon size={16} strokeWidth={1.75} />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-3">
                        <span className={`text-sm ${unread ? "font-semibold text-text-primary" : "font-medium text-text-secondary"}`}>
                          {n.title}
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <span className="rounded-full bg-surface-subtle px-2 py-0.5 text-2xs font-medium text-text-faint">
                            {category.label}
                          </span>
                          {unread && <span className="h-2 w-2 rounded-full bg-primary-600" />}
                        </span>
                      </span>
                      {n.body && <span className="mt-0.5 block text-sm text-text-secondary">{n.body}</span>}
                      <span className="mt-1 block font-mono text-xs text-text-faint">{formatTime(n.createdAt)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface-base text-text-secondary transition hover:border-border-strong hover:bg-surface-subtle disabled:opacity-40"
          >
            <ChevronLeft size={16} strokeWidth={1.75} />
          </button>
          <span className="font-mono text-xs text-text-faint">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface-base text-text-secondary transition hover:border-border-strong hover:bg-surface-subtle disabled:opacity-40"
          >
            <ChevronRight size={16} strokeWidth={1.75} />
          </button>
        </div>
      )}
    </div>
  );
}

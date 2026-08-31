"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X, Search, CheckCheck, Wrench, Wallet, MessageCircle, AlertTriangle, Bell } from "lucide-react";
import { api } from "@/lib/api";
import type { AppNotification } from "@/lib/types";

interface NotificationDrawerProps {
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}

type Category = "all" | "isler" | "odemeler" | "mesajlar" | "uyarilar";

const CATEGORY_TABS: { key: Category; label: string }[] = [
  { key: "all", label: "Tümü" },
  { key: "isler", label: "İşler" },
  { key: "odemeler", label: "Ödemeler" },
  { key: "mesajlar", label: "Mesajlar" },
  { key: "uyarilar", label: "Uyarılar" },
];

const CATEGORY_ICONS: Record<Exclude<Category, "all">, typeof Wrench> = {
  isler: Wrench,
  odemeler: Wallet,
  mesajlar: MessageCircle,
  uyarilar: AlertTriangle,
};

function categorize(title: string): Exclude<Category, "all"> {
  const t = title.toLowerCase();
  if (t.includes("mesaj")) return "mesajlar";
  if (t.includes("tahsilat") || t.includes("ödeme") || t.includes("avans")) return "odemeler";
  if (t.includes("iş")) return "isler";
  return "uyarilar";
}

function formatTime(value: string): string {
  return new Date(value).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function NotificationDrawer({ open, onClose, onChanged }: NotificationDrawerProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category>("all");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api
      .get<{ data: AppNotification[] }>("/notifications?limit=100")
      .then((res) => setNotifications(res.data))
      .catch(() => setNotifications([]))
      .finally(() => setLoading(false));
  }, [open]);

  const filtered = useMemo(() => {
    return notifications.filter((n) => {
      const matchesCategory = category === "all" || categorize(n.title) === category;
      const matchesSearch =
        !search.trim() ||
        n.title.toLowerCase().includes(search.toLowerCase()) ||
        (n.body ?? "").toLowerCase().includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [notifications, category, search]);

  async function handleMarkAllRead() {
    try {
      await api.patch("/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
      onChanged();
    } catch {
      // best-effort
    }
  }

  async function handleMarkOneRead(id: string) {
    if (notifications.find((n) => n.id === id)?.readAt) return;
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
      onChanged();
    } catch {
      // best-effort
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-white/10 bg-surface-base"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <h2 className="text-lg font-semibold text-text-primary">Bildirimler</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1.5 rounded-2xl bg-white/5 px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-white/10"
                >
                  <CheckCheck size={14} strokeWidth={1.75} />
                  Tümünü Okundu
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Kapat"
                  className="flex h-8 w-8 items-center justify-center rounded-2xl text-text-faint transition hover:bg-white/5 hover:text-text-primary"
                >
                  <X size={18} strokeWidth={1.75} />
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-4">
              <div className="flex items-center gap-2.5 rounded-2xl bg-white/5 px-4 py-2.5 text-sm text-text-secondary">
                <Search size={15} strokeWidth={1.75} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Bildirimlerde ara..."
                  className="w-full bg-transparent text-text-primary outline-none placeholder:text-text-faint"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORY_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setCategory(tab.key)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      category === tab.key ? "bg-primary-green text-white" : "bg-white/5 text-text-secondary hover:bg-white/10"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <p className="py-10 text-center text-sm text-text-faint">Yükleniyor...</p>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-16 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5 text-text-faint">
                    <Bell size={22} strokeWidth={1.5} />
                  </span>
                  <p className="text-sm text-text-secondary">Bildirim yok</p>
                </div>
              ) : (
                <ul className="flex flex-col divide-y divide-white/5">
                  {filtered.map((n) => {
                    const cat = categorize(n.title);
                    const Icon = CATEGORY_ICONS[cat];
                    return (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => handleMarkOneRead(n.id)}
                          className="flex w-full items-start gap-3 px-5 py-4 text-left transition hover:bg-white/[0.03]"
                        >
                          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/5 text-text-secondary">
                            <Icon size={15} strokeWidth={1.75} />
                          </span>
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
                    );
                  })}
                </ul>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Search, Bell, LogOut, ChevronDown, User, Settings } from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import { ROLE_LABELS } from "@/lib/auth";
import { api } from "@/lib/api";
import type { SearchResults } from "@/lib/types";
import { NotificationDrawer } from "./NotificationDrawer";

const EMPTY_RESULTS: SearchResults = { customers: [], staff: [], jobs: [] };

const UNREAD_POLL_MS = 10000;

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Günaydın";
  if (hour < 18) return "İyi günler";
  return "İyi akşamlar";
}

export function Header() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const refreshUnreadCount = () => {
    api
      .get<{ count: number }>("/notifications/unread-count")
      .then((res) => setUnreadCount(res.count))
      .catch(() => {});
  };

  useEffect(() => {
    refreshUnreadCount();
    const interval = setInterval(refreshUnreadCount, UNREAD_POLL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults(EMPTY_RESULTS);
      return;
    }
    const timeout = setTimeout(() => {
      api
        .get<SearchResults>(`/search?q=${encodeURIComponent(q)}`)
        .then((res) => {
          setResults(res);
          setSearchOpen(true);
        })
        .catch(() => setResults(EMPTY_RESULTS));
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const hasResults = results.customers.length > 0 || results.staff.length > 0 || results.jobs.length > 0;

  function goTo(path: string) {
    setSearchOpen(false);
    setQuery("");
    router.push(path);
  }

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-4 bg-surface-base/90 px-8 py-5 backdrop-blur-xl relative">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary-gold/30 to-transparent" />
      <div className="relative w-full max-w-md" ref={searchRef}>
        <div className="flex items-center gap-2.5 rounded-2xl bg-white/[0.04] px-4 py-2.5 text-sm text-text-secondary transition focus-within:ring-2 focus-within:ring-primary-green/30">
          <Search size={16} strokeWidth={1.75} />
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => query.trim() && setSearchOpen(true)}
            placeholder="Ara..."
            className="w-full bg-transparent text-text-primary outline-none placeholder:text-text-faint"
          />
          <kbd className="hidden shrink-0 rounded-lg bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-text-faint sm:block">
            ⌘K
          </kbd>
        </div>

        <AnimatePresence>
          {searchOpen && query.trim() && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="absolute left-0 top-full z-20 mt-2 w-full rounded-2xl border border-white/10 bg-surface-card p-2 shadow-[0_8px_24px_rgba(0,0,0,0.28)]"
            >
              {!hasResults && (
                <p className="px-3 py-4 text-center text-sm text-text-faint">Sonuç bulunamadı</p>
              )}

              {results.customers.length > 0 && (
                <div className="mb-1">
                  <p className="px-3 pb-1 pt-2 text-xs font-semibold text-text-faint">👤 Müşteriler</p>
                  {results.customers.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => goTo("/musteriler")}
                      className="flex w-full flex-col rounded-xl px-3 py-2 text-left transition hover:bg-white/5"
                    >
                      <span className="text-sm text-text-primary">{r.label}</span>
                      <span className="text-xs text-text-faint">{r.sublabel}</span>
                    </button>
                  ))}
                </div>
              )}

              {results.staff.length > 0 && (
                <div className="mb-1">
                  <p className="px-3 pb-1 pt-2 text-xs font-semibold text-text-faint">👷 Personel</p>
                  {results.staff.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => goTo("/personel")}
                      className="flex w-full flex-col rounded-xl px-3 py-2 text-left transition hover:bg-white/5"
                    >
                      <span className="text-sm text-text-primary">{r.label}</span>
                      <span className="text-xs text-text-faint">{r.sublabel}</span>
                    </button>
                  ))}
                </div>
              )}

              {results.jobs.length > 0 && (
                <div>
                  <p className="px-3 pb-1 pt-2 text-xs font-semibold text-text-faint">🔧 İşler</p>
                  {results.jobs.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => goTo("/isler")}
                      className="flex w-full flex-col rounded-xl px-3 py-2 text-left transition hover:bg-white/5"
                    >
                      <span className="text-sm text-text-primary">{r.label}</span>
                      <span className="text-xs text-text-faint">{r.sublabel}</span>
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          aria-label="Bildirimler"
          onClick={() => setDrawerOpen(true)}
          className="relative flex h-10 w-10 items-center justify-center rounded-2xl text-text-secondary transition hover:bg-white/5"
        >
          <Bell size={18} strokeWidth={1.75} />
          {unreadCount > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-redLight px-1 text-[10px] font-semibold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>

        <div className="relative" ref={profileRef}>
          <button
            type="button"
            onClick={() => setProfileOpen((v) => !v)}
            className="flex items-center gap-3 border-l border-white/10 pl-4 transition hover:opacity-80"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-green/10 text-sm font-semibold text-primary-greenLight ring-2 ring-primary-gold/30">
              {user?.fullName?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-sm font-medium text-text-primary">{user?.fullName ?? "Kullanıcı"}</p>
              <p className="text-xs text-text-secondary">{user ? ROLE_LABELS[user.role] : ""}</p>
            </div>
            <ChevronDown size={15} strokeWidth={1.75} className="hidden text-text-faint sm:block" />
          </button>

          <AnimatePresence>
            {profileOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full z-20 mt-2 w-64 rounded-2xl border border-white/10 bg-surface-card p-4 shadow-[0_8px_24px_rgba(0,0,0,0.28)]"
              >
                <div className="flex items-center gap-3 pb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-green/10 text-sm font-semibold text-primary-greenLight ring-2 ring-primary-gold/30">
                    {user?.fullName?.[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary">{user?.fullName}</p>
                    <p className="text-xs text-text-secondary">{user ? ROLE_LABELS[user.role] : ""}</p>
                  </div>
                </div>

                <p className="border-t border-white/10 py-3 text-sm text-text-secondary">
                  {greeting()}{user ? `, ${user.fullName.split(" ")[0]}` : ""} 👋
                </p>

                <div className="flex flex-col gap-1 border-t border-white/10 pt-3">
                  <Link
                    href="/ayarlar"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2.5 rounded-2xl px-3 py-2 text-sm text-text-secondary transition hover:bg-white/5 hover:text-text-primary"
                  >
                    <User size={15} strokeWidth={1.75} />
                    Profil
                  </Link>
                  <Link
                    href="/ayarlar"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2.5 rounded-2xl px-3 py-2 text-sm text-text-secondary transition hover:bg-white/5 hover:text-text-primary"
                  >
                    <Settings size={15} strokeWidth={1.75} />
                    Ayarlar
                  </Link>
                  <button
                    type="button"
                    onClick={logout}
                    className="flex items-center gap-2.5 rounded-2xl px-3 py-2 text-sm font-medium text-primary-redLight transition hover:bg-primary-redLight/10"
                  >
                    <LogOut size={15} strokeWidth={1.75} />
                    Çıkış
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <NotificationDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} onChanged={refreshUnreadCount} />
    </header>
  );
}

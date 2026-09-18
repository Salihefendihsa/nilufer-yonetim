"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Search, Bell, LogOut, ChevronDown, User, Settings, Menu, Users, Wrench, HardHat, FileText, ClipboardList } from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import { ROLE_LABELS } from "@/lib/auth";
import { api } from "@/lib/api";
import type { SearchResult, SearchResultType, SearchResponse } from "@/lib/types";
import { NotificationDrawer } from "./NotificationDrawer";

// Bölüm I (3. tur): global arama — /search beş varlık türünü tek listede
// döndürür; burada türe göre gruplanıp ikon + tür etiketiyle gösterilir.
const SEARCH_MIN_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 300;

const SEARCH_GROUPS: { type: SearchResultType; label: string; Icon: typeof Users }[] = [
  { type: "customer", label: "Müşteriler", Icon: Users },
  { type: "job", label: "İşler", Icon: Wrench },
  { type: "staff", label: "Personel", Icon: HardHat },
  { type: "contract", label: "Sözleşmeler", Icon: FileText },
  { type: "quote", label: "Teklifler", Icon: ClipboardList },
];

const UNREAD_POLL_MS = 10000;

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Günaydın";
  if (hour < 18) return "İyi günler";
  return "İyi akşamlar";
}

interface HeaderProps {
  /** Mobilde (< md) sol üstteki hamburger butonuna basılınca sidebar drawer'ını açar. */
  onOpenMobileNav?: () => void;
}

export function Header({ onOpenMobileNav }: HeaderProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
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
    if (q.length < SEARCH_MIN_LENGTH) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    let cancelled = false;
    const timeout = setTimeout(() => {
      api
        .get<SearchResponse>(`/search?q=${encodeURIComponent(q)}`)
        .then((res) => {
          if (cancelled) return;
          setResults(res.results);
          setSearchOpen(true);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
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

  const hasResults = results.length > 0;
  const showDropdown = searchOpen && query.trim().length >= SEARCH_MIN_LENGTH;

  function goTo(path: string) {
    setSearchOpen(false);
    setQuery("");
    router.push(path);
  }

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-surface-base/85 px-4 py-4 backdrop-blur-xl sm:gap-4 md:px-8">
      <button
        type="button"
        onClick={onOpenMobileNav}
        aria-label="Menüyü aç"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-surface-base text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary md:hidden"
      >
        <Menu size={19} strokeWidth={1.75} />
      </button>

      <div className="relative w-full max-w-md" ref={searchRef}>
        <div className="flex items-center gap-2.5 rounded-2xl border border-border bg-surface-subtle px-4 py-2.5 text-sm text-text-secondary transition focus-within:border-primary-500 focus-within:bg-surface-base focus-within:ring-2 focus-within:ring-primary-500/20">
          <Search size={16} strokeWidth={1.75} />
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => query.trim().length >= SEARCH_MIN_LENGTH && setSearchOpen(true)}
            placeholder="Müşteri, iş, personel, sözleşme, teklif ara..."
            className="w-full bg-transparent text-text-primary outline-none placeholder:text-text-faint"
          />
          <kbd className="hidden shrink-0 rounded-lg border border-border bg-surface-base px-1.5 py-0.5 text-[10px] font-medium text-text-faint sm:block">
            ⌘K
          </kbd>
        </div>

        <AnimatePresence>
          {showDropdown && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="absolute left-0 top-full z-20 mt-2 max-h-[70vh] w-full overflow-y-auto rounded-2xl border border-border bg-surface-card p-2 shadow-pop"
            >
              {!hasResults && (
                <p className="px-3 py-4 text-center text-sm text-text-faint">
                  {searching ? "Aranıyor..." : "Sonuç bulunamadı"}
                </p>
              )}

              {SEARCH_GROUPS.map(({ type, label, Icon }) => {
                const group = results.filter((r) => r.type === type);
                if (group.length === 0) return null;
                return (
                  <div key={type} className="mb-1">
                    <p className="flex items-center gap-1.5 px-3 pb-1 pt-2 text-xs font-semibold text-text-faint">
                      <Icon size={12} strokeWidth={2} />
                      {label}
                    </p>
                    {group.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => goTo(r.route)}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-surface-subtle"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-surface-subtle text-text-secondary">
                          <Icon size={15} strokeWidth={1.75} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-text-primary">{r.title}</span>
                          <span className="block truncate text-xs text-text-faint">{r.subtitle}</span>
                        </span>
                        <span className="shrink-0 rounded-full bg-surface-subtle px-2 py-0.5 text-[10px] font-medium text-text-faint">
                          {label}
                        </span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          aria-label="Bildirimler"
          onClick={() => setDrawerOpen(true)}
          className="relative flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-surface-base text-text-secondary transition hover:border-border-strong hover:bg-surface-subtle hover:text-text-primary"
        >
          <Bell size={18} strokeWidth={1.75} />
          {unreadCount > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-500 px-1 text-[10px] font-semibold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>

        <div className="relative" ref={profileRef}>
          <button
            type="button"
            onClick={() => setProfileOpen((v) => !v)}
            className="flex items-center gap-3 rounded-2xl border border-transparent px-2 py-1.5 transition hover:border-border hover:bg-surface-subtle"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-600 text-sm font-semibold text-white">
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
                className="absolute right-0 top-full z-20 mt-2 w-64 rounded-2xl border border-border bg-surface-card p-4 shadow-pop"
              >
                <div className="flex items-center gap-3 pb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-600 text-sm font-semibold text-white">
                    {user?.fullName?.[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary">{user?.fullName}</p>
                    <p className="text-xs text-text-secondary">{user ? ROLE_LABELS[user.role] : ""}</p>
                  </div>
                </div>

                <p className="border-t border-border py-3 text-sm text-text-secondary">
                  {greeting()}{user ? `, ${user.fullName.split(" ")[0]}` : ""} 👋
                </p>

                <div className="flex flex-col gap-1 border-t border-border pt-3">
                  <Link
                    href="/ayarlar"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2.5 rounded-2xl px-3 py-2 text-sm text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
                  >
                    <User size={15} strokeWidth={1.75} />
                    Profil
                  </Link>
                  <Link
                    href="/ayarlar"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2.5 rounded-2xl px-3 py-2 text-sm text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
                  >
                    <Settings size={15} strokeWidth={1.75} />
                    Ayarlar
                  </Link>
                  <button
                    type="button"
                    onClick={logout}
                    className="flex items-center gap-2.5 rounded-2xl px-3 py-2 text-sm font-medium text-danger-500 transition hover:bg-danger-50"
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

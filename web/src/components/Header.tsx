"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Search, Bell, LogOut, ChevronDown, User, Settings } from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import { ROLE_LABELS } from "@/lib/auth";
import { api } from "@/lib/api";
import { NotificationDrawer } from "./NotificationDrawer";

const UNREAD_POLL_MS = 10000;

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Günaydın";
  if (hour < 18) return "İyi günler";
  return "İyi akşamlar";
}

export function Header() {
  const { user, logout } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

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
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-4 bg-surface-base/90 px-8 py-5 backdrop-blur-xl relative">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary-gold/30 to-transparent" />
      <div className="flex w-full max-w-md items-center gap-2.5 rounded-2xl bg-white/[0.04] px-4 py-2.5 text-sm text-text-secondary transition focus-within:ring-2 focus-within:ring-primary-green/30">
        <Search size={16} strokeWidth={1.75} />
        <input
          type="text"
          placeholder="Ara..."
          className="w-full bg-transparent text-text-primary outline-none placeholder:text-text-faint"
        />
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

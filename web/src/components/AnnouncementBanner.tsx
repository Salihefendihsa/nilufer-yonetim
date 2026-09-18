"use client";

import { useEffect, useState } from "react";
import { Megaphone, X } from "lucide-react";
import { api } from "@/lib/api";
import type { Announcement } from "@/lib/types";

const DISMISS_KEY = "nilufer.dismissedAnnouncementId";

/**
 * Bölüm AK (8. tur): Sistem geneli duyuru şeridi — layout'un en üstünde, tüm roller.
 * Kapatma yalnızca o duyurunun ID'sini localStorage'a yazar; yeni bir duyuru
 * (farklı ID) yayınlandığında şerit yeniden görünür. Hata/yetki → gizli.
 */
export function AnnouncementBanner() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [dismissedId, setDismissedId] = useState<string | null>(null);

  useEffect(() => {
    try {
      setDismissedId(window.localStorage.getItem(DISMISS_KEY));
    } catch {
      setDismissedId(null);
    }
    let cancelled = false;
    api
      .get<{ data: Announcement | null }>("/announcements/active")
      .then((res) => {
        if (!cancelled) setAnnouncement(res.data);
      })
      .catch(() => {
        if (!cancelled) setAnnouncement(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!announcement || announcement.id === dismissedId) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISS_KEY, announcement!.id);
    } catch {
      /* özel mod vb. — yalnızca bu oturum için kapanır */
    }
    setDismissedId(announcement!.id);
  }

  return (
    <div role="status" className="flex items-center gap-3 bg-primary-600 px-4 py-2.5 text-sm font-medium text-white">
      <Megaphone size={16} strokeWidth={2} className="shrink-0" />
      <p className="flex-1 leading-snug">{announcement.message}</p>
      <button type="button" onClick={dismiss} aria-label="Duyuruyu kapat" className="rounded-full p-1 transition hover:bg-white/15">
        <X size={15} strokeWidth={2} />
      </button>
    </div>
  );
}

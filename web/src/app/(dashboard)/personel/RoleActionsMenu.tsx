"use client";

import { useEffect, useRef, useState } from "react";
import { MoreVertical, TrendingUp, Repeat, UserX } from "lucide-react";

interface RoleActionsMenuProps {
  currentRole: "STAFF" | "TEAM_LEAD";
  onPromote: () => void;
  onSwapRole: () => void;
  onTerminate: () => void;
}

/**
 * Aktif Personel kartlarındaki "Rol İşlemleri" menüsü — Müdür'e Terfi Ettir /
 * Personel↔Şef geçişi / İşten Çıkar. Dışarı tıklanınca kapanır (mevcut
 * kod tabanında hazır bir Dropdown bileşeni yoktu, bu yüzden minimal bir
 * tane yazıldı).
 */
export function RoleActionsMenu({ currentRole, onPromote, onSwapRole, onTerminate }: RoleActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Rol İşlemleri"
        className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-surface-base text-text-secondary transition hover:border-border-strong hover:bg-surface-subtle hover:text-text-primary"
      >
        <MoreVertical size={15} strokeWidth={1.75} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-10 mt-1.5 w-52 overflow-hidden rounded-2xl border border-border bg-surface-card shadow-pop">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onPromote();
            }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-text-primary transition hover:bg-surface-subtle"
          >
            <TrendingUp size={14} strokeWidth={1.75} className="text-primary-600" />
            Müdür&apos;e Terfi Ettir
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onSwapRole();
            }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-text-primary transition hover:bg-surface-subtle"
          >
            <Repeat size={14} strokeWidth={1.75} className="text-info-600" />
            {currentRole === "TEAM_LEAD" ? "Personel Yap" : "Şef Yap"}
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onTerminate();
            }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-danger-500 transition hover:bg-danger-50"
          >
            <UserX size={14} strokeWidth={1.75} />
            İşten Çıkar
          </button>
        </div>
      )}
    </div>
  );
}

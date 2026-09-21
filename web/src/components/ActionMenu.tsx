"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, type LucideIcon } from "lucide-react";

export interface ActionMenuItem {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  /** danger: kırmızı metin; warning: turuncu; default: normal. */
  tone?: "default" | "danger" | "warning";
  disabled?: boolean;
}

/**
 * Bir kart/satırdaki ikincil aksiyonları "⋯" düğmesi altında toplayan menü
 * (tasarım turu #5: Personel kartındaki 8–10 buton). Gruplar `null` ile
 * ayrılır ve ayraç çizilir. Dışarı tıklama ve Escape ile kapanır.
 */
export function ActionMenu({
  items,
  label = "Diğer işlemler",
  align = "right",
  triggerClassName,
}: {
  items: (ActionMenuItem | null)[];
  label?: string;
  align?: "left" | "right";
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Baştaki/sondaki/ardışık ayraçları temizle.
  const cleaned = items.reduce<(ActionMenuItem | null)[]>((acc, it) => {
    if (it === null) {
      if (acc.length === 0 || acc[acc.length - 1] === null) return acc;
    }
    acc.push(it);
    return acc;
  }, []);
  while (cleaned.length > 0 && cleaned[cleaned.length - 1] === null) cleaned.pop();
  if (cleaned.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className={
          triggerClassName ??
          "flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface-base text-text-secondary transition hover:border-border-strong hover:bg-surface-subtle hover:text-text-primary"
        }
      >
        <MoreHorizontal size={16} strokeWidth={1.75} />
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute top-full z-20 mt-1.5 w-56 overflow-hidden rounded-2xl border border-border bg-surface-card py-1 shadow-pop ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {cleaned.map((item, i) => {
            if (item === null) return <div key={`sep-${i}`} className="my-1 border-t border-border" />;
            const Icon = item.icon;
            const tone =
              item.tone === "danger"
                ? "text-danger-500 hover:bg-danger-50"
                : item.tone === "warning"
                  ? "text-warning-600 hover:bg-warning-50"
                  : "text-text-primary hover:bg-surface-subtle";
            return (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
                className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm transition disabled:opacity-50 ${tone}`}
              >
                {Icon && <Icon size={14} strokeWidth={1.75} className={item.tone ? undefined : "text-text-secondary"} />}
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

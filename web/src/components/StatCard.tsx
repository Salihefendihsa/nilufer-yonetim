"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

export interface StatBadge {
  label: string;
  tone: "critical" | "live";
}

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  accent?: "green" | "red" | "gold";
  badge?: StatBadge;
  mono?: boolean;
}

const ACCENT_STYLES: Record<"green" | "red" | "gold", { iconBg: string; iconText: string; glow: string }> = {
  green: {
    iconBg: "bg-primary-greenLight/15",
    iconText: "text-primary-greenLight",
    glow: "shadow-[0_0_16px_rgba(93,161,48,0.18)]",
  },
  red: {
    iconBg: "bg-primary-redLight/15",
    iconText: "text-primary-redLight",
    glow: "shadow-[0_0_16px_rgba(193,39,45,0.18)]",
  },
  gold: {
    iconBg: "bg-primary-gold/15",
    iconText: "text-primary-gold",
    glow: "shadow-[0_0_16px_rgba(212,174,61,0.18)]",
  },
};

export function StatCard({ label, value, icon: Icon, accent = "green", badge, mono = false }: StatCardProps) {
  const style = ACCENT_STYLES[accent];
  const isCritical = badge?.tone === "critical";

  return (
    <motion.div
      whileHover={{ y: -2 }}
      animate={
        isCritical
          ? {
              boxShadow: [
                "0 8px 24px rgba(0,0,0,0.22)",
                "0 8px 24px rgba(0,0,0,0.22), 0 0 24px rgba(122,31,38,0.25)",
                "0 8px 24px rgba(0,0,0,0.22)",
              ],
            }
          : undefined
      }
      transition={isCritical ? { duration: 2.2, repeat: Infinity, ease: "easeInOut" } : { duration: 0.15, ease: "easeOut" }}
      className="relative flex flex-col gap-4 rounded-2xl bg-surface-card p-6 shadow-[0_8px_24px_rgba(0,0,0,0.22)] ring-1 ring-primary-gold/10"
    >
      {badge && (
        <span
          className={`absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
            isCritical ? "bg-primary-redLight/15 text-primary-redLight" : "bg-primary-greenLight/15 text-primary-greenLight"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${isCritical ? "animate-pulse bg-primary-redLight" : "bg-primary-greenLight"}`} />
          {badge.label}
        </span>
      )}

      <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${style.iconBg} ${style.iconText} ${style.glow}`}>
        <Icon size={20} strokeWidth={1.75} />
      </div>
      <div>
        <p className={`text-4xl font-bold tracking-tight text-text-primary ${mono ? "font-mono" : ""}`}>{value}</p>
        <p className="mt-1 text-sm text-text-secondary">{label}</p>
      </div>
    </motion.div>
  );
}

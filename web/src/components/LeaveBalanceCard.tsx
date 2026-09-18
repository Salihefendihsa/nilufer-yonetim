"use client";

import { useEffect, useState } from "react";
import { CalendarOff } from "lucide-react";
import { api } from "@/lib/api";
import type { LeaveBalance } from "@/lib/types";

/**
 * Bölüm AH (7. tur): "İzin Bakiyesi" — kalan/toplam gün + progress bar
 * (GET /staff/:id/leave-balance, takvim yılı). Yetki yoksa/hata → gizli.
 */
export function LeaveBalanceCard({ staffId, compact = false }: { staffId: string; compact?: boolean }) {
  const [balance, setBalance] = useState<LeaveBalance | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<LeaveBalance>(`/staff/${staffId}/leave-balance`)
      .then((b) => {
        if (!cancelled) setBalance(b);
      })
      .catch(() => {
        if (!cancelled) setBalance(null);
      });
    return () => {
      cancelled = true;
    };
  }, [staffId]);

  if (!balance) return null;
  const used = Math.min(balance.quotaDays, Math.max(0, balance.usedDays));
  const pct = balance.quotaDays > 0 ? Math.round((used / balance.quotaDays) * 100) : 0;
  const over = balance.remainingDays < 0;

  return (
    <div className={`rounded-xl border border-border bg-surface-subtle ${compact ? "px-3 py-2" : "p-4"}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
          <CalendarOff size={13} strokeWidth={1.75} />
          İzin Bakiyesi {balance.year}
        </p>
        <p className={`font-mono text-xs font-semibold ${over ? "text-danger-500" : "text-text-primary"}`}>
          {balance.remainingDays} / {balance.quotaDays} gün
        </p>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-muted">
        <div className={`h-full rounded-full ${over ? "bg-danger-500" : pct >= 80 ? "bg-warning-500" : "bg-primary-500"}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      {!compact && (
        <p className="mt-1 text-2xs text-text-faint">
          {balance.usedDays} gün kullanıldı ({balance.approvedRequestCount} onaylı talep){over ? " · bakiye aşıldı" : ""}
        </p>
      )}
    </div>
  );
}

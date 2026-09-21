"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LoadingBlock } from "@/components/LoadingBlock";
import { SectionTitle } from "@/components/SectionTitle";
import { ChevronLeft, ChevronRight, Receipt, TrendingUp, TrendingDown, Wallet, Banknote } from "lucide-react";
import { RequireRole } from "@/components/RequireRole";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { api, ApiError } from "@/lib/api";
import { currencyFormatter, formatDate } from "@/lib/format";
import type { Payslip } from "@/lib/types";

/**
 * Bölüm AN (9. tur): "Bordrom" — personelin kendi aylık maaş+prim özeti
 * (GET /staff/me/payslip?month=). SALT GÖRÜNTÜLEME: hiçbir ödeme işlemi
 * tetiklemez; yönetim bu sayfayı görmez (Finans'tan tüm veriyi zaten görür).
 */
export default function PayslipPage() {
  return (
    <RequireRole roles={["TEAM_LEAD", "STAFF"]}>
      <PayslipContent />
    </RequireRole>
  );
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(d: Date, delta: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

function PayslipContent() {
  const [cursor, setCursor] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [payslip, setPayslip] = useState<Payslip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const key = useMemo(() => monthKey(cursor), [cursor]);
  const isCurrentMonth = key === monthKey(new Date());
  const monthLabel = cursor.toLocaleDateString("tr-TR", { month: "long", year: "numeric" });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPayslip(await api.get<Payslip>(`/staff/me/payslip?month=${key}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Bordro yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    load();
  }, [load]);

  const money = (n: number | undefined) => (n === undefined ? "—" : currencyFormatter.format(n));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Receipt}
        title="Bordrom"
        description="Aylık maaş, onaylanan prim ve avans özetiniz. Bilgilendirme amaçlıdır; ödeme işlemi başlatmaz."
        actions={
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface-base px-2 py-1.5">
            <button type="button" onClick={() => setCursor((c) => shiftMonth(c, -1))} className="rounded-xl p-1.5 text-text-secondary transition hover:bg-surface-subtle" aria-label="Önceki ay">
              <ChevronLeft size={16} />
            </button>
            <span className="min-w-[9rem] text-center text-sm font-semibold capitalize text-text-primary">{monthLabel}</span>
            <button
              type="button"
              disabled={isCurrentMonth}
              onClick={() => setCursor((c) => shiftMonth(c, 1))}
              className="rounded-xl p-1.5 text-text-secondary transition hover:bg-surface-subtle disabled:opacity-40"
              aria-label="Sonraki ay"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        }
      />

      {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Taban maaş" value={loading ? "—" : money(payslip?.salaryBase)} icon={Wallet} mono />
        <StatCard
          label="Onaylanan prim"
          value={loading ? "—" : money(payslip?.bonusTotal)}
          icon={TrendingUp}
          accent="green"
          mono
          hint={payslip && payslip.bonusCount > 0 ? `${payslip.bonusCount} onaylı prim` : undefined}
        />
        <StatCard
          label="Onaylanan avans"
          value={loading ? "—" : money(payslip?.advanceTotal)}
          icon={TrendingDown}
          accent="red"
          mono
          hint={payslip && payslip.advanceCount > 0 ? `${payslip.advanceCount} onaylı avans` : undefined}
        />
        <StatCard label="Net (tahmini)" value={loading ? "—" : money(payslip?.net)} icon={Banknote} accent="green" mono />
      </div>

      <section className="rounded-2xl border border-border bg-surface-card p-5 shadow-card">
        <SectionTitle size="sm" className="mb-3">Hesap özeti — {monthLabel}</SectionTitle>
        {loading || !payslip ? (
          <LoadingBlock lines={3} />
        ) : (
          <dl className="flex flex-col divide-y divide-border text-sm">
            <div className="flex justify-between py-2.5">
              <dt className="text-text-secondary">Taban maaş</dt>
              <dd className="font-mono font-medium text-text-primary">{money(payslip.salaryBase)}</dd>
            </div>
            {payslip.bonuses.map((b) => (
              <div key={b.id} className="flex justify-between py-2.5">
                <dt className="text-text-secondary">
                  Prim · {b.periodName}
                  {b.approvedAt ? <span className="text-xs"> · {formatDate(b.approvedAt)}</span> : null}
                </dt>
                <dd className="font-mono font-medium text-success-600">+{money(b.amount)}</dd>
              </div>
            ))}
            {payslip.advances.map((a) => (
              <div key={a.id} className="flex justify-between py-2.5">
                <dt className="text-text-secondary">
                  Avans · {a.reason} <span className="text-xs">· {formatDate(a.createdAt)}</span>
                </dt>
                <dd className="font-mono font-medium text-danger-500">−{money(a.amount)}</dd>
              </div>
            ))}
            <div className="flex justify-between py-3">
              <dt className="font-semibold text-text-primary">Net</dt>
              <dd className="font-mono text-base font-bold text-text-primary">{money(payslip.net)}</dd>
            </div>
          </dl>
        )}
        <p className="mt-3 text-xs text-text-secondary">
          Prim, onaylandığı aya; avans, talep edildiği aya yazılır. Vergi/SGK kesintileri bu özete dahil değildir — resmi bordro için muhasebeye danışın.
        </p>
      </section>
    </div>
  );
}

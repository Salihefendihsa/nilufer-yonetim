"use client";

import { useCallback, useEffect, useState } from "react";
import { TrendingUp, MapPin, Users2 } from "lucide-react";
import { RequireRole } from "@/components/RequireRole";
import { api, ApiError } from "@/lib/api";
import { currencyFormatter } from "@/lib/format";
import type { RevenueTrendPoint, ServiceBreakdownEntry, TopDistrictEntry, CustomerRetention } from "@/lib/types";

type RangeKey = "30d" | "3m" | "6m";

const RANGE_OPTIONS: { key: RangeKey; label: string; months: number }[] = [
  { key: "30d", label: "Son 30 Gün", months: 1 },
  { key: "3m", label: "Son 3 Ay", months: 3 },
  { key: "6m", label: "Son 6 Ay", months: 6 },
];

const BAR_COLORS = [
  "bg-primary-green",
  "bg-sky-400",
  "bg-amber-400",
  "bg-primary-redLight",
  "bg-purple-400",
  "bg-primary-gold",
];

export default function ReportsPage() {
  return (
    <RequireRole roles={["OWNER", "MANAGER"]}>
      <ReportsPageContent />
    </RequireRole>
  );
}

function ReportsPageContent() {
  const [range, setRange] = useState<RangeKey>("6m");
  const [revenue, setRevenue] = useState<RevenueTrendPoint[]>([]);
  const [breakdown, setBreakdown] = useState<ServiceBreakdownEntry[]>([]);
  const [districts, setDistricts] = useState<TopDistrictEntry[]>([]);
  const [retention, setRetention] = useState<CustomerRetention | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const months = RANGE_OPTIONS.find((r) => r.key === range)?.months ?? 6;
      const [revenueRes, breakdownRes, districtsRes, retentionRes] = await Promise.all([
        api.get<{ data: RevenueTrendPoint[] }>(`/analytics/revenue-trend?months=${months}`),
        api.get<{ data: ServiceBreakdownEntry[]; total: number }>(`/analytics/service-breakdown?months=${months}`),
        api.get<{ data: TopDistrictEntry[] }>("/analytics/top-districts"),
        api.get<CustomerRetention>("/analytics/customer-retention"),
      ]);
      setRevenue(revenueRes.data);
      setBreakdown(breakdownRes.data);
      setDistricts(districtsRes.data);
      setRetention(retentionRes);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Rapor verileri yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  const maxRevenue = Math.max(1, ...revenue.map((r) => r.total));
  const maxDistrictCount = Math.max(1, ...districts.map((d) => d.count));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-text-primary">Raporlar</h1>
          <p className="mt-1 text-sm text-text-secondary">İşletmenizin performansını analiz edin.</p>
        </div>
        <div className="flex gap-1.5 rounded-2xl bg-surface-card p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.22)]">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setRange(opt.key)}
              className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
                range === opt.key ? "bg-primary-green text-white" : "text-text-secondary hover:bg-white/5"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="rounded-2xl bg-primary-red/10 px-4 py-3 text-sm text-primary-redLight">{error}</p>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-surface-card p-6 shadow-[0_8px_24px_rgba(0,0,0,0.22)]">
          <div className="mb-5 flex items-center gap-2">
            <TrendingUp size={17} strokeWidth={1.75} className="text-text-faint" />
            <h2 className="text-base font-semibold text-text-primary">Aylık Ciro Trendi</h2>
          </div>

          {loading ? (
            <p className="py-10 text-center text-sm text-text-faint">Yükleniyor...</p>
          ) : revenue.length === 0 ? (
            <p className="py-10 text-center text-sm text-text-faint">Veri yok</p>
          ) : (
            <div className="flex h-48 items-end gap-3">
              {revenue.map((point) => (
                <div key={point.label} className="flex flex-1 flex-col items-center gap-2">
                  <span className="font-mono text-xs text-text-secondary">
                    {point.total > 0 ? currencyFormatter.format(point.total) : "—"}
                  </span>
                  <div className="flex w-full items-end justify-center" style={{ height: "120px" }}>
                    <div
                      className="w-full max-w-[36px] rounded-t-lg bg-gradient-to-t from-primary-green to-primary-greenLight"
                      style={{ height: `${Math.max(4, (point.total / maxRevenue) * 120)}px` }}
                    />
                  </div>
                  <span className="text-xs text-text-faint">{point.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-surface-card p-6 shadow-[0_8px_24px_rgba(0,0,0,0.22)]">
          <h2 className="mb-5 text-base font-semibold text-text-primary">Hizmet Dağılımı</h2>

          {loading ? (
            <p className="py-10 text-center text-sm text-text-faint">Yükleniyor...</p>
          ) : breakdown.length === 0 ? (
            <p className="py-10 text-center text-sm text-text-faint">Veri yok</p>
          ) : (
            <div className="flex flex-col gap-4">
              {breakdown.map((entry, i) => (
                <div key={entry.serviceType}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="text-text-secondary">{entry.serviceType}</span>
                    <span className="font-mono text-text-faint">
                      {entry.count} · %{entry.percentage}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-white/5">
                    <div
                      className={`h-2 rounded-full ${BAR_COLORS[i % BAR_COLORS.length]}`}
                      style={{ width: `${entry.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-surface-card p-6 shadow-[0_8px_24px_rgba(0,0,0,0.22)]">
          <div className="mb-5 flex items-center gap-2">
            <MapPin size={17} strokeWidth={1.75} className="text-text-faint" />
            <h2 className="text-base font-semibold text-text-primary">En Yoğun Bölgeler</h2>
          </div>

          {loading ? (
            <p className="py-10 text-center text-sm text-text-faint">Yükleniyor...</p>
          ) : districts.length === 0 ? (
            <p className="py-10 text-center text-sm text-text-faint">Veri yok</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {districts.map((d, i) => (
                <li key={d.district} className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/5 text-xs font-semibold text-text-secondary">
                    {i + 1}
                  </span>
                  <span className="flex-1 text-sm text-text-primary">{d.district}</span>
                  <div className="h-2 w-24 rounded-full bg-white/5">
                    <div
                      className="h-2 rounded-full bg-primary-gold"
                      style={{ width: `${(d.count / maxDistrictCount) * 100}%` }}
                    />
                  </div>
                  <span className="w-6 text-right font-mono text-xs text-text-faint">{d.count}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="rounded-2xl bg-surface-card p-6 shadow-[0_8px_24px_rgba(0,0,0,0.22)]">
          <div className="mb-5 flex items-center gap-2">
            <Users2 size={17} strokeWidth={1.75} className="text-text-faint" />
            <h2 className="text-base font-semibold text-text-primary">Müşteri Sadakati (Bu Ay)</h2>
          </div>

          {loading ? (
            <p className="py-10 text-center text-sm text-text-faint">Yükleniyor...</p>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl bg-primary-green/10 p-6 text-center">
                <p className="font-mono text-4xl font-semibold text-primary-greenLight">{retention?.newCustomers ?? 0}</p>
                <p className="mt-2 text-sm text-text-secondary">Yeni Müşteri</p>
              </div>
              <div className="rounded-2xl bg-primary-gold/10 p-6 text-center">
                <p className="font-mono text-4xl font-semibold text-primary-gold">{retention?.returningCustomers ?? 0}</p>
                <p className="mt-2 text-sm text-text-secondary">Tekrar Eden Müşteri</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

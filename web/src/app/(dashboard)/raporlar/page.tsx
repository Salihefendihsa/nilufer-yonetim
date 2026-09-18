"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { TrendingUp, MapPin, Users2, BarChart3, Wallet, PieChart, Repeat, Download, MessageSquareHeart } from "lucide-react";
import { RequireRole } from "@/components/RequireRole";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { ChartCard, DonutChart, RankBars, TrendChart } from "@/components/ChartCard";
import { api, ApiError, downloadFile } from "@/lib/api";
import { currencyFormatter } from "@/lib/format";
import type { RevenueTrendPoint, ServiceBreakdownEntry, TopDistrictEntry, CustomerRetention, FeedbackSummary } from "@/lib/types";

type RangeKey = "30d" | "3m" | "6m";

const RANGE_OPTIONS: { key: RangeKey; label: string; months: number }[] = [
  { key: "30d", label: "Son 30 Gün", months: 1 },
  { key: "3m", label: "Son 3 Ay", months: 3 },
  { key: "6m", label: "Son 6 Ay", months: 6 },
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
  const [downloading, setDownloading] = useState(false);
  const [revenue, setRevenue] = useState<RevenueTrendPoint[]>([]);
  const [breakdown, setBreakdown] = useState<ServiceBreakdownEntry[]>([]);
  const [districts, setDistricts] = useState<TopDistrictEntry[]>([]);
  const [retention, setRetention] = useState<CustomerRetention | null>(null);
  // Bölüm S (5. tur): yapılandırılmış geri bildirim ortalamaları.
  const [feedback, setFeedback] = useState<FeedbackSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const months = RANGE_OPTIONS.find((r) => r.key === range)?.months ?? 6;
      const [revenueRes, breakdownRes, districtsRes, retentionRes, feedbackRes] = await Promise.all([
        api.get<{ data: RevenueTrendPoint[] }>(`/analytics/revenue-trend?months=${months}`),
        api.get<{ data: ServiceBreakdownEntry[]; total: number }>(`/analytics/service-breakdown?months=${months}`),
        api.get<{ data: TopDistrictEntry[] }>("/analytics/top-districts"),
        api.get<CustomerRetention>("/analytics/customer-retention"),
        api.get<FeedbackSummary>("/analytics/feedback-summary").catch(() => null),
      ]);
      setRevenue(revenueRes.data);
      setBreakdown(breakdownRes.data);
      setDistricts(districtsRes.data);
      setRetention(retentionRes);
      setFeedback(feedbackRes);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Rapor verileri yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  // Üst özet satırı seçili aralığın kendi verisinden türetilir — ek istek yok.
  const summary = useMemo(() => {
    const total = revenue.reduce((sum, r) => sum + r.total, 0);
    const average = revenue.length > 0 ? total / revenue.length : 0;
    const last = revenue[revenue.length - 1]?.total ?? 0;
    const previous = revenue[revenue.length - 2]?.total ?? 0;
    const change = previous > 0 ? ((last - previous) / previous) * 100 : 0;
    const jobCount = breakdown.reduce((sum, b) => sum + b.count, 0);
    const topService = breakdown[0];
    return { total, average, last, change, jobCount, topService };
  }, [revenue, breakdown]);

  const retentionSlices = useMemo(() => {
    if (!retention) return [];
    return [
      { name: "Yeni müşteri", value: retention.newCustomers, color: "#3D8A4E" },
      { name: "Tekrar eden", value: retention.returningCustomers, color: "#B57F13" },
    ];
  }, [retention]);

  const breakdownSlices = useMemo(
    () => breakdown.map((entry) => ({ name: entry.serviceType, value: entry.count })),
    [breakdown]
  );

  const districtRows = useMemo(
    () => districts.map((d) => ({ label: d.district, value: d.count })),
    [districts]
  );

  async function handleDownloadPdf() {
    setDownloading(true);
    setError(null);
    try {
      const months = RANGE_OPTIONS.find((r) => r.key === range)?.months ?? 6;
      const dateStr = new Date().toISOString().slice(0, 10);
      await downloadFile(`/analytics/export/pdf?months=${months}`, `nilufer-raporlar-${dateStr}.pdf`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "PDF indirilemedi");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={BarChart3}
        title="Raporlar"
        description="İşletmenizin performansını analiz edin."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1 rounded-2xl border border-border bg-surface-card p-1 shadow-card">
              {RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setRange(opt.key)}
                  className={`rounded-xl px-3.5 py-2 text-sm font-medium transition ${
                    range === opt.key ? "bg-primary-600 text-white shadow-card" : "text-text-secondary hover:bg-surface-subtle"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="flex items-center gap-2 rounded-2xl border border-border bg-surface-card px-4 py-2.5 text-sm font-medium text-text-secondary shadow-card transition hover:border-border-strong hover:bg-surface-subtle hover:text-text-primary disabled:opacity-50"
            >
              <Download size={16} strokeWidth={1.75} />
              {downloading ? "İndiriliyor..." : "PDF İndir"}
            </button>
          </div>
        }
      />

      {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

      {/* [Özet kartlar] */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Toplam ciro (seçili aralık)"
          value={loading ? "—" : currencyFormatter.format(summary.total)}
          icon={Wallet}
          mono
        />
        <StatCard
          label="Aylık ortalama ciro"
          value={loading ? "—" : currencyFormatter.format(summary.average)}
          icon={TrendingUp}
          accent="blue"
          mono
        />
        <StatCard
          label="Son ay cirosu"
          value={loading ? "—" : currencyFormatter.format(summary.last)}
          icon={BarChart3}
          trend={{ value: summary.change, label: "önceki aya göre" }}
          mono
        />
        <StatCard
          label="En çok verilen hizmet"
          value={loading || !summary.topService ? "—" : `%${summary.topService.percentage}`}
          icon={PieChart}
          accent="gold"
          hint={summary.topService?.serviceType}
        />
      </div>

      {/* [Grafikler] */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          title="Aylık Ciro Trendi"
          description="Seçili aralıktaki tahsilat toplamı"
          icon={TrendingUp}
          height={280}
          className="lg:col-span-2"
        >
          <TrendChart
            data={revenue}
            xKey="label"
            series={[{ key: "total", name: "Ciro" }]}
            area
            currency
            emptyLabel={loading ? "Yükleniyor..." : "Veri yok"}
          />
        </ChartCard>

        <ChartCard title="Hizmet Dağılımı" description="İş sayısına göre" icon={PieChart} height={280}>
          <DonutChart
            data={breakdownSlices}
            centerValue={loading ? "—" : String(summary.jobCount)}
            centerLabel="toplam iş"
            emptyLabel={loading ? "Yükleniyor..." : "Veri yok"}
          />
        </ChartCard>

        <ChartCard title="En Yoğun Bölgeler" description="İlçe bazında iş sayısı" icon={MapPin} height={280}>
          <RankBars rows={districtRows} emptyLabel={loading ? "Yükleniyor..." : "Veri yok"} />
        </ChartCard>

        {/* Bölüm S (5. tur): 3 kriterin ortalaması (1–5) + tavsiye oranı */}
        <ChartCard
          title="Müşteri Geri Bildirimi"
          description={
            feedback && feedback.responseCount > 0
              ? `${feedback.responseCount} detaylı değerlendirme${feedback.recommendRate !== null ? ` · %${Math.round(feedback.recommendRate)} tavsiye eder` : ""}`
              : "Tamamlanan işlerden gelen kriter puanları"
          }
          icon={MessageSquareHeart}
          height={220}
        >
          <RankBars
            rows={
              feedback && feedback.responseCount > 0
                ? [
                    { label: "Hizmet Kalitesi", value: feedback.serviceQualityAvg ?? 0, meta: `${(feedback.serviceQualityAvg ?? 0).toFixed(1)} / 5` },
                    { label: "Dakiklik", value: feedback.punctualityAvg ?? 0, meta: `${(feedback.punctualityAvg ?? 0).toFixed(1)} / 5` },
                    { label: "Personel Profesyonelliği", value: feedback.staffProfessionalismAvg ?? 0, meta: `${(feedback.staffProfessionalismAvg ?? 0).toFixed(1)} / 5` },
                  ]
                : []
            }
            emptyLabel={loading ? "Yükleniyor..." : "Henüz detaylı değerlendirme yok"}
          />
        </ChartCard>

        <ChartCard title="Müşteri Sadakati (Bu Ay)" icon={Users2} height={220}>
          <DonutChart
            data={retentionSlices}
            centerValue={loading ? "—" : String((retention?.newCustomers ?? 0) + (retention?.returningCustomers ?? 0))}
            centerLabel="müşteri"
            emptyLabel={loading ? "Yükleniyor..." : "Veri yok"}
          />
        </ChartCard>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatCard
            label="Yeni Müşteri"
            value={loading ? "—" : String(retention?.newCustomers ?? 0)}
            icon={Users2}
            mono
            hint="Bu ay ilk kez hizmet alan"
          />
          <StatCard
            label="Tekrar Eden Müşteri"
            value={loading ? "—" : String(retention?.returningCustomers ?? 0)}
            icon={Repeat}
            accent="gold"
            mono
            hint="Daha önce hizmet almış"
          />
        </div>
      </div>
    </div>
  );
}

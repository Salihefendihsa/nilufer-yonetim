"use client";

import { ChartSkeleton } from "@/components/LoadingBlock";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend as RechartsLegend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis as RechartsXAxis,
  YAxis as RechartsYAxis,
  Area,
  AreaChart,
} from "recharts";

/**
 * Panel genelindeki tek grafik dili.
 *
 * Grafik türü ne olursa olsun dış kabuk (başlık, ikon, açıklama, sağ üst aksiyon)
 * aynı `ChartCard` sarmalayıcısından gelir; renkler CHART_COLORS'tan okunur.
 * Yeni bir grafik eklerken buradaki bileşenlerden birini kullanın.
 *
 * recharts kullanır (önceki sürüm, npm registry erişimi başarısız olduğu için
 * geçici olarak bağımlılıksız SVG ile çizilmişti — artık kurulabildi). Dışa
 * açılan API (ChartCard / SimpleBarChart / TrendChart / DonutChart / RankBars)
 * o sürümle birebir aynı veri sözleşmesini korur, çağıran sayfalarda hiçbir
 * değişiklik gerekmedi.
 */

// Bölüm D (2. tur): recharts SVG dolgu/vuruş renklerini doğrudan CSS
// değişkenlerine bağlar (Tailwind sınıfı DEĞİL, çünkü recharts prop'ları düz
// bir renk string'i bekler) — böylece grafikler de tema değişince otomatik
// güncellenir, ayrı bir "koyu grafik paleti" JS objesi tutmaya gerek kalmaz.
export const CHART_COLORS = [
  "rgb(var(--chart-1))",
  "rgb(var(--chart-2))",
  "rgb(var(--chart-3))",
  "rgb(var(--chart-4))",
  "rgb(var(--chart-5))",
  "rgb(var(--chart-6))",
];

const GRID = "rgb(var(--border))";
const AXIS_TEXT = "rgb(var(--text-faint))";
const AXIS_STYLE = { fontSize: 10, fill: AXIS_TEXT };
const CURSOR_FILL = "var(--chart-cursor-fill)";

function formatValue(value: number, currency?: boolean): string {
  if (currency) return `${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(value)} ₺`;
  return new Intl.NumberFormat("tr-TR").format(value);
}

/** Y ekseni etiketleri için kısa gösterim (12.500 → 12,5B). */
function compact(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(".0", "")}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1).replace(".0", "")}B`;
  return String(Math.round(value));
}

/* ----------------------------------------------------------------- kabuk ---- */

interface ChartCardProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  /** Grafik gövdesinin yüksekliği (px). Varsayılan 260. */
  height?: number;
  children: ReactNode;
  className?: string;
}

export function ChartCard({ title, description, icon: Icon, action, height = 260, children, className = "" }: ChartCardProps) {
  return (
    <div className={`flex flex-col rounded-2xl border border-border bg-surface-card p-5 shadow-card transition-shadow hover:shadow-cardHover ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {Icon && (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 ring-1 ring-primary-100">
              <Icon size={17} strokeWidth={1.75} />
            </span>
          )}
          <div>
            <h3 className="text-base font-semibold text-text-primary">{title}</h3>
            {description && <p className="mt-0.5 text-xs text-text-faint">{description}</p>}
          </div>
        </div>
        {action}
      </div>
      <div style={{ height }} className="w-full">
        {children}
      </div>
    </div>
  );
}

function EmptyChart({ label = "Gösterilecek veri yok" }: { label?: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border bg-surface-subtle/60">
      <p className="text-xs text-text-faint">{label}</p>
    </div>
  );
}

/** recharts'ın varsayılan tooltip'i yerine panelin kart diline uyan özel gövde. */
function ChartTooltip({
  active,
  label,
  payload,
  currency,
}: {
  active?: boolean;
  label?: string;
  payload?: { name?: string; value?: number | string; color?: string }[];
  currency?: boolean;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-xl border border-border bg-surface-base px-3 py-2 text-xs shadow-pop">
      <p className="mb-0.5 whitespace-nowrap font-semibold text-text-primary">{label}</p>
      {payload.map((row, i) => (
        <p key={`${row.name}-${i}`} className="flex items-center gap-1.5 whitespace-nowrap text-text-secondary">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: row.color }} />
          {row.name}: <span className="font-mono text-text-primary">{formatValue(Number(row.value ?? 0), currency)}</span>
        </p>
      ))}
    </div>
  );
}

function ChartLegend({ payload }: { payload?: { value?: string; color?: string }[] }) {
  if (!payload || payload.length < 2) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
      {payload.map((item, i) => (
        <span key={`${item.value}-${i}`} className="flex items-center gap-1.5 text-xs text-text-secondary">
          <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
          {item.value}
        </span>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- çubuk ---- */

export interface ChartSeries {
  key: string;
  name: string;
  color?: string;
}

interface SimpleBarChartProps<T> {
  data: T[];
  xKey: string;
  series: ChartSeries[];
  stacked?: boolean;
  /** Değerleri para birimi olarak biçimlendirir. */
  currency?: boolean;
  emptyLabel?: string;
  /** true iken iskelet çizilir ("Yükleniyor..." metni yerine). */
  loading?: boolean;
}

export function SimpleBarChart<T extends object>({
  data,
  xKey,
  series,
  stacked = false,
  currency,
  emptyLabel,
  loading,
}: SimpleBarChartProps<T>) {
  if (loading) return <ChartSkeleton />;
  if (data.length === 0) return <EmptyChart label={emptyLabel} />;
  const colorOf = (i: number) => series[i].color ?? CHART_COLORS[i % CHART_COLORS.length];

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barGap={4}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <RechartsXAxis dataKey={xKey} tick={AXIS_STYLE} tickLine={false} axisLine={false} />
        <RechartsYAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} tickFormatter={compact} width={40} />
        <RechartsTooltip
          content={<ChartTooltip currency={currency} />}
          cursor={{ fill: CURSOR_FILL }}
        />
        {series.length > 1 && <RechartsLegend content={<ChartLegend />} />}
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.name}
            fill={colorOf(i)}
            stackId={stacked ? "stack" : undefined}
            radius={stacked ? 0 : [4, 4, 0, 0]}
            maxBarSize={40}
            animationDuration={500}
            animationEasing="ease-out"
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------ çizgi / alan grafik ---- */

interface TrendChartProps<T> {
  data: T[];
  xKey: string;
  series: ChartSeries[];
  /** Alan dolgusu ile çizer (tek seri trendlerde tercih edilir). */
  area?: boolean;
  currency?: boolean;
  emptyLabel?: string;
  /** true iken iskelet çizilir ("Yükleniyor..." metni yerine). */
  loading?: boolean;
}

export function TrendChart<T extends object>({ data, xKey, series, area = false, currency, emptyLabel, loading }: TrendChartProps<T>) {
  if (loading) return <ChartSkeleton />;
  if (data.length === 0) return <EmptyChart label={emptyLabel} />;
  const colorOf = (i: number) => series[i].color ?? CHART_COLORS[i % CHART_COLORS.length];
  const Chart = area ? AreaChart : LineChart;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <Chart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={s.key} id={`trend-fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colorOf(i)} stopOpacity={0.3} />
              <stop offset="100%" stopColor={colorOf(i)} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <RechartsXAxis dataKey={xKey} tick={AXIS_STYLE} tickLine={false} axisLine={false} />
        <RechartsYAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} tickFormatter={compact} width={40} />
        <RechartsTooltip content={<ChartTooltip currency={currency} />} cursor={{ stroke: GRID, strokeWidth: 1 }} />
        {series.length > 1 && <RechartsLegend content={<ChartLegend />} />}
        {series.map((s, i) =>
          area ? (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={colorOf(i)}
              strokeWidth={2.25}
              fill={`url(#trend-fill-${s.key})`}
              dot={false}
              activeDot={{ r: 4 }}
              animationDuration={500}
              animationEasing="ease-out"
            />
          ) : (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={colorOf(i)}
              strokeWidth={2.25}
              dot={false}
              activeDot={{ r: 4 }}
              animationDuration={500}
              animationEasing="ease-out"
            />
          )
        )}
      </Chart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------- donut ---- */

export interface DonutSlice {
  name: string;
  value: number;
  color?: string;
}

interface DonutChartProps {
  data: DonutSlice[];
  /** Halkanın ortasında gösterilecek büyük değer. */
  centerValue?: string;
  centerLabel?: string;
  emptyLabel?: string;
  /** true iken iskelet çizilir ("Yükleniyor..." metni yerine). */
  loading?: boolean;
}

export function DonutChart({ data, centerValue, centerLabel, emptyLabel, loading }: DonutChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (loading) return <ChartSkeleton />;
  if (total === 0) return <EmptyChart label={emptyLabel} />;
  const slices = data.filter((d) => d.value > 0);

  return (
    <div className="flex h-full flex-col">
      <div className="relative min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="88%"
              paddingAngle={2}
              startAngle={90}
              endAngle={-270}
              animationDuration={500}
              animationEasing="ease-out"
            >
              {slices.map((slice, i) => (
                <Cell key={slice.name} fill={slice.color ?? CHART_COLORS[i % CHART_COLORS.length]} stroke="none" />
              ))}
            </Pie>
            <RechartsTooltip
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                const p = payload[0];
                const value = Number(p.value ?? 0);
                return (
                  <div className="rounded-xl border border-border bg-surface-base px-3 py-2 text-xs shadow-pop">
                    <p className="flex items-center gap-1.5 font-semibold text-text-primary">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.payload?.color ?? p.color }} />
                      {p.name}
                    </p>
                    <p className="font-mono text-text-secondary">
                      {formatValue(value)} (%{Math.round((value / total) * 100)})
                    </p>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
          {centerValue && (
            <>
              <span className="text-2xl font-bold tracking-tight text-text-primary">{centerValue}</span>
              {centerLabel && <span className="text-2xs uppercase tracking-wide text-text-faint">{centerLabel}</span>}
            </>
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        {slices.map((slice, i) => (
          <span key={slice.name} className="flex items-center gap-1.5 text-xs text-text-secondary">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: slice.color ?? CHART_COLORS[i % CHART_COLORS.length] }}
            />
            <span className="max-w-[9rem] truncate">{slice.name}</span>
            <span className="font-mono text-text-faint">{slice.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------- yatay sıralama (ranking) ---- */

export interface RankRow {
  label: string;
  value: number;
  /** İkincil, sağda gri gösterilen değer (ör. "4.6 ★"). */
  meta?: string;
}

/**
 * Az satırlı sıralama listeleri için hafif çubuk gösterimi —
 * performans / ilçe / personel / stok kırılımlarında kullanılır. recharts'a
 * geçmedi (bilinçli): bu bir eksen/tooltip gerektiren "grafik" değil, düz bir
 * liste + doluluk çubuğu — mevcut CSS animasyonu (animate-grow-bar) yeterli.
 */
export function RankBars({ rows, emptyLabel = "Veri yok", loading }: { rows: RankRow[]; emptyLabel?: string; loading?: boolean }) {
  if (loading) return <ChartSkeleton />;
  if (rows.length === 0) return <EmptyChart label={emptyLabel} />;
  const max = Math.max(1, ...rows.map((r) => r.value));

  return (
    <ul className="flex h-full flex-col justify-center gap-3 overflow-y-auto pr-1">
      {rows.map((row, i) => (
        <li key={row.label} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-subtle font-mono text-2xs font-semibold text-text-faint">
                {i + 1}
              </span>
              <span className="truncate text-text-primary">{row.label}</span>
            </span>
            <span className="shrink-0 font-mono text-xs text-text-secondary">
              {row.meta ?? new Intl.NumberFormat("tr-TR").format(row.value)}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
            <div
              className="h-full origin-left rounded-full animate-grow-bar"
              style={{
                width: `${(row.value / max) * 100}%`,
                background: CHART_COLORS[i % CHART_COLORS.length],
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

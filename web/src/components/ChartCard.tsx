"use client";

import { useId, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/**
 * Panel genelindeki tek grafik dili.
 *
 * Grafik türü ne olursa olsun dış kabuk (başlık, ikon, açıklama, sağ üst aksiyon)
 * aynı `ChartCard` sarmalayıcısından gelir; renkler CHART_COLORS'tan okunur.
 * Yeni bir grafik eklerken buradaki bileşenlerden birini kullanın.
 *
 * Grafikler bağımlılıksız, doğrudan SVG ile çizilir: bu makineden npm registry'ye
 * yapılan istekler ECONNRESET verdiği için recharts kurulamadı. Dışa açılan API
 * (ChartCard / SimpleBarChart / TrendChart / DonutChart / RankBars) recharts'ın veri
 * sözleşmesiyle aynı tutuldu — paket kurulabildiğinde yalnızca bu dosyanın gövdesi
 * değiştirilerek geçilebilir, çağıran sayfalarda hiçbir değişiklik gerekmez.
 */

export const CHART_COLORS = ["#2F5233", "#3D8A4E", "#61A870", "#94C79E", "#B57F13", "#1F6FA8"];

const GRID = "#E3E8E3";
const AXIS_TEXT = "#8B9A8E";

function formatValue(value: number, currency?: boolean): string {
  if (currency) return `${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(value)} ₺`;
  return new Intl.NumberFormat("tr-TR").format(value);
}

/** Eksen etiketleri için kısa gösterim (12.500 → 12,5B). */
function compact(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(".0", "")}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1).replace(".0", "")}B`;
  return String(Math.round(value));
}

/** Y ekseni için okunabilir "güzel" üst sınır ve ara değerler. */
function niceScale(max: number, tickCount = 4): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / tickCount;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = ([1, 2, 2.5, 5, 10].find((m) => m * mag >= raw) ?? 10) * mag;
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
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
    <div className={`flex flex-col rounded-2xl border border-border bg-surface-card p-5 shadow-card ${className}`}>
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

function Legend({ items }: { items: { name: string; color: string }[] }) {
  if (items.length < 2) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
      {items.map((item) => (
        <span key={item.name} className="flex items-center gap-1.5 text-xs text-text-secondary">
          <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
          {item.name}
        </span>
      ))}
    </div>
  );
}

/** Y ekseni etiket sütunu — SVG ölçek bozulmasından etkilenmesin diye HTML katmanında. */
function YAxis({ ticks }: { ticks: number[] }) {
  return (
    <div className="pointer-events-none absolute inset-y-0 -left-10 flex w-9 flex-col justify-between text-right">
      {[...ticks].reverse().map((tick) => (
        <span key={tick} className="text-[10px] leading-none" style={{ color: AXIS_TEXT }}>
          {compact(tick)}
        </span>
      ))}
    </div>
  );
}

function XAxis({ labels, active }: { labels: string[]; active: number | null }) {
  return (
    <div className="mt-1.5 flex">
      {labels.map((label, i) => (
        <span
          key={`${label}-${i}`}
          className="flex-1 truncate px-0.5 text-center text-[10px]"
          style={{ color: active === i ? "#16211A" : AXIS_TEXT }}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

function Tooltip({
  index,
  count,
  title,
  rows,
}: {
  index: number;
  count: number;
  title: string;
  rows: { name: string; color: string; value: string }[];
}) {
  const left = ((index + 0.5) / count) * 100;
  return (
    <div
      className="pointer-events-none absolute top-1 z-10 rounded-xl border border-border bg-surface-base px-3 py-2 text-xs shadow-pop"
      style={{
        left: `${left}%`,
        transform: `translateX(${left > 75 ? "-90%" : left < 25 ? "-10%" : "-50%"})`,
      }}
    >
      <p className="mb-0.5 whitespace-nowrap font-semibold text-text-primary">{title}</p>
      {rows.map((row) => (
        <p key={row.name} className="flex items-center gap-1.5 whitespace-nowrap text-text-secondary">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: row.color }} />
          {row.name}: <span className="font-mono text-text-primary">{row.value}</span>
        </p>
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
}

export function SimpleBarChart<T extends object>({
  data,
  xKey,
  series,
  stacked = false,
  currency,
  emptyLabel,
}: SimpleBarChartProps<T>) {
  const [hover, setHover] = useState<number | null>(null);

  if (data.length === 0) return <EmptyChart label={emptyLabel} />;

  const rows = data as unknown as Record<string, number | string>[];
  const colorOf = (i: number) => series[i].color ?? CHART_COLORS[i % CHART_COLORS.length];

  const groupTotals = rows.map((row) =>
    stacked
      ? series.reduce((sum, s) => sum + Number(row[s.key] ?? 0), 0)
      : Math.max(...series.map((s) => Number(row[s.key] ?? 0)))
  );
  const ticks = niceScale(Math.max(...groupTotals, 0));
  const yMax = ticks[ticks.length - 1] || 1;

  // viewBox 0-100; SVG preserveAspectRatio="none" ile kutuya yayılır.
  const H = 100;
  const slot = 100 / rows.length;

  return (
    <div className="flex h-full flex-col pl-10">
      <div className="relative min-h-0 flex-1">
        <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" className="h-full w-full">
          {ticks.map((tick) => {
            const y = H - (tick / yMax) * H;
            return (
              <line
                key={tick}
                x1={0}
                x2={100}
                y1={y}
                y2={y}
                stroke={GRID}
                strokeWidth={0.4}
                strokeDasharray="1.5 1.5"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}

          {rows.map((row, gi) => {
            let stackBottom = H;
            return series.map((s, si) => {
              const value = Number(row[s.key] ?? 0);
              const h = (value / yMax) * H;
              const barW = stacked ? slot * 0.5 : (slot * 0.62) / series.length;
              const x = stacked ? gi * slot + slot * 0.25 : gi * slot + slot * 0.19 + si * barW;
              const y = stacked ? stackBottom - h : H - h;
              if (stacked) stackBottom -= h;

              return (
                <rect
                  key={`${gi}-${s.key}`}
                  x={x}
                  y={y}
                  width={barW}
                  height={value > 0 ? Math.max(h, 0.8) : 0}
                  fill={colorOf(si)}
                  opacity={hover === null || hover === gi ? 1 : 0.4}
                  rx={0.8}
                />
              );
            });
          })}
        </svg>

        {/* Fare yakalayıcı şeritler — SVG ölçeklemesinden bağımsız çalışsın diye ayrı katman. */}
        <div className="absolute inset-0 flex">
          {rows.map((_, i) => (
            <div key={i} className="flex-1" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
          ))}
        </div>

        <YAxis ticks={ticks} />

        {hover !== null && (
          <Tooltip
            index={hover}
            count={rows.length}
            title={String(rows[hover][xKey])}
            rows={series.map((s, si) => ({
              name: s.name,
              color: colorOf(si),
              value: formatValue(Number(rows[hover][s.key] ?? 0), currency),
            }))}
          />
        )}
      </div>

      <XAxis labels={rows.map((row) => String(row[xKey]))} active={hover} />
      <Legend items={series.map((s, i) => ({ name: s.name, color: colorOf(i) }))} />
    </div>
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
}

export function TrendChart<T extends object>({ data, xKey, series, area = false, currency, emptyLabel }: TrendChartProps<T>) {
  const gradientId = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);

  if (data.length === 0) return <EmptyChart label={emptyLabel} />;

  const rows = data as unknown as Record<string, number | string>[];
  const colorOf = (i: number) => series[i].color ?? CHART_COLORS[i % CHART_COLORS.length];

  const allValues = rows.flatMap((row) => series.map((s) => Number(row[s.key] ?? 0)));
  const ticks = niceScale(Math.max(...allValues, 0));
  const yMax = ticks[ticks.length - 1] || 1;

  const H = 100;
  // Uçtaki noktalar kırpılmasın diye çizim alanı iki yandan biraz içeriden başlar.
  const xAt = (i: number) => (rows.length === 1 ? 50 : (i / (rows.length - 1)) * 100);
  const yAt = (v: number) => H - (v / yMax) * H;

  return (
    <div className="flex h-full flex-col pl-10">
      <div className="relative min-h-0 flex-1">
        <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" className="h-full w-full">
          <defs>
            {series.map((s, i) => (
              <linearGradient key={s.key} id={`${gradientId}-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colorOf(i)} stopOpacity={0.3} />
                <stop offset="100%" stopColor={colorOf(i)} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>

          {ticks.map((tick) => (
            <line
              key={tick}
              x1={0}
              x2={100}
              y1={yAt(tick)}
              y2={yAt(tick)}
              stroke={GRID}
              strokeWidth={0.4}
              strokeDasharray="1.5 1.5"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {hover !== null && (
            <line x1={xAt(hover)} x2={xAt(hover)} y1={0} y2={H} stroke={GRID} strokeWidth={1} vectorEffect="non-scaling-stroke" />
          )}

          {series.map((s, si) => {
            const points = rows.map((row, i) => `${xAt(i)},${yAt(Number(row[s.key] ?? 0))}`).join(" ");
            return (
              <g key={s.key}>
                {area && <polygon points={`0,${H} ${points} 100,${H}`} fill={`url(#${gradientId}-${si})`} />}
                <polyline
                  points={points}
                  fill="none"
                  stroke={colorOf(si)}
                  strokeWidth={2.25}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            );
          })}
        </svg>

        {/* Aktif noktalar: yüzde konumlandırma ölçek bozulmasından etkilenmez. */}
        {hover !== null &&
          series.map((s, si) => (
            <span
              key={s.key}
              className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white"
              style={{
                background: colorOf(si),
                left: `${xAt(hover)}%`,
                top: `${(yAt(Number(rows[hover][s.key] ?? 0)) / H) * 100}%`,
              }}
            />
          ))}

        <div className="absolute inset-0 flex">
          {rows.map((_, i) => (
            <div key={i} className="flex-1" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
          ))}
        </div>

        <YAxis ticks={ticks} />

        {hover !== null && (
          <Tooltip
            index={hover}
            count={rows.length}
            title={String(rows[hover][xKey])}
            rows={series.map((s, si) => ({
              name: s.name,
              color: colorOf(si),
              value: formatValue(Number(rows[hover][s.key] ?? 0), currency),
            }))}
          />
        )}
      </div>

      <XAxis labels={rows.map((row) => String(row[xKey]))} active={hover} />
      <Legend items={series.map((s, i) => ({ name: s.name, color: colorOf(i) }))} />
    </div>
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
}

export function DonutChart({ data, centerValue, centerLabel, emptyLabel }: DonutChartProps) {
  const [hover, setHover] = useState<string | null>(null);
  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) return <EmptyChart label={emptyLabel} />;

  const slices = data.filter((d) => d.value > 0);
  const R = 42;
  const STROKE = 15;
  const circumference = 2 * Math.PI * R;
  let offset = 0;

  const active = hover ? slices.find((s) => s.name === hover) : undefined;

  return (
    <div className="flex h-full flex-col">
      <div className="relative min-h-0 flex-1">
        <svg viewBox="0 0 120 120" className="h-full w-full">
          <g transform="translate(60,60) rotate(-90)">
            {slices.map((slice, i) => {
              const color = slice.color ?? CHART_COLORS[i % CHART_COLORS.length];
              const length = (slice.value / total) * circumference;
              // Dilimler arasında 1.5 birimlik ince boşluk bırakılır.
              const visible = Math.max(0, length - 1.5);
              const el = (
                <circle
                  key={slice.name}
                  r={R}
                  fill="none"
                  stroke={color}
                  strokeWidth={hover === slice.name ? STROKE + 3 : STROKE}
                  strokeDasharray={`${visible} ${circumference - visible}`}
                  strokeDashoffset={-offset}
                  opacity={hover === null || hover === slice.name ? 1 : 0.45}
                  onMouseEnter={() => setHover(slice.name)}
                  onMouseLeave={() => setHover(null)}
                  style={{ transition: "stroke-width 0.15s, opacity 0.15s" }}
                />
              );
              offset += length;
              return el;
            })}
          </g>
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
          {active ? (
            <>
              <span className="text-2xl font-bold tracking-tight text-text-primary">
                %{Math.round((active.value / total) * 100)}
              </span>
              <span className="w-full truncate text-2xs uppercase tracking-wide text-text-faint">{active.name}</span>
            </>
          ) : (
            centerValue && (
              <>
                <span className="text-2xl font-bold tracking-tight text-text-primary">{centerValue}</span>
                {centerLabel && <span className="text-2xs uppercase tracking-wide text-text-faint">{centerLabel}</span>}
              </>
            )
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        {slices.map((slice, i) => (
          <button
            key={slice.name}
            type="button"
            onMouseEnter={() => setHover(slice.name)}
            onMouseLeave={() => setHover(null)}
            className="flex items-center gap-1.5 text-xs text-text-secondary transition hover:text-text-primary"
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: slice.color ?? CHART_COLORS[i % CHART_COLORS.length] }}
            />
            <span className="max-w-[9rem] truncate">{slice.name}</span>
            <span className="font-mono text-text-faint">{slice.value}</span>
          </button>
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
 * performans / ilçe / personel / stok kırılımlarında kullanılır.
 */
export function RankBars({ rows, emptyLabel = "Veri yok" }: { rows: RankRow[]; emptyLabel?: string }) {
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

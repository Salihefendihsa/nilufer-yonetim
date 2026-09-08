"use client";

/**
 * Liste sayfalarının üstünde duran ince durum dağılım şeridi:
 * "12 aktif · 3 bekliyor · 45 tamamlandı" + tek satırlık yığılmış oran çubuğu.
 *
 * [Özet kartlar] → [Grafik] → [Tablo] düzeninin ikinci basamağının hafif
 * karşılığı; tam bir grafiğin fazla kaçtığı liste ekranlarında kullanılır.
 */

export interface StatusSegment {
  label: string;
  count: number;
  /** Ham hex — çubuk ve nokta aynı rengi paylaşsın diye Tailwind sınıfı değil. */
  color: string;
}

interface StatusStripProps {
  segments: StatusSegment[];
  /** Sol başa yazılan toplam etiketi, örn. "60 iş". */
  totalLabel?: string;
  loading?: boolean;
  /** Sağ tarafa ek içerik (buton, filtre vb.). */
  action?: React.ReactNode;
}

export function StatusStrip({ segments, totalLabel, loading, action }: StatusStripProps) {
  const total = segments.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-card p-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {totalLabel && (
            <span className="text-sm font-semibold text-text-primary">
              {loading ? "—" : totalLabel}
            </span>
          )}
          {segments.map((s) => (
            <span key={s.label} className="flex items-center gap-2 text-sm text-text-secondary">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
              <span className="font-mono font-semibold text-text-primary">{loading ? "—" : s.count}</span>
              {s.label}
            </span>
          ))}
        </div>
        {action}
      </div>

      <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-muted">
        {total > 0 &&
          !loading &&
          segments
            .filter((s) => s.count > 0)
            .map((s) => (
              <div
                key={s.label}
                title={`${s.label}: ${s.count}`}
                className="h-full origin-left animate-grow-bar transition-all"
                style={{ width: `${(s.count / total) * 100}%`, background: s.color }}
              />
            ))}
      </div>
    </div>
  );
}

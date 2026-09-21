/**
 * Düz "Yükleniyor..." metni yerine iskelet (shimmer) yer tutucu (tasarım turu
 * #6). `lines` satır sayısı; `rows` verilirse liste kartı deseni (avatar +
 * iki satır) çizilir. `.skeleton` sınıfı globals.css'te tanımlı.
 */
export function LoadingBlock({
  lines = 3,
  rows,
  className = "",
}: {
  lines?: number;
  rows?: number;
  className?: string;
}) {
  if (rows) {
    return (
      <div className={`flex flex-col gap-3 ${className}`} aria-busy="true" aria-label="Yükleniyor">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="skeleton h-9 w-9 shrink-0 rounded-xl" />
            <div className="flex flex-1 flex-col gap-1.5">
              <div className="skeleton h-3.5 w-2/5" />
              <div className="skeleton h-3 w-3/5" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  const widths = ["w-full", "w-11/12", "w-4/5", "w-2/3", "w-3/4"];
  return (
    <div className={`flex flex-col gap-2.5 ${className}`} aria-busy="true" aria-label="Yükleniyor">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className={`skeleton h-3.5 ${widths[i % widths.length]}`} />
      ))}
    </div>
  );
}

/** Grafik kartı için iskelet: eksen + dalgalı çubuklar. */
export function ChartSkeleton() {
  const heights = ["h-2/5", "h-3/5", "h-1/2", "h-4/5", "h-1/3", "h-3/4", "h-1/2", "h-2/3"];
  return (
    <div className="flex h-full items-end gap-2 px-2 pb-2" aria-busy="true" aria-label="Yükleniyor">
      {heights.map((h, i) => (
        <div key={i} className={`skeleton flex-1 rounded-t-md ${h}`} />
      ))}
    </div>
  );
}

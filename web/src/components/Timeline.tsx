import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type TimelineTone = "primary" | "info" | "warning" | "danger" | "neutral";

export interface TimelineItem {
  id: string;
  icon: LucideIcon;
  tone: TimelineTone;
  /** Ana satır: kim, ne yaptı. */
  title: ReactNode;
  /** İkinci satır: hedef, detay. */
  description?: ReactNode;
  /** Sağdaki zaman damgası. */
  timestamp: string;
  /** Başlığın yanında duran küçük etiket (işlem türü vb.). */
  tag?: string;
}

// Tailwind JIT sınıfları birebir string olarak görebilsin diye tam sınıf adları.
const TONE_STYLES: Record<TimelineTone, { dot: string; icon: string; tag: string }> = {
  primary: { dot: "bg-primary-500", icon: "bg-primary-50 text-primary-600 ring-primary-100", tag: "bg-primary-50 text-primary-700" },
  info: { dot: "bg-info-500", icon: "bg-info-50 text-info-500 ring-info-100", tag: "bg-info-50 text-info-600" },
  warning: { dot: "bg-warning-500", icon: "bg-warning-50 text-warning-500 ring-warning-100", tag: "bg-warning-50 text-warning-600" },
  danger: { dot: "bg-danger-500", icon: "bg-danger-50 text-danger-500 ring-danger-100", tag: "bg-danger-50 text-danger-500" },
  neutral: { dot: "bg-neutral-400", icon: "bg-surface-subtle text-text-secondary ring-border", tag: "bg-surface-subtle text-text-secondary" },
};

/**
 * Dikey zaman çizelgesi: solda sürekli bir çizgi, her kayıt için ikon rozeti,
 * sağda zaman damgası. Denetim logları gibi "kim, ne zaman, ne yaptı"
 * akışlarında tablo yerine kullanılır.
 */
export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol className="relative flex flex-col">
      {/* Sürekli dikey çizgi — ilk ve son ikonun ortasında başlayıp biter. */}
      <span aria-hidden className="absolute bottom-6 left-[18px] top-6 w-px bg-border" />

      {items.map((item) => {
        const style = TONE_STYLES[item.tone];
        const Icon = item.icon;

        return (
          <li key={item.id} className="relative flex gap-4 py-3">
            <span
              className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-card ring-1 ${style.icon}`}
            >
              <Icon size={16} strokeWidth={1.75} />
            </span>

            <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-x-4 gap-y-1">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="break-words text-sm font-medium text-text-primary">{item.title}</span>
                  {item.tag && (
                    <span className={`rounded-full px-2 py-0.5 text-2xs font-semibold ${style.tag}`}>{item.tag}</span>
                  )}
                </div>
                {/* break-words: boşluksuz uzun metin (dosya adı, e-posta) dar ekranda sayfayı yana itmesin */}
                {item.description && <p className="mt-0.5 break-words text-sm text-text-secondary">{item.description}</p>}
              </div>

              <span className="shrink-0 rounded-md bg-surface-subtle px-2 py-0.5 font-mono text-2xs text-text-faint">
                {item.timestamp}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

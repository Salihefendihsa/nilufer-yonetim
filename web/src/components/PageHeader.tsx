import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  /** Sağ taraftaki aksiyonlar (birincil buton, dışa aktar vb.). */
  actions?: ReactNode;
}

/**
 * Her sayfanın aynı üst bloğu: ikon + başlık + açıklama, sağda aksiyonlar.
 * Sayfa düzeni deseni: [PageHeader] → [Özet kartlar] → [Grafik] → [Tablo].
 */
export function PageHeader({ title, description, icon: Icon, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        {Icon && (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 ring-1 ring-primary-100">
            <Icon size={20} strokeWidth={1.75} />
          </span>
        )}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">{title}</h1>
          {description && <p className="mt-1 text-sm text-text-secondary">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

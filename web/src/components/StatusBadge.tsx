import type { JobStatus } from "@/lib/types";

const STATUS_LABELS: Record<JobStatus, string> = {
  PENDING: "Bekliyor",
  SCHEDULED: "Planlandı",
  IN_PROGRESS: "Devam Ediyor",
  COMPLETED: "Tamamlandı",
  CANCELLED: "İptal edildi",
};

/**
 * Durum renkleri yeşil skalayla aynı ailede: tamamlanan koyu yeşil, planlanan
 * açık yeşil (süreç yolunda), bekleyen amber, iptal kırmızı. Aynı eşleme
 * StatusStrip ve grafiklerde de kullanılır.
 */
const STATUS_STYLES: Record<JobStatus, { badge: string; mark: string }> = {
  PENDING: { badge: "border-warning-100 bg-warning-50 text-warning-600", mark: "bg-warning-500" },
  SCHEDULED: { badge: "border-primary-200 bg-primary-50 text-primary-600", mark: "bg-primary-400" },
  IN_PROGRESS: { badge: "border-info-100 bg-info-50 text-info-600", mark: "bg-info-500" },
  COMPLETED: { badge: "border-success-100 bg-success-50 text-success-600", mark: "bg-success-500" },
  CANCELLED: { badge: "border-danger-100 bg-danger-50 text-danger-500", mark: "bg-danger-500" },
};

/** Grafik/şerit gibi Tailwind sınıfı alamayan yerler için ham renk değerleri. */
export const STATUS_COLORS: Record<JobStatus, string> = {
  PENDING: "#B57F13",
  SCHEDULED: "#61A870",
  IN_PROGRESS: "#1F6FA8",
  COMPLETED: "#15803D",
  CANCELLED: "#C0392B",
};

export const STATUS_TEXT: Record<JobStatus, string> = STATUS_LABELS;

export function StatusBadge({ status }: { status: JobStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${style.badge}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.mark}`} />
      {STATUS_LABELS[status]}
    </span>
  );
}

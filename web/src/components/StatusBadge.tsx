import type { JobStatus } from "@/lib/types";

const STATUS_LABELS: Record<JobStatus, string> = {
  PENDING: "Bekliyor",
  SCHEDULED: "Planlandı",
  COMPLETED: "Tamamlandı",
  CANCELLED: "İptal edildi",
};

const STATUS_STYLES: Record<JobStatus, { badge: string; mark: string }> = {
  PENDING: { badge: "border-amber-400/30 bg-amber-400/10 text-amber-300", mark: "bg-amber-400" },
  SCHEDULED: { badge: "border-sky-400/30 bg-sky-400/10 text-sky-300", mark: "bg-sky-400" },
  COMPLETED: { badge: "border-primary-greenLight/30 bg-primary-greenLight/10 text-primary-greenLight", mark: "bg-primary-greenLight" },
  CANCELLED: { badge: "border-primary-redLight/30 bg-primary-redLight/10 text-primary-redLight", mark: "bg-primary-redLight" },
};

export function StatusBadge({ status }: { status: JobStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${style.badge}`}>
      <span className={`h-1.5 w-1.5 rotate-45 ${style.mark}`} />
      {STATUS_LABELS[status]}
    </span>
  );
}

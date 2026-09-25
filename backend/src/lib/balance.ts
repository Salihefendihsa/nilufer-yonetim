import { JobStatus, type Prisma } from "@prisma/client";

/**
 * Müşteri bakiyesi = borca yazılan işlerin fiyatı − alınan ödemeler.
 * İPTAL edilen işin fiyatı alacak değildir; eskiden bakiyeye dahil ediliyordu
 * (bkz. docs/HEALTH_AUDIT.md V-3). Bakiye hesaplayan HER yer (ödeme özeti,
 * müşteri listesi/detayı, Excel dışa aktarım, gecikmiş ödeme özeti) bu
 * tanımı kullanmalı ki rakamlar ekranlar arasında tutarlı kalsın.
 */
export const BILLABLE_JOB_WHERE: Prisma.JobWhereInput = { status: { not: JobStatus.CANCELLED } };

export function isBillable(job: { status: JobStatus }): boolean {
  return job.status !== JobStatus.CANCELLED;
}

/** Borca yazılan işlerin fiyat toplamı (iptaller hariç). */
export function billedTotal(jobs: { price: Prisma.Decimal | number | null; status: JobStatus }[]): number {
  return jobs.reduce((sum, job) => (isBillable(job) ? sum + Number(job.price ?? 0) : sum), 0);
}

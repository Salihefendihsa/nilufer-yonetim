import { RecurrenceType } from "@prisma/client";

/** Bir periyodun kaç ay olduğu — hem sonraki iş üretim tarihi hem de aylık
 * düzenli gelir (MRR) normalizasyonu bu tablodan hesaplanır. */
export const RECURRENCE_MONTHS: Record<RecurrenceType, number> = {
  [RecurrenceType.MONTHLY]: 1,
  [RecurrenceType.QUARTERLY]: 3,
  [RecurrenceType.SEMIANNUAL]: 6,
  [RecurrenceType.ANNUAL]: 12,
};

export function addRecurrencePeriod(date: Date, type: RecurrenceType): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + RECURRENCE_MONTHS[type]);
  return next;
}

/**
 * Sözleşme tutarını aylık düzenli gelire (MRR) çevirir: dönem ücreti /
 * dönemin ay sayısı. Tutar veya periyot yoksa 0 döner — uydurma yapılmaz.
 */
export function monthlyRecurringAmount(amount: number | null, type: RecurrenceType | null): number {
  if (!amount || !type) return 0;
  return amount / RECURRENCE_MONTHS[type];
}

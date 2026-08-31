import { RecurrenceType } from "@prisma/client";

export function addRecurrencePeriod(date: Date, type: RecurrenceType): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + (type === RecurrenceType.MONTHLY ? 1 : 3));
  return next;
}

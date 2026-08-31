interface CalendarizableJob {
  serviceType: string;
  scheduledAt: Date | null;
  notes?: string | null;
}

function toGoogleDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

/**
 * Builds a "Google Takvimine Ekle" link using Google's public render template —
 * no API key or OAuth needed, just a query string Google's own /calendar/render page reads.
 * Returns null when the job has no scheduled time (nothing to put on a calendar).
 */
export function buildGoogleCalendarLink(job: CalendarizableJob): string | null {
  if (!job.scheduledAt) return null;

  const start = new Date(job.scheduledAt);
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Nilüfer İlaçlama - ${job.serviceType}`,
    dates: `${toGoogleDate(start)}/${toGoogleDate(end)}`,
  });

  if (job.notes) {
    params.set("details", job.notes);
  }

  return `https://www.google.com/calendar/render?${params.toString()}`;
}

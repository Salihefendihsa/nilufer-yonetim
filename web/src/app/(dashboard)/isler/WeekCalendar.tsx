import { StatusBadge } from "@/components/StatusBadge";
import { formatTime } from "@/lib/format";
import type { Job } from "@/lib/types";

interface WeekCalendarProps {
  jobs: Job[];
  customerNames: Record<string, string>;
}

const DAY_LABELS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function WeekCalendar({ jobs, customerNames }: WeekCalendarProps) {
  const monday = startOfWeek(new Date());
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });

  const today = new Date();

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
      {days.map((day, i) => {
        const dayJobs = jobs.filter((job) => job.scheduledAt && isSameDay(new Date(job.scheduledAt), day));
        const isToday = isSameDay(day, today);

        return (
          <div key={i} className={`flex flex-col gap-3 rounded-2xl p-4 ${isToday ? "bg-primary-green/5" : "bg-surface-card"}`}>
            <div>
              <p className={`text-xs font-medium uppercase tracking-wide ${isToday ? "text-primary-greenLight" : "text-text-faint"}`}>
                {DAY_LABELS[i]}
              </p>
              <p className="text-lg font-semibold text-text-primary">{day.getDate()}</p>
            </div>

            <div className="flex flex-col gap-2">
              {dayJobs.length === 0 ? (
                <p className="text-xs text-text-faint">İş yok</p>
              ) : (
                dayJobs.map((job) => (
                  <div key={job.id} className="rounded-2xl bg-white/[0.04] px-3 py-2">
                    <p className="text-xs font-medium text-text-primary">{customerNames[job.customerId] ?? "Müşteri"}</p>
                    <p className="text-xs text-text-secondary">{formatTime(job.scheduledAt)}</p>
                    <div className="mt-1">
                      <StatusBadge status={job.status} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

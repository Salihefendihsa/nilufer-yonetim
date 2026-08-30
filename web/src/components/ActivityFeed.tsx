import type { ActivityEvent } from "@/lib/types";

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

export function ActivityFeed({ events, loading }: { events: ActivityEvent[]; loading?: boolean }) {
  if (loading) {
    return <p className="py-8 text-center text-sm text-text-faint">Yükleniyor...</p>;
  }

  if (events.length === 0) {
    return <p className="py-8 text-center text-sm text-text-faint">Henüz bir hareket yok.</p>;
  }

  return (
    <ul className="flex flex-col">
      {events.map((event, i) => (
        <li key={`${event.timestamp}-${i}`} className="flex items-baseline gap-4 border-b border-white/5 py-3 last:border-0">
          <span className="shrink-0 font-mono text-xs text-text-faint">{formatTime(event.timestamp)}</span>
          <span className="text-sm text-text-secondary">{event.text}</span>
        </li>
      ))}
    </ul>
  );
}

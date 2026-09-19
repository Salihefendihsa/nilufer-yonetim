/**
 * Bölüm AP (9. tur): minimal RFC 5545 (iCalendar) üretici — bağımlılıksız.
 * `ics`/`ical-generator` paketleri projede yok; ihtiyaç (VCALENDAR + N adet
 * VEVENT, UTC zamanlar, LOCATION/DESCRIPTION) o kadar dar ki ek bağımlılık
 * yerine bu yazıldı (csv.ts ile aynı gerekçe). Kurallar:
 *  - satır sonu CRLF, 75 oktetten uzun satırlar katlanır (devam satırı " ")
 *  - metin alanlarında \ ; , ve satır sonu kaçışlanır (§3.3.11)
 *  - tarihler UTC "YYYYMMDDTHHMMSSZ"
 */

export interface IcsEvent {
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  description?: string | null;
  location?: string | null;
  /** Değişiklik takibi için — yoksa now. */
  lastModified?: Date | null;
}

export function icsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** 75 oktet sınırı — UTF-8 çok baytlı karakteri ortadan bölmez. */
export function foldIcsLine(line: string): string[] {
  const encoder = new TextEncoder();
  const out: string[] = [];
  let current = "";
  let currentBytes = 0;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    const limit = out.length === 0 ? 75 : 74; // devam satırları baştaki boşlukla 75'e tamamlanır
    if (currentBytes + size > limit) {
      out.push(current);
      current = "";
      currentBytes = 0;
    }
    current += ch;
    currentBytes += size;
  }
  out.push(current);
  return out.map((l, i) => (i === 0 ? l : ` ${l}`));
}

export function buildIcsCalendar(events: IcsEvent[], opts: { name: string; prodId?: string; now?: Date }): string {
  const now = opts.now ?? new Date();
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${opts.prodId ?? "-//Nilufer Ilaclama//Personel Takvimi//TR"}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(opts.name)}`,
    // Takvim uygulamalarına yenileme ipucu (Apple/Google destekler).
    "X-PUBLISHED-TTL:PT1H",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
  ];

  for (const ev of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${ev.uid}`);
    lines.push(`DTSTAMP:${icsDate(now)}`);
    lines.push(`DTSTART:${icsDate(ev.start)}`);
    lines.push(`DTEND:${icsDate(ev.end)}`);
    lines.push(`SUMMARY:${escapeIcsText(ev.summary)}`);
    if (ev.location) lines.push(`LOCATION:${escapeIcsText(ev.location)}`);
    if (ev.description) lines.push(`DESCRIPTION:${escapeIcsText(ev.description)}`);
    lines.push(`LAST-MODIFIED:${icsDate(ev.lastModified ?? now)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.flatMap(foldIcsLine).join("\r\n") + "\r\n";
}

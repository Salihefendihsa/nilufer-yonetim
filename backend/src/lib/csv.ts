/**
 * Bölüm AL (8. tur): Bağımlılıksız, RFC 4180 uyumlu küçük CSV ayrıştırıcı.
 * `csv-parse` paketi projede yok; ek bağımlılık eklemek yerine tırnaklı alan,
 * alan içi virgül/yeni satır ve "" kaçışını destekleyen bu ayrıştırıcı kullanılır.
 * Ayraç otomatik saptanır (`,` veya `;` — Excel TR varsayılanı `;`).
 * UTF-8 BOM atılır. Boş satırlar yok sayılır.
 */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

/** İlk satırı başlık kabul edip nesne listesine çevirir; başlıklar trim + lower-case eşlenir. */
export function csvToRecords(text: string): { headers: string[]; records: Record<string, string>[] } {
  const rows = parseCsv(text);
  if (rows.length === 0) return { headers: [], records: [] };
  const headers = rows[0].map((h) => h.trim());
  const records = rows.slice(1).map((cells) => {
    const rec: Record<string, string> = {};
    headers.forEach((h, idx) => {
      rec[h.toLowerCase()] = (cells[idx] ?? "").trim();
    });
    return rec;
  });
  return { headers, records };
}

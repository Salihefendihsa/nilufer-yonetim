/**
 * Grafik / durum şeridi / segment renkleri için tek palet (tasarım turu #7).
 *
 * Tailwind sınıfı alamayan yerler (recharts `fill`/`stroke`, `style={{
 * background }}`) düz bir renk string'i bekler; önceden 8 dosyada sabit hex
 * yazılıydı ve koyu modda kontrast düşüyordu. Değerler globals.css'teki
 * `--chart-*` değişkenlerini okur: koyu modda otomatik parlaklaşırlar.
 *
 * Sıralı seri renkleri için `CHART_COLORS` (components/ChartCard.tsx) kalır;
 * burası ANLAMSAL renkler içindir (başarı/uyarı/tehlike/bilgi/…).
 */
export const chartPalette = {
  /** primary-700 tonu — en koyu marka yeşili (OWNER, ana seri). */
  primary: "rgb(var(--chart-1))",
  /** primary-500 tonu (MANAGER, "işi var", avans). */
  primaryMid: "rgb(var(--chart-2))",
  /** primary-400 tonu (TEAM_LEAD, planlandı, yenilendi). */
  primaryLight: "rgb(var(--chart-3))",
  /** primary-300 tonu (STAFF). */
  primaryFaint: "rgb(var(--chart-4))",
  success: "rgb(var(--chart-success))",
  warning: "rgb(var(--chart-warning))",
  danger: "rgb(var(--chart-danger))",
  /** Daha koyu kırmızı — reddedildi / izin kuyruğu gibi ikinci kırmızı. */
  dangerDeep: "rgb(var(--chart-danger-deep))",
  info: "rgb(var(--chart-info))",
  purple: "rgb(var(--chart-purple))",
  /** Nötr gri (çevrimdışı, saha raporu). */
  neutral: "rgb(var(--chart-neutral))",
  /** Açık gri (karşılaştırma serisi, bilinmeyen). */
  neutralSoft: "rgb(var(--chart-neutral-soft))",
} as const;

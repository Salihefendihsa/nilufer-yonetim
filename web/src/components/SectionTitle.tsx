import type { ReactNode } from "react";

type Size = "sm" | "md" | "lg" | "xl";
type Tone = "default" | "danger" | "eyebrow";

const SIZE_CLASS: Record<Size, string> = {
  sm: "text-sm font-semibold",
  md: "text-base font-semibold",
  lg: "text-lg font-semibold",
  xl: "text-2xl font-bold tracking-tight",
};

const TONE_CLASS: Record<Tone, string> = {
  default: "text-text-primary",
  danger: "text-danger-500",
  // Küçük büyük-harf "eyebrow" başlık — grafik/özet gruplarının üstünde.
  eyebrow: "uppercase tracking-wide text-text-secondary",
};

/**
 * Tek bölüm başlığı bileşeni (tasarım turu #6). Önceden `<h2>` için 8 farklı
 * sınıf kombinasyonu vardı; artık dört boyut × üç ton. Sayfa başlığı
 * `PageHeader`'da (h1) kalır, kart/bölüm/modal başlıkları burada.
 */
export function SectionTitle({
  children,
  size = "md",
  tone = "default",
  className = "",
  as: Tag = "h2",
}: {
  children: ReactNode;
  size?: Size;
  tone?: Tone;
  className?: string;
  as?: "h2" | "h3";
}) {
  return <Tag className={`${SIZE_CLASS[size]} ${TONE_CLASS[tone]} ${className}`.trim()}>{children}</Tag>;
}

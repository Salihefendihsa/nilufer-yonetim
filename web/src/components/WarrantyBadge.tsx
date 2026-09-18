"use client";

import { ShieldCheck } from "lucide-react";
import { formatDate } from "@/lib/format";

/**
 * Bölüm Y (6. tur): garanti hâlâ geçerliyse yeşil rozet; süresi dolmuşsa veya
 * tanımlı değilse hiçbir şey çizmez.
 */
export function WarrantyBadge({ expiresAt }: { expiresAt?: string | null }) {
  if (!expiresAt) return null;
  const end = new Date(expiresAt).getTime();
  const daysLeft = Math.ceil((end - Date.now()) / (24 * 3600 * 1000));
  if (daysLeft <= 0) return null;
  return (
    <span
      title={`Garanti bitişi: ${formatDate(expiresAt)}`}
      className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-2xs font-semibold text-primary-700 ring-1 ring-primary-100"
    >
      <ShieldCheck size={11} strokeWidth={2} />
      Garanti · {daysLeft} gün
    </span>
  );
}

/** İş/randevu formunda müşteri + hizmet türü seçilince gösterilen bilgilendirme (otomatik ücretsizlik yok). */
export function WarrantyNotice({ daysLeft, serviceType }: { daysLeft: number; serviceType: string }) {
  return (
    <p className="flex items-start gap-2 rounded-xl border border-primary-100 bg-primary-50 px-3 py-2 text-xs text-primary-700">
      <ShieldCheck size={14} strokeWidth={2} className="mt-0.5 shrink-0" />
      <span>
        Bu müşterinin <strong>{serviceType}</strong> için devam eden garantisi var — <strong>{daysLeft} gün</strong> kaldı. Ücretlendirmeyi buna göre değerlendirin (otomatik indirim uygulanmaz).
      </span>
    </p>
  );
}

"use client";

import { X } from "lucide-react";

interface DrillDownChipProps {
  label: string;
  onClear: () => void;
}

/** Yönetici Özeti'nden gelen aktif drill-down filtresini gösterir; ✕ ile temizlenir. */
export function DrillDownChip({ label, onClear }: DrillDownChipProps) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-600 ring-1 ring-primary-100">
      <span>Filtre: {label}</span>
      <button type="button" onClick={onClear} aria-label="Filtreyi temizle" className="rounded-full p-0.5 hover:bg-primary-100">
        <X size={12} strokeWidth={2.25} />
      </button>
    </div>
  );
}

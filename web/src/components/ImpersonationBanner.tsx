"use client";

import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { getImpersonationMeta, restoreOwnerSession, type ImpersonationMeta } from "@/lib/auth";

/**
 * OWNER birini impersonate ederken TÜM ekranlarda belirgin şekilde görünür —
 * hesap verebilirlik gereği (bkz. docs/SECURITY.md). "Çık" sunucudaki
 * ImpersonationSession'ı kapatır (token anında geçersiz olur) ve OWNER'ın
 * kendi token'ına geri döner.
 */
export function ImpersonationBanner() {
  const [meta, setMeta] = useState<ImpersonationMeta | null>(null);
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    setMeta(getImpersonationMeta());
  }, []);

  if (!meta) return null;

  async function handleExit() {
    setEnding(true);
    try {
      await api.post("/admin/impersonate/end");
    } catch (err) {
      // Oturum zaten sona ermiş/süresi dolmuş olabilir — yine de OWNER'ın
      // kendi token'ına dönmek istenir, bu yüzden hatayı yutuyoruz.
      if (!(err instanceof ApiError)) console.error(err);
    } finally {
      restoreOwnerSession();
      window.location.href = "/personel";
    }
  }

  return (
    <div className="flex items-center justify-center gap-3 bg-warning-500 px-4 py-2.5 text-sm font-medium text-white">
      <ShieldAlert size={16} strokeWidth={2} />
      <span>
        <strong>{meta.targetFullName}</strong> kullanıcısı olarak görüntüleniyorsunuz — Gerekçe: {meta.reason}
      </span>
      <button
        type="button"
        onClick={handleExit}
        disabled={ending}
        className="ml-2 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold transition hover:bg-white/30 disabled:opacity-60"
      >
        {ending ? "Çıkılıyor..." : "Çık"}
      </button>
    </div>
  );
}

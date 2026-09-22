"use client";

import { useEffect, useState } from "react";
import { LoadingBlock } from "@/components/LoadingBlock";
import { SectionTitle } from "@/components/SectionTitle";
import { Copy, Check, Gift, Users } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/lib/ToastProvider";
import type { CustomerReferral } from "@/lib/types";

/**
 * Bölüm P (4. tur): Müşteri paneli → "Arkadaşını Davet Et". Kod + kopyalanabilir
 * link + davet edilen sayısı. İndirim/ödül mekanizması bilinçli olarak YOK —
 * yalnızca takip/gösterim (docs: ayrı bir iş kararı gerektirir).
 */
export function ReferralCard() {
  const { showToast } = useToast();
  const [data, setData] = useState<CustomerReferral | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api
      .get<CustomerReferral>("/customers/me/referral")
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Davet bilgisi yüklenemedi"))
      .finally(() => setLoading(false));
  }, []);

  async function copy() {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.inviteLink);
      setCopied(true);
      showToast("Davet linki kopyalandı.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast("Kopyalanamadı — linki elle seçip kopyalayın.");
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface-card p-6 shadow-card">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 ring-1 ring-primary-100">
          <Gift size={17} strokeWidth={1.75} />
        </span>
        <div>
          <SectionTitle>Arkadaşını Davet Et</SectionTitle>
          <p className="text-xs text-text-faint">Linki paylaşın; arkadaşınız teklif isteyip müşterimiz olduğunda burada görünür.</p>
        </div>
      </div>

      {loading ? (
        <LoadingBlock lines={2} className="py-4" />
      ) : error ? (
        <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>
      ) : data ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-col">
              <span className="text-2xs font-semibold uppercase tracking-wide text-text-faint">Davet kodunuz</span>
              <span className="font-mono text-2xl font-bold tracking-widest text-primary-700">{data.referralCode}</span>
            </div>
            <div className="ml-auto flex items-center gap-2 rounded-full bg-surface-subtle px-3 py-1.5 text-xs font-semibold text-text-secondary">
              <Users size={13} strokeWidth={2} />
              {data.referredCount} kişi davetinizle geldi
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-subtle px-3 py-2">
            <input readOnly value={data.inviteLink} onFocus={(e) => e.currentTarget.select()} className="w-full bg-transparent font-mono text-xs text-text-secondary outline-none" />
            <button
              type="button"
              onClick={copy}
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-700"
            >
              {copied ? <Check size={13} strokeWidth={2} /> : <Copy size={13} strokeWidth={2} />}
              {copied ? "Kopyalandı" : "Kopyala"}
            </button>
          </div>

          {data.referred.length > 0 && (
            <ul className="flex flex-col divide-y divide-border">
              {data.referred.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-text-primary">{r.fullName}</span>
                  <span className="text-xs text-text-faint">{new Date(r.createdAt).toLocaleDateString("tr-TR")}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

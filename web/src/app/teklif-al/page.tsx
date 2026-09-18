"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Bug, CheckCircle2, Gift } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { getRecaptchaToken } from "@/lib/recaptcha";

/**
 * Bölüm P (4. tur): Anonim teklif formu — müşterinin "Arkadaşını Davet Et"
 * linkinin (?ref=KOD) hedefi. Kimlik gerektirmez (middleware PUBLIC_PATHS).
 * Kod gövdeyle POST /quotes'a gider; sunucu geçersiz kodu sessizce yoksayar.
 */
export default function QuoteRequestPage() {
  return (
    <Suspense fallback={null}>
      <QuoteRequestContent />
    </Suspense>
  );
}

function QuoteRequestContent() {
  const searchParams = useSearchParams();
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [propertyType, setPropertyType] = useState("Ev");
  const [serviceType, setServiceType] = useState("");
  const [address, setAddress] = useState("");
  const [district, setDistrict] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) setReferralCode(ref.trim().toUpperCase());
  }, [searchParams]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const recaptchaToken = await getRecaptchaToken("quote_request");
      await api.post("/quotes", {
        fullName,
        phone,
        propertyType,
        serviceType,
        address: address || undefined,
        district: district || undefined,
        referralCode: referralCode ?? undefined,
        recaptchaToken,
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Talep gönderilemedi, tekrar deneyin");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-base px-6 py-12">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: "easeOut" }} className="w-full max-w-md">
        <div className="mb-8 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary-600 text-white">
            <Bug size={18} strokeWidth={1.75} />
          </div>
          <span className="text-sm font-semibold text-text-primary">Nilüfer İlaçlama</span>
        </div>

        {sent ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface-card p-8 text-center shadow-card">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary-600">
              <CheckCircle2 size={22} strokeWidth={1.75} />
            </span>
            <h1 className="text-lg font-semibold text-text-primary">Talebiniz Alındı</h1>
            <p className="text-sm text-text-secondary">En kısa sürede sizinle iletişime geçeceğiz.</p>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold tracking-tight text-text-primary">Teklif İste</h1>
            <p className="mt-1 text-sm text-text-secondary">Bilgilerinizi bırakın, ekibimiz sizi arasın.</p>

            {referralCode && (
              <p className="mt-4 flex items-center gap-2 rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm text-primary-700">
                <Gift size={16} strokeWidth={1.75} />
                Bir arkadaşınızın davetiyle geldiniz (kod: <span className="font-mono font-semibold">{referralCode}</span>).
              </p>
            )}

            <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-text-secondary">Ad Soyad</label>
                <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className="input" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-text-secondary">Telefon</label>
                <input required value={phone} onChange={(e) => setPhone(e.target.value)} className="input" placeholder="05xx xxx xx xx" />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-text-secondary">Konut Türü</label>
                  <select value={propertyType} onChange={(e) => setPropertyType(e.target.value)} className="input">
                    <option value="Ev">Ev</option>
                    <option value="Apartman">Apartman</option>
                    <option value="İşyeri">İşyeri</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-text-secondary">Hizmet</label>
                  <input required value={serviceType} onChange={(e) => setServiceType(e.target.value)} className="input" placeholder="Örn. Genel İlaçlama" />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-text-secondary">Adres (opsiyonel)</label>
                <input value={address} onChange={(e) => setAddress(e.target.value)} className="input" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-text-secondary">Semt (opsiyonel)</label>
                <input value={district} onChange={(e) => setDistrict(e.target.value)} className="input" />
              </div>

              {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

              <button
                type="submit"
                disabled={saving}
                className="rounded-2xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white shadow-card transition hover:bg-primary-700 disabled:opacity-60"
              >
                {saving ? "Gönderiliyor..." : "Talebi Gönder"}
              </button>

              <p className="text-center text-xs text-text-faint">
                Bu site reCAPTCHA ile korunmaktadır. Google{" "}
                <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-text-secondary">
                  Gizlilik Politikası
                </a>{" "}
                ve{" "}
                <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-text-secondary">
                  Kullanım Şartları
                </a>{" "}
                geçerlidir.
              </p>
            </form>
          </>
        )}
      </motion.div>
    </main>
  );
}

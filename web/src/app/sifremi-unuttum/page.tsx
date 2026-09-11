"use client";

import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { Bug, MailCheck } from "lucide-react";
import { api, ApiError } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "İstek gönderilemedi, tekrar deneyin");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-base px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-sm"
      >
        <div className="mb-8 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary-600 text-white">
            <Bug size={18} strokeWidth={1.75} />
          </div>
          <span className="text-sm font-semibold text-text-primary">Nilüfer İlaçlama</span>
        </div>

        {sent ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface-card p-8 text-center shadow-card">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary-600">
              <MailCheck size={22} strokeWidth={1.75} />
            </span>
            <h1 className="text-lg font-semibold text-text-primary">Bağlantı Gönderildi</h1>
            <p className="text-sm text-text-secondary">
              Bu e-posta adresi sistemde kayıtlıysa, şifrenizi sıfırlamak için bir bağlantı gönderildi.
              Gelen kutunuzu (ve spam klasörünü) kontrol edin.
            </p>
            <a href="/giris" className="mt-2 text-sm font-medium text-primary-600 hover:underline">
              Girişe dön
            </a>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold tracking-tight text-text-primary">Şifremi Unuttum</h1>
            <p className="mt-1 text-sm text-text-secondary">
              Hesabınıza kayıtlı e-posta adresini girin, size bir sıfırlama bağlantısı gönderelim.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-sm font-medium text-text-secondary">
                  E-posta
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ornek@nilufer.com"
                  className="input"
                />
              </div>

              {error && (
                <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-2 rounded-2xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white shadow-card transition hover:bg-primary-700 disabled:opacity-60"
              >
                {loading ? "Gönderiliyor..." : "Sıfırlama Bağlantısı Gönder"}
              </button>

              <a href="/giris" className="text-center text-sm font-medium text-text-secondary hover:text-text-primary hover:underline">
                Girişe dön
              </a>
            </form>
          </>
        )}
      </motion.div>
    </main>
  );
}

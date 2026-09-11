"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Bug, CheckCircle2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError("Şifreler eşleşmiyor");
      return;
    }
    if (newPassword.length < 8) {
      setError("Şifre en az 8 karakter olmalıdır");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, newPassword });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Şifre sıfırlanamadı, bağlantının süresi dolmuş olabilir");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="rounded-2xl border border-danger-100 bg-danger-50 p-6 text-center text-sm text-danger-500">
        Geçersiz sıfırlama bağlantısı. Lütfen e-postanızdaki bağlantıyı kullanın.
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface-card p-8 text-center shadow-card">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success-50 text-success-500">
          <CheckCircle2 size={22} strokeWidth={1.75} />
        </span>
        <h1 className="text-lg font-semibold text-text-primary">Şifreniz Güncellendi</h1>
        <p className="text-sm text-text-secondary">Yeni şifrenizle giriş yapabilirsiniz.</p>
        <a href="/giris" className="mt-2 rounded-2xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition hover:bg-primary-700">
          Girişe git
        </a>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-text-primary">Yeni Şifre Belirle</h1>
      <p className="mt-1 text-sm text-text-secondary">Hesabınız için yeni bir şifre girin.</p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="newPassword" className="text-sm font-medium text-text-secondary">
            Yeni Şifre
          </label>
          <input
            id="newPassword"
            type="password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="En az 8 karakter"
            className="input"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="confirmPassword" className="text-sm font-medium text-text-secondary">
            Yeni Şifre (Tekrar)
          </label>
          <input
            id="confirmPassword"
            type="password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
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
          {loading ? "Kaydediliyor..." : "Şifreyi Güncelle"}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
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

        <Suspense fallback={<p className="text-sm text-text-faint">Yükleniyor...</p>}>
          <ResetPasswordForm />
        </Suspense>
      </motion.div>
    </main>
  );
}

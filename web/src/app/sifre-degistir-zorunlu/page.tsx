"use client";

import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { ShieldAlert } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { persistChangedPasswordSession, type AuthUser } from "@/lib/auth";

interface ChangePasswordResponse {
  token: string;
  user: AuthUser;
}

export default function ForcedChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const data = await api.post<ChangePasswordResponse>("/auth/change-password", { currentPassword, newPassword });
      persistChangedPasswordSession(data.token, data.user);
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Şifre değiştirilemedi");
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
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-warning-50 text-warning-600">
            <ShieldAlert size={22} strokeWidth={1.75} />
          </span>
          <h1 className="text-xl font-bold tracking-tight text-text-primary">Şifrenizi Değiştirin</h1>
          <p className="text-sm text-text-secondary">
            Hesabınızın şifresi bir yönetici tarafından sıfırlandı. Devam etmeden önce yeni bir şifre belirlemeniz gerekiyor.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-card p-6 shadow-card">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="currentPassword" className="text-sm font-medium text-text-secondary">
              Geçici Şifre
            </label>
            <input
              id="currentPassword"
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="input"
            />
          </div>

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
            {loading ? "Kaydediliyor..." : "Şifreyi Değiştir ve Devam Et"}
          </button>
        </form>
      </motion.div>
    </main>
  );
}

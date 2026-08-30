"use client";

import { useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bug, ShieldCheck, Clock, Sparkles } from "lucide-react";
import { login, logout, type Role } from "@/lib/auth";
import { ApiError } from "@/lib/api";

interface RoleTab {
  role: Role;
  label: string;
}

const ROLE_TABS: RoleTab[] = [
  { role: "OWNER", label: "Patron" },
  { role: "MANAGER", label: "Müdür" },
  { role: "TEAM_LEAD", label: "Şef" },
  { role: "STAFF", label: "Personel" },
  { role: "CUSTOMER", label: "Müşteri" },
];

const BRAND_BULLETS = [
  { icon: ShieldCheck, text: "Ruhsatlı ürünler ve uzman ekiple güvenli uygulama" },
  { icon: Clock, text: "Zamanında randevu, anında bilgilendirme" },
  { icon: Sparkles, text: "Uygulama sonrası takip ve garanti" },
];

export default function GirisPage() {
  const [selectedTab, setSelectedTab] = useState<RoleTab>(ROLE_TABS[0]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await login(email, password);

      if (user.role !== selectedTab.role) {
        const actualLabel = ROLE_TABS.find((t) => t.role === user.role)?.label ?? user.role;
        logout({ redirect: false });
        setError(`Bu hesap "${actualLabel}" rolüne ait, lütfen doğru sekmeyi seçin.`);
        return;
      }

      // Full reload (not router.push) so AuthProvider remounts and re-reads the
      // freshly-written localStorage session instead of keeping its stale
      // pre-login (unauthenticated) React state.
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Giriş yapılamadı, lütfen tekrar deneyin");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen bg-background">
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-ink px-12 py-12 text-white lg:flex">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary-green/20 via-transparent to-transparent" />
        <div
          className="pointer-events-none absolute inset-0 opacity-5"
          style={{
            backgroundImage: "radial-gradient(circle, #D4AE3D 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />

        <div className="relative flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary-green/20 text-primary-greenLight">
            <Bug size={18} strokeWidth={1.75} />
          </div>
          <span className="text-sm font-semibold">Nilüfer İlaçlama</span>
        </div>

        <div className="relative flex flex-col gap-8">
          <h1 className="max-w-md font-serif text-4xl font-semibold leading-tight tracking-tight">
            Eviniz Güvende, Yaşamınız Rahat
          </h1>
          <ul className="flex flex-col gap-4">
            {BRAND_BULLETS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-white/80">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-card/10">
                  <Icon size={15} strokeWidth={1.75} />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/40">© {new Date().getFullYear()} Nilüfer İlaçlama</p>
      </div>

      <div className="flex w-full flex-col items-center justify-center px-6 py-12 lg:w-1/2">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="w-full max-w-sm"
        >
          <div className="mb-8 flex flex-wrap gap-1.5 rounded-2xl bg-white/5 p-1.5">
            {ROLE_TABS.map((tab) => (
              <button
                key={tab.role}
                type="button"
                onClick={() => {
                  setSelectedTab(tab);
                  setError(null);
                }}
                className={`flex-1 rounded-2xl border-b-2 px-2.5 py-2 text-xs font-semibold transition sm:text-sm ${
                  selectedTab.role === tab.role
                    ? "border-primary-gold bg-primary-green text-white shadow-sm"
                    : "border-transparent text-text-secondary hover:bg-white/5 hover:text-text-primary"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={selectedTab.role}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="mb-8"
            >
              <h2 className="font-serif text-2xl font-semibold tracking-tight text-text-primary">{selectedTab.label} Girişi</h2>
              <p className="mt-1 text-sm text-text-secondary">Devam etmek için hesap bilgilerinizi girin.</p>
            </motion.div>
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-medium text-text-secondary">
                Şifre
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input"
              />
            </div>

            {error && (
              <p className="rounded-2xl bg-primary-red/10 px-4 py-3 text-sm text-primary-redLight">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 rounded-2xl bg-gradient-to-r from-primary-green to-primary-green/90 px-4 py-3 text-sm font-semibold text-white transition hover:shadow-[0_0_20px_rgba(212,174,61,0.22)] disabled:opacity-60"
            >
              {loading ? "Giriş yapılıyor..." : "Giriş yap"}
            </button>
          </form>
        </motion.div>
      </div>
    </main>
  );
}

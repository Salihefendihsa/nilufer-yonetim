"use client";

import { useEffect, useState, type FormEvent } from "react";
import { SectionTitle } from "@/components/SectionTitle";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bug,
  ShieldCheck,
  Clock,
  Sparkles,
  KeyRound,
  Crown,
  Briefcase,
  Users,
  Wrench,
  Home,
  Sun,
  Moon,
  AlertCircle,
  MailCheck,
  ArrowLeft,
} from "lucide-react";
import { login, logout, verifyTwoFactorLogin, type Role, type AuthUser } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import { getRecaptchaToken } from "@/lib/recaptcha";
import { useTheme } from "@/lib/theme";

/**
 * Bölüm R (4. tur): Giriş sayfası yeniden tasarımı.
 * - Split-screen: sol marka paneli (logo, slogan, ince desen), sağ form.
 * - Rol sekmeleri ikonlu; aktif gösterge `layoutId` ile yumuşak kayar.
 * - Tema düğmesi (Bölüm D ThemeProvider'a bağlı).
 * - Giriş → 2FA → Şifremi Unuttum adımları tek sayfada, fade/slide ile;
 *   çok adımlı akışta net ilerleme göstergesi (1/2, 2/2).
 * - Hatalar sakin, açıklayıcı bir kutuda (ikon + kısa metin); ürkütücü değil.
 */

type Step = "login" | "2fa" | "forgot";

interface RoleTab {
  role: Role;
  label: string;
  icon: typeof Crown;
  hint: string;
}

const ROLE_TABS: RoleTab[] = [
  { role: "OWNER", label: "Patron", icon: Crown, hint: "Şirketin tüm görünümü" },
  { role: "MANAGER", label: "Müdür", icon: Briefcase, hint: "Operasyon ve finans yönetimi" },
  { role: "TEAM_LEAD", label: "Şef", icon: Users, hint: "Ekip planlama ve takip" },
  { role: "STAFF", label: "Personel", icon: Wrench, hint: "Günlük işler ve raporlar" },
  { role: "CUSTOMER", label: "Müşteri", icon: Home, hint: "Hizmetleriniz ve randevularınız" },
];

const BRAND_BULLETS = [
  { icon: ShieldCheck, text: "Ruhsatlı ürünler ve uzman ekiple güvenli uygulama" },
  { icon: Clock, text: "Zamanında randevu, anında bilgilendirme" },
  { icon: Sparkles, text: "Uygulama sonrası takip ve garanti" },
];

/** Sunucu mesajlarını daha yumuşak, yol gösterici bir dile çevirir. */
function friendlyError(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) return fallback;
  const msg = err.message.toLowerCase();
  if (err.status === 401 || msg.includes("şifre") || msg.includes("e-posta")) {
    return "E-posta veya şifre eşleşmedi. Yazımı kontrol edip tekrar deneyin.";
  }
  if (err.status === 429) return "Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar deneyin.";
  if (err.status === 403 && msg.includes("pasif")) return err.message;
  return err.message || fallback;
}

const stepVariants = {
  initial: { opacity: 0, x: 16 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -16 },
};

export default function GirisPage() {
  const { theme, setTheme } = useTheme();
  const [selectedTab, setSelectedTab] = useState<RoleTab>(ROLE_TABS[0]);
  const [step, setStep] = useState<Step>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [preToken, setPreToken] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);

  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);

  // Sistem teması yalnızca istemcide okunur (SSR/hidrasyon uyuşmazlığı olmasın).
  const [systemDark, setSystemDark] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  const isDark = theme === "dark" || (theme === "system" && systemDark);

  function goTo(next: Step) {
    setError(null);
    setStep(next);
    if (next === "login") {
      setPreToken(null);
      setTwoFactorCode("");
      setUseRecoveryCode(false);
    }
    if (next === "forgot") {
      setForgotSent(false);
      setForgotEmail(email);
    }
  }

  function finishLogin(user: AuthUser & { mustChangePassword: boolean }) {
    if (user.role !== selectedTab.role) {
      const actualLabel = ROLE_TABS.find((t) => t.role === user.role)?.label ?? user.role;
      logout({ redirect: false });
      setError(`Bu hesap "${actualLabel}" rolüne ait. Üstten "${actualLabel}" sekmesini seçip tekrar deneyin.`);
      goTo("login");
      return;
    }

    // Full reload (not router.push) so AuthProvider remounts and re-reads the
    // freshly-written localStorage session instead of keeping its stale
    // pre-login (unauthenticated) React state.
    window.location.href = user.mustChangePassword ? "/sifre-degistir-zorunlu" : "/";
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const recaptchaToken = await getRecaptchaToken("login");
      const result = await login(email, password, recaptchaToken);

      if (result.twoFactorRequired) {
        setPreToken(result.preToken);
        setStep("2fa");
        return;
      }

      finishLogin(result);
    } catch (err) {
      setError(friendlyError(err, "Giriş yapılamadı, lütfen tekrar deneyin."));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyTwoFactor(e: FormEvent) {
    e.preventDefault();
    if (!preToken) return;
    setError(null);
    setLoading(true);
    try {
      const user = await verifyTwoFactorLogin(
        preToken,
        useRecoveryCode ? { recoveryCode: twoFactorCode.trim() } : { code: twoFactorCode.trim() }
      );
      finishLogin(user);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401 && !useRecoveryCode
          ? "Kod eşleşmedi. Authenticator uygulamanızdaki güncel kodu girin — kodlar 30 saniyede bir değişir."
          : friendlyError(err, "Kod doğrulanamadı, tekrar deneyin.")
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email: forgotEmail });
      setForgotSent(true);
    } catch (err) {
      setError(friendlyError(err, "İstek gönderilemedi, tekrar deneyin."));
    } finally {
      setLoading(false);
    }
  }

  const SelectedIcon = selectedTab.icon;

  return (
    <main className="flex min-h-screen bg-surface-base">
      {/* ── Sol: marka paneli ─────────────────────────────────────────── */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-primary-700 px-12 py-12 text-white lg:flex">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary-500/50 via-transparent to-primary-900/40" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage: "radial-gradient(circle, #FFFFFF 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />
        {/* İnce, pest-control temalı dekor: yumuşak halkalar */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full border border-white/10"
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full border border-white/10"
          animate={{ scale: [1, 1.04, 1] }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className="relative flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 text-white ring-1 ring-white/20">
            <Bug size={19} strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">Nilüfer İlaçlama</p>
            <p className="text-xs text-white/60">Yönetim Paneli</p>
          </div>
        </div>

        <div className="relative flex flex-col gap-8">
          <h1 className="max-w-md font-serif text-4xl font-semibold leading-tight tracking-tight">Eviniz Güvende, Yaşamınız Rahat</h1>
          <ul className="flex flex-col gap-4">
            {BRAND_BULLETS.map(({ icon: Icon, text }, i) => (
              <motion.li
                key={text}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.08, duration: 0.35 }}
                className="flex items-center gap-3 text-sm text-white/85"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-white">
                  <Icon size={15} strokeWidth={1.75} />
                </span>
                {text}
              </motion.li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/50">© {new Date().getFullYear()} Nilüfer İlaçlama</p>
      </div>

      {/* ── Sağ: form ─────────────────────────────────────────────────── */}
      <div className="relative flex w-full flex-col items-center justify-center px-6 py-12 lg:w-1/2">
        <button
          type="button"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          aria-label={isDark ? "Açık temaya geç" : "Koyu temaya geç"}
          className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-surface-card text-text-secondary shadow-card transition hover:text-text-primary"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={isDark ? "sun" : "moon"}
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="flex"
            >
              {isDark ? <Sun size={17} strokeWidth={1.75} /> : <Moon size={17} strokeWidth={1.75} />}
            </motion.span>
          </AnimatePresence>
        </button>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: "easeOut" }} className="w-full max-w-sm">
          {/* Mobil marka başlığı (sol panel gizliyken) */}
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary-600 text-white">
              <Bug size={18} strokeWidth={1.75} />
            </div>
            <span className="text-sm font-semibold text-text-primary">Nilüfer İlaçlama</span>
          </div>

          {/* Rol sekmeleri — yalnızca giriş adımında etkin */}
          <div className={`mb-6 transition-opacity ${step === "login" ? "" : "pointer-events-none opacity-50"}`}>
            <div className="grid grid-cols-5 gap-1 rounded-2xl border border-border bg-surface-subtle p-1">
              {ROLE_TABS.map((tab) => {
                const Icon = tab.icon;
                const active = selectedTab.role === tab.role;
                return (
                  <button
                    key={tab.role}
                    type="button"
                    onClick={() => {
                      setSelectedTab(tab);
                      setError(null);
                    }}
                    className={`relative flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-2xs font-semibold transition sm:text-xs ${
                      active ? "text-white" : "text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="role-tab-indicator"
                        className="absolute inset-0 rounded-xl bg-primary-600 shadow-card"
                        transition={{ type: "spring", stiffness: 420, damping: 34 }}
                      />
                    )}
                    <Icon size={15} strokeWidth={1.75} className="relative" />
                    <span className="relative">{tab.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 flex items-center gap-1.5 px-1 text-xs text-text-faint">
              <SelectedIcon size={12} strokeWidth={1.75} />
              {selectedTab.hint}
            </p>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            {step === "login" && (
              <motion.div key="login" variants={stepVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.2 }}>
                <div className="mb-6">
                  <SectionTitle size="xl">{selectedTab.label} Girişi</SectionTitle>
                  <p className="mt-1 text-sm text-text-secondary">Devam etmek için hesap bilgilerinizi girin.</p>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="email" className="text-sm font-medium text-text-secondary">
                      E-posta
                    </label>
                    <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ornek@nilufer.com" className="input" />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <label htmlFor="password" className="text-sm font-medium text-text-secondary">
                        Şifre
                      </label>
                      <button type="button" onClick={() => goTo("forgot")} className="text-xs font-medium text-primary-600 hover:text-primary-700 hover:underline">
                        Şifremi Unuttum
                      </button>
                    </div>
                    <input id="password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="input" />
                  </div>

                  <ErrorNotice message={error} />

                  <button
                    type="submit"
                    disabled={loading}
                    className="mt-2 rounded-2xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white shadow-card transition hover:bg-primary-700 disabled:opacity-60"
                  >
                    {loading ? "Giriş yapılıyor..." : "Giriş yap"}
                  </button>

                  <RecaptchaNotice />
                </form>
              </motion.div>
            )}

            {step === "2fa" && (
              <motion.div key="2fa" variants={stepVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.2 }}>
                <StepIndicator current={2} total={2} labels={["Hesap", "Doğrulama"]} />
                <div className="mb-6">
                  <SectionTitle size="xl">İki Adımlı Doğrulama</SectionTitle>
                  <p className="mt-1 text-sm text-text-secondary">
                    {useRecoveryCode ? "Kurtarma kodlarınızdan birini girin." : "Authenticator uygulamanızdaki 6 haneli kodu girin."}
                  </p>
                </div>

                <form onSubmit={handleVerifyTwoFactor} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="twoFactorCode" className="text-sm font-medium text-text-secondary">
                      {useRecoveryCode ? "Kurtarma Kodu" : "Doğrulama Kodu"}
                    </label>
                    <input
                      id="twoFactorCode"
                      type="text"
                      inputMode={useRecoveryCode ? "text" : "numeric"}
                      autoComplete="one-time-code"
                      required
                      autoFocus
                      value={twoFactorCode}
                      onChange={(e) => setTwoFactorCode(e.target.value)}
                      placeholder={useRecoveryCode ? "XXXXX-XXXXX" : "123456"}
                      className="input text-center font-mono text-lg tracking-widest"
                    />
                  </div>

                  <ErrorNotice message={error} />

                  <button
                    type="submit"
                    disabled={loading}
                    className="mt-2 rounded-2xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white shadow-card transition hover:bg-primary-700 disabled:opacity-60"
                  >
                    {loading ? "Doğrulanıyor..." : "Doğrula"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setUseRecoveryCode((v) => !v);
                      setTwoFactorCode("");
                      setError(null);
                    }}
                    className="flex items-center justify-center gap-1.5 text-xs font-medium text-text-secondary hover:text-text-primary"
                  >
                    <KeyRound size={13} strokeWidth={1.75} />
                    {useRecoveryCode ? "Authenticator kodu kullan" : "Kurtarma kodu kullan"}
                  </button>

                  <button type="button" onClick={() => goTo("login")} className="flex items-center justify-center gap-1 text-xs font-medium text-text-faint hover:text-text-secondary">
                    <ArrowLeft size={12} strokeWidth={1.75} />
                    Girişe dön
                  </button>
                </form>
              </motion.div>
            )}

            {step === "forgot" && (
              <motion.div key="forgot" variants={stepVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.2 }}>
                <StepIndicator current={forgotSent ? 2 : 1} total={2} labels={["E-posta", "Bağlantı"]} />
                {forgotSent ? (
                  <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface-card p-8 text-center shadow-card">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary-600">
                      <MailCheck size={22} strokeWidth={1.75} />
                    </span>
                    <SectionTitle size="lg">Bağlantı Gönderildi</SectionTitle>
                    <p className="text-sm text-text-secondary">
                      Bu e-posta sistemde kayıtlıysa şifre sıfırlama bağlantısı gönderildi. Gelen kutunuzu (ve spam klasörünü) kontrol edin.
                    </p>
                    <button type="button" onClick={() => goTo("login")} className="mt-2 flex items-center gap-1 text-sm font-medium text-primary-600 hover:underline">
                      <ArrowLeft size={13} strokeWidth={1.75} />
                      Girişe dön
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="mb-6">
                      <SectionTitle size="xl">Şifremi Unuttum</SectionTitle>
                      <p className="mt-1 text-sm text-text-secondary">Hesabınızın e-posta adresini girin, size bir sıfırlama bağlantısı gönderelim.</p>
                    </div>
                    <form onSubmit={handleForgot} className="flex flex-col gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="forgotEmail" className="text-sm font-medium text-text-secondary">
                          E-posta
                        </label>
                        <input id="forgotEmail" type="email" required autoFocus autoComplete="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} placeholder="ornek@nilufer.com" className="input" />
                      </div>

                      <ErrorNotice message={error} />

                      <button
                        type="submit"
                        disabled={loading}
                        className="mt-2 rounded-2xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white shadow-card transition hover:bg-primary-700 disabled:opacity-60"
                      >
                        {loading ? "Gönderiliyor..." : "Bağlantı Gönder"}
                      </button>

                      <button type="button" onClick={() => goTo("login")} className="flex items-center justify-center gap-1 text-xs font-medium text-text-faint hover:text-text-secondary">
                        <ArrowLeft size={12} strokeWidth={1.75} />
                        Girişe dön
                      </button>
                    </form>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </main>
  );
}

/** Sakin, açıklayıcı hata kutusu — kırmızı bağırmaz, ne yapılacağını söyler. */
function ErrorNotice({ message }: { message: string | null }) {
  return (
    <AnimatePresence initial={false}>
      {message && (
        <motion.p
          key={message}
          role="alert"
          initial={{ opacity: 0, y: -4, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: -4, height: 0 }}
          transition={{ duration: 0.18 }}
          className="flex items-start gap-2 overflow-hidden rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500"
        >
          <AlertCircle size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
          <span>{message}</span>
        </motion.p>
      )}
    </AnimatePresence>
  );
}

/** "1/2" ilerleme göstergesi — çok adımlı akışlarda kullanıcının yerini gösterir. */
function StepIndicator({ current, total, labels }: { current: number; total: number; labels: string[] }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <div className="flex flex-1 items-center gap-1.5">
        {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
          <motion.span
            key={n}
            layout
            className={`h-1.5 flex-1 rounded-full ${n <= current ? "bg-primary-600" : "bg-surface-muted"}`}
            transition={{ duration: 0.25 }}
          />
        ))}
      </div>
      <span className="text-xs font-semibold text-text-secondary">
        {current}/{total} · {labels[current - 1]}
      </span>
    </div>
  );
}

function RecaptchaNotice() {
  return (
    <p className="text-center text-xs text-text-faint">
      Bu site reCAPTCHA ile korunmaktadır.{" "}
      <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-text-secondary">
        Gizlilik Politikası
      </a>{" "}
      ve{" "}
      <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-text-secondary">
        Kullanım Şartları
      </a>{" "}
      geçerlidir.
    </p>
  );
}

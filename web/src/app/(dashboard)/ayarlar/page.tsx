"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  Bell,
  Building2,
  CheckCircle2,
  ClipboardList,
  Copy,
  Download,
  HardDrive,
  Info,
  KeyRound,
  Laptop,
  MapPin,
  Moon,
  Pencil,
  Plus,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { RequireRole } from "@/components/RequireRole";
import { JobTemplatesSection } from "./JobTemplatesSection";
import { CustomerTagsSection } from "./CustomerTagsSection";
import { DataDeletionRequestsSection, CustomerDataDeletionSection } from "./DataDeletionSections";
import { PageHeader } from "@/components/PageHeader";
import { Modal } from "@/components/Modal";
import { Toggle } from "@/components/Toggle";
import { useAuth } from "@/lib/AuthProvider";
import { useToast } from "@/lib/ToastProvider";
import { useTheme, type ThemePreference } from "@/lib/theme";
import { api, ApiError, downloadFile } from "@/lib/api";
import type {
  District,
  EvaluationCriterion,
  NotificationPreference,
  ServiceType,
  SettingsMap,
  SystemHealth,
} from "@/lib/types";

export default function SettingsPage() {
  const { user } = useAuth();
  const isOwner = user?.role === "OWNER";
  const canUseTwoFactor = user?.role === "OWNER" || user?.role === "MANAGER";
  // Bölüm T (5. tur): iş şablonları OWNER ve MANAGER tarafından yönetilir.
  const canManageTemplates = canUseTwoFactor;

  return (
    <RequireRole roles={["OWNER", "MANAGER", "TEAM_LEAD", "STAFF", "CUSTOMER"]}>
      <div className="flex flex-col gap-6">
        <PageHeader
          icon={Settings}
          title="Ayarlar"
          description={isOwner ? "İşletme ayarlarınızı buradan yönetin." : "Bildirim tercihlerinizi buradan yönetin."}
        />

        {isOwner && <EmailStatusNote />}

        <ThemeSection />
        <NotificationPreferencesSection isOwner={isOwner} />
        {canUseTwoFactor && <TwoFactorSection />}
        {canManageTemplates && <JobTemplatesSection />}
        {canManageTemplates && <CustomerTagsSection />}

        {/* Bölüm AD (7. tur): KVKK — müşteri talep açar, OWNER sonuçlandırır */}
        {user?.role === "CUSTOMER" && <CustomerDataDeletionSection />}
        {isOwner && <DataDeletionRequestsSection />}

        {isOwner && (
          <>
            <CompanyInfoSection />
            <TargetsSection />
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <ServiceTypesSection />
              <DistrictsSection />
            </div>
            <EvaluationCriteriaSection />
            <BackupSection />
            <DangerZoneSection />
          </>
        )}
      </div>
    </RequireRole>
  );
}

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: LucideIcon }[] = [
  { value: "light", label: "Açık", icon: Sun },
  { value: "dark", label: "Koyu", icon: Moon },
  { value: "system", label: "Sistem", icon: Laptop },
];

/** Bölüm D (2. tur): herkese açık (kişisel tercih) — bkz. lib/theme.tsx. */
function ThemeSection() {
  const { theme, setTheme } = useTheme();

  return (
    <SectionCard icon={Sun} title="Görünüm" description="Panelin açık, koyu veya cihazınızın sistem ayarına uyan temada görünmesini seçin.">
      <div className="flex w-fit gap-1 rounded-2xl border border-border bg-surface-subtle p-1">
        {THEME_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setTheme(opt.value)}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition ${
              theme === opt.value ? "bg-primary-600 text-white shadow-card" : "text-text-secondary hover:bg-surface-base"
            }`}
          >
            <opt.icon size={14} strokeWidth={1.75} />
            {opt.label}
          </button>
        ))}
      </div>
    </SectionCard>
  );
}

function NotificationPreferencesSection({ isOwner }: { isOwner: boolean }) {
  const [preference, setPreference] = useState<NotificationPreference | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get<NotificationPreference>("/notification-preferences")
      .then(setPreference)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Bildirim tercihleri yüklenemedi"))
      .finally(() => setLoading(false));
  }, []);

  const { showToast } = useToast();

  async function handleChange(field: "emailEnabled" | "dailyDigestEnabled", value: boolean) {
    if (!preference) return;
    setSaving(true);
    setError(null);
    const previous = preference;
    setPreference({ ...preference, [field]: value });
    try {
      const updated = await api.patch<NotificationPreference>("/notification-preferences", { [field]: value });
      setPreference(updated);
      showToast("Bildirim tercihi güncellendi.");
    } catch (err) {
      setPreference(previous);
      setError(err instanceof ApiError ? err.message : "Güncellenemedi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard
      icon={Bell}
      title="Bildirim Tercihleri"
      description="Sistem bildirimlerini email olarak da almak isteyip istemediğinizi seçin."
    >
      {loading ? (
        <p className="text-sm text-text-secondary">Yükleniyor...</p>
      ) : !preference ? (
        <p className="text-sm text-text-secondary">Bildirim tercihleri yüklenemedi.</p>
      ) : (
        <div className="flex flex-col gap-5">
          {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-text-primary">Email Bildirimleri</p>
              <p className="text-sm text-text-secondary">Size ait bildirimler (iş, ödeme, onay vb.) email olarak da gönderilsin.</p>
            </div>
            <Toggle
              checked={preference.emailEnabled}
              disabled={saving}
              onChange={(value) => handleChange("emailEnabled", value)}
              label="Email Bildirimleri"
            />
          </div>

          {isOwner && (
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-text-primary">Günlük Özet</p>
                <p className="text-sm text-text-secondary">Her sabah 07:00&apos;de günün özetini email olarak alın.</p>
              </div>
              <Toggle
                checked={preference.dailyDigestEnabled}
                disabled={saving}
                onChange={(value) => handleChange("dailyDigestEnabled", value)}
                label="Günlük Özet"
              />
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
}

interface TwoFactorSetupData {
  secret: string;
  otpauthUri: string;
  qrCodeDataUrl: string;
}

/**
 * TOTP tabanlı 2FA — yalnızca OWNER/MANAGER (backend/src/routes/auth.ts).
 * Üç aşama: kurulum (QR + sır göster) → kod ile etkinleştir (kurtarma
 * kodları bir kerelik gösterilir) → devre dışı bırak (mevcut şifre ister).
 */
function TwoFactorSection() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  const [setupData, setSetupData] = useState<TwoFactorSetupData | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  const [disableModalOpen, setDisableModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const me = await api.get<{ twoFactorEnabled: boolean }>("/auth/me");
      setEnabled(me.twoFactorEnabled);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Durum yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleStartSetup() {
    setBusy(true);
    setError(null);
    try {
      const data = await api.post<TwoFactorSetupData>("/auth/2fa/setup");
      setSetupData(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kurulum başlatılamadı");
    } finally {
      setBusy(false);
    }
  }

  async function handleEnable(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ recoveryCodes: string[] }>("/auth/2fa/enable", { code: verifyCode.trim() });
      setRecoveryCodes(res.recoveryCodes);
      setSetupData(null);
      setVerifyCode("");
      setEnabled(true);
      showToast("İki adımlı doğrulama etkinleştirildi.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kod hatalı, tekrar deneyin");
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/auth/2fa/disable", { currentPassword });
      setEnabled(false);
      setDisableModalOpen(false);
      setCurrentPassword("");
      showToast("İki adımlı doğrulama devre dışı bırakıldı.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Devre dışı bırakılamadı");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionCard
      icon={ShieldCheck}
      title="İki Adımlı Doğrulama"
      description="Girişte şifrenize ek olarak authenticator uygulamanızdan (Google Authenticator, Authy vb.) bir kod istenir."
      action={
        enabled !== null && (
          <span
            className={`rounded-full px-2.5 py-1 text-2xs font-semibold ${
              enabled ? "bg-primary-50 text-primary-600" : "bg-surface-subtle text-text-faint"
            }`}
          >
            {enabled ? "Etkin" : "Devre dışı"}
          </span>
        )
      }
    >
      {loading ? (
        <p className="text-sm text-text-secondary">Yükleniyor...</p>
      ) : (
        <div className="flex flex-col gap-4">
          {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

          {recoveryCodes && (
            <div className="rounded-2xl border border-warning-100 bg-warning-50 p-4">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-warning-700">
                <CheckCircle2 size={15} strokeWidth={1.75} />
                Kurtarma Kodlarınız — bir daha gösterilmeyecek
              </p>
              <p className="mb-3 text-xs text-text-secondary">
                Authenticator cihazınıza erişemediğinizde bu kodlardan birini kullanabilirsiniz. Güvenli bir yerde
                saklayın.
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {recoveryCodes.map((code) => (
                  <code key={code} className="rounded-xl bg-surface-card px-2 py-1.5 text-center text-xs font-mono">
                    {code}
                  </code>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setRecoveryCodes(null)}
                className="mt-3 text-xs font-medium text-text-secondary hover:text-text-primary"
              >
                Kaydettim, kapat
              </button>
            </div>
          )}

          {enabled === false && !setupData && !recoveryCodes && (
            <button type="button" disabled={busy} onClick={handleStartSetup} className="btn-primary w-fit">
              <KeyRound size={16} strokeWidth={1.75} />
              Kurulumu Başlat
            </button>
          )}

          {setupData && (
            <form onSubmit={handleEnable} className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-subtle p-4">
              <p className="text-sm text-text-secondary">
                Authenticator uygulamanızla aşağıdaki QR kodu okutun veya sırrı manuel girin, ardından uygulamanın
                gösterdiği 6 haneli kodu aşağıya yazın.
              </p>
              {/* bg-white kasıtlı — QR kod okunabilirliği için koyu modda bile beyaz zemin gerekir. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={setupData.qrCodeDataUrl} alt="2FA QR kodu" className="h-40 w-40 self-center rounded-xl border border-border bg-white p-2" />
              <div className="flex items-center gap-2 self-center">
                <code className="rounded-xl bg-surface-card px-3 py-1.5 text-xs font-mono">{setupData.secret}</code>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(setupData.secret)}
                  aria-label="Sırrı kopyala"
                  className="flex h-7 w-7 items-center justify-center rounded-xl text-text-faint transition hover:bg-surface-base hover:text-text-primary"
                >
                  <Copy size={14} strokeWidth={1.75} />
                </button>
              </div>
              <input
                autoFocus
                required
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value)}
                placeholder="6 haneli kod"
                className="input text-center font-mono tracking-widest"
              />
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setSetupData(null)} className="btn-ghost">
                  Vazgeç
                </button>
                <button type="submit" disabled={busy} className="btn-primary">
                  {busy ? "Doğrulanıyor..." : "Etkinleştir"}
                </button>
              </div>
            </form>
          )}

          {enabled === true && (
            <button type="button" onClick={() => setDisableModalOpen(true)} className="btn-danger w-fit">
              Devre Dışı Bırak
            </button>
          )}
        </div>
      )}

      <Modal open={disableModalOpen} onClose={() => setDisableModalOpen(false)} title="İki Adımlı Doğrulamayı Devre Dışı Bırak">
        <form onSubmit={handleDisable} className="flex flex-col gap-4">
          <p className="text-sm text-text-secondary">Devam etmek için mevcut şifrenizi girin.</p>
          <input
            autoFocus
            required
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="input"
            placeholder="Mevcut şifre"
          />
          {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}
          <div className="mt-2 flex justify-end gap-3">
            <button type="button" onClick={() => setDisableModalOpen(false)} className="btn-ghost">
              Vazgeç
            </button>
            <button type="submit" disabled={busy} className="btn-danger">
              {busy ? "İşleniyor..." : "Devre Dışı Bırak"}
            </button>
          </div>
        </form>
      </Modal>
    </SectionCard>
  );
}

function EmailStatusNote() {
  const [emailConfigured, setEmailConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    api
      .get<SystemHealth>("/system/health")
      .then((res) => setEmailConfigured(res.emailConfigured))
      .catch(() => setEmailConfigured(null));
  }, []);

  if (emailConfigured !== false) return null;

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-warning-100 bg-warning-50 px-5 py-4">
      <Info size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-warning-500" />
      <p className="text-sm text-text-secondary">
        Email yapılandırılmadığı için şifre sıfırlama ve bildirim e-postaları şu an gönderilemiyor — SMTP ayarları
        eklenince otomatik aktifleşir.
      </p>
    </div>
  );
}

/**
 * Her ayar grubu kendi kartında: ikon rozeti + başlık + açıklama, altında içerik.
 * Panelin diğer sayfalarındaki ChartCard/StatCard kabuğuyla aynı köşe yarıçapı,
 * kenarlık ve gölge kurallarını kullanır.
 */
function SectionCard({
  title,
  description,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  description?: string;
  icon: LucideIcon;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-surface-card p-6 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 ring-1 ring-primary-100">
            <Icon size={17} strokeWidth={1.75} />
          </span>
          <div>
            <h2 className="text-base font-semibold text-text-primary">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-text-secondary">{description}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className="mt-5 flex-1">{children}</div>
    </div>
  );
}

const COMPANY_FIELDS: { key: string; label: string }[] = [
  { key: "company_name", label: "Firma Adı" },
  { key: "company_phone", label: "Telefon" },
  { key: "company_email", label: "E-posta" },
  { key: "company_address", label: "Adres" },
];

function CompanyInfoSection() {
  const [form, setForm] = useState<SettingsMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    api
      .get<{ data: SettingsMap }>("/settings")
      .then((res) => setForm(res.data))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Ayarlar yüklenemedi"))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = Object.fromEntries(COMPANY_FIELDS.map((f) => [f.key, form[f.key] ?? ""]));
      const res = await api.patch<{ data: SettingsMap }>("/settings", payload);
      setForm(res.data);
      showToast("Firma bilgileri kaydedildi.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kaydedilemedi, tekrar deneyin");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard
      icon={Building2}
      title="Firma Bilgileri"
      description="Bu bilgiler raporlarda ve müşteriye görünen belgelerde kullanılır."
    >
      {loading ? (
        <p className="text-sm text-text-secondary">Yükleniyor...</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {COMPANY_FIELDS.map((field) => (
            <div key={field.key} className="flex flex-col">
              <label className="label">{field.label}</label>
              <input
                value={form[field.key] ?? ""}
                onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                className="input"
              />
            </div>
          ))}

          {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

          <div className="mt-2 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="btn-primary"
            >
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </div>
        </form>
      )}
    </SectionCard>
  );
}

/**
 * Aylık hedefler yalnızca işletme sahibi tarafından yönetilir; müdür bunları
 * /settings üzerinden değil, iş uçlarının yanıtındaki `monthlyTarget` /
 * `monthlyRevenueTarget` alanları üzerinden yalnızca okuyabilir
 * (bkz. backend/src/lib/targets.ts).
 */
const TARGET_FIELDS: { key: string; label: string; hint: string }[] = [
  { key: "monthly_job_target", label: "Kişi Başı Aylık İş Hedefi", hint: "Boş bırakılırsa hedef göstergeleri gizlenir." },
  { key: "monthly_revenue_target", label: "Aylık Ciro Hedefi (₺)", hint: "Boş bırakılırsa ciro hedefi çubuğu gösterilmez." },
];

function TargetsSection() {
  const [form, setForm] = useState<SettingsMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    api
      .get<{ data: SettingsMap }>("/settings")
      .then((res) => setForm(res.data))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Ayarlar yüklenemedi"))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = Object.fromEntries(TARGET_FIELDS.map((f) => [f.key, (form[f.key] ?? "").trim()]));
      const res = await api.patch<{ data: SettingsMap }>("/settings", payload);
      setForm(res.data);
      showToast("Aylık hedefler kaydedildi.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kaydedilemedi, tekrar deneyin");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard
      icon={Target}
      title="Aylık Hedefler"
      description="Panel ve performans ekranlarındaki hedef göstergeleri bu değerlerden hesaplanır."
    >
      {loading ? (
        <p className="text-sm text-text-secondary">Yükleniyor...</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {TARGET_FIELDS.map((field) => (
            <div key={field.key} className="flex flex-col">
              <label className="label">{field.label}</label>
              <input
                type="number"
                min={0}
                value={form[field.key] ?? ""}
                onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                className="input"
                placeholder="Tanımsız"
              />
              <p className="mt-1 text-xs text-text-faint">{field.hint}</p>
            </div>
          ))}

          {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

          <div className="mt-2 flex justify-end">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </div>
        </form>
      )}
    </SectionCard>
  );
}

function ServiceTypesSection() {
  const [items, setItems] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: ServiceType[] }>("/service-types");
      setItems(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Hizmet türleri yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.post("/service-types", { name: newName.trim() });
      setNewName("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Eklenemedi");
    } finally {
      setBusy(false);
    }
  }

  async function handleRename(id: string) {
    if (!editingName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/service-types/${id}`, { name: editingName.trim() });
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Güncellenemedi");
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleActive(item: ServiceType) {
    setBusy(true);
    setError(null);
    try {
      if (item.isActive) {
        await api.delete(`/service-types/${item.id}`);
      } else {
        await api.patch(`/service-types/${item.id}`, { isActive: true });
      }
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Güncellenemedi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionCard
      icon={Sparkles}
      title="Hizmet Türleri"
      description="Yeni iş oluşturulurken seçilebilecek hizmet türleri."
      action={
        <span className="rounded-full bg-surface-subtle px-2.5 py-1 font-mono text-2xs text-text-faint">
          {items.filter((i) => i.isActive).length} aktif
        </span>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

        {loading ? (
          <p className="text-sm text-text-secondary">Yükleniyor...</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-3">
                {editingId === item.id ? (
                  <input
                    autoFocus
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleRename(item.id)}
                    className="input flex-1"
                  />
                ) : (
                  <span className={`flex flex-wrap items-center gap-2 text-sm ${item.isActive ? "text-text-primary" : "text-text-faint line-through"}`}>
                    {item.name}
                    {/* Bölüm Y (6. tur): varsayılan garanti süresi — tıklanınca düzenlenir */}
                    <button
                      type="button"
                      disabled={busy}
                      title="Varsayılan garanti süresi (gün)"
                      onClick={async () => {
                        const raw = window.prompt(`"${item.name}" için varsayılan garanti süresi (gün) — boş bırakılırsa garanti takibi yapılmaz:`, item.defaultWarrantyDays ? String(item.defaultWarrantyDays) : "");
                        if (raw === null) return;
                        const days = raw.trim() === "" ? null : Number(raw);
                        if (days !== null && (!Number.isInteger(days) || days <= 0)) {
                          setError("Garanti süresi pozitif bir tam sayı olmalı");
                          return;
                        }
                        setBusy(true);
                        try {
                          await api.patch(`/service-types/${item.id}`, { defaultWarrantyDays: days });
                          await load();
                        } catch (err) {
                          setError(err instanceof ApiError ? err.message : "Güncellenemedi");
                        } finally {
                          setBusy(false);
                        }
                      }}
                      className={`rounded-full px-2 py-0.5 text-2xs font-semibold ring-1 transition ${
                        item.defaultWarrantyDays ? "bg-primary-50 text-primary-700 ring-primary-100 hover:bg-primary-100" : "bg-surface-subtle text-text-faint ring-border hover:text-text-secondary"
                      }`}
                    >
                      {item.defaultWarrantyDays ? `Garanti ${item.defaultWarrantyDays} gün` : "Garanti yok"}
                    </button>
                  </span>
                )}

                <div className="flex items-center gap-2">
                  {editingId === item.id ? (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleRename(item.id)}
                        className="rounded-xl border border-primary-100 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700 transition hover:bg-primary-100"
                      >
                        Kaydet
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-xl border border-border bg-surface-base px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
                      >
                        Vazgeç
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(item.id);
                          setEditingName(item.name);
                        }}
                        aria-label="Düzenle"
                        className="flex h-8 w-8 items-center justify-center rounded-xl text-text-faint transition hover:bg-surface-subtle hover:text-text-primary"
                      >
                        <Pencil size={15} strokeWidth={1.75} />
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleToggleActive(item)}
                        className={`rounded-xl px-3 py-1.5 text-xs font-medium transition hover:bg-surface-subtle ${
                          item.isActive ? "text-danger-500" : "text-primary-600"
                        }`}
                      >
                        {item.isActive ? "Pasifleştir" : "Aktifleştir"}
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
            {items.length === 0 && <p className="py-4 text-sm text-text-secondary">Henüz hizmet türü eklenmemiş.</p>}
          </ul>
        )}

        <form onSubmit={handleAdd} className="flex gap-3">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Yeni hizmet türü adı"
            className="input flex-1"
          />
          <button
            type="submit"
            disabled={busy}
            className="btn-primary"
          >
            <Plus size={16} strokeWidth={2} />
            Ekle
          </button>
        </form>
      </div>
    </SectionCard>
  );
}

function DistrictsSection() {
  const [items, setItems] = useState<District[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: District[] }>("/districts");
      setItems(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Bölgeler yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.post("/districts", { name: newName.trim() });
      setNewName("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Eklenemedi");
    } finally {
      setBusy(false);
    }
  }

  async function handleRename(id: string) {
    if (!editingName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/districts/${id}`, { name: editingName.trim() });
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Güncellenemedi");
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleActive(item: District) {
    setBusy(true);
    setError(null);
    try {
      if (item.isActive) {
        await api.delete(`/districts/${item.id}`);
      } else {
        await api.patch(`/districts/${item.id}`, { isActive: true });
      }
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Güncellenemedi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionCard
      icon={MapPin}
      title="Bölgeler"
      description="Müşteri kaydında seçilebilecek ilçeler."
      action={
        <span className="rounded-full bg-surface-subtle px-2.5 py-1 font-mono text-2xs text-text-faint">
          {items.filter((i) => i.isActive).length} aktif
        </span>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

        {loading ? (
          <p className="text-sm text-text-secondary">Yükleniyor...</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-3">
                {editingId === item.id ? (
                  <input
                    autoFocus
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleRename(item.id)}
                    className="input flex-1"
                  />
                ) : (
                  <span className={`text-sm ${item.isActive ? "text-text-primary" : "text-text-faint line-through"}`}>
                    {item.name}
                  </span>
                )}

                <div className="flex items-center gap-2">
                  {editingId === item.id ? (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleRename(item.id)}
                        className="rounded-xl border border-primary-100 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700 transition hover:bg-primary-100"
                      >
                        Kaydet
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-xl border border-border bg-surface-base px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
                      >
                        Vazgeç
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(item.id);
                          setEditingName(item.name);
                        }}
                        aria-label="Düzenle"
                        className="flex h-8 w-8 items-center justify-center rounded-xl text-text-faint transition hover:bg-surface-subtle hover:text-text-primary"
                      >
                        <Pencil size={15} strokeWidth={1.75} />
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleToggleActive(item)}
                        className={`rounded-xl px-3 py-1.5 text-xs font-medium transition hover:bg-surface-subtle ${
                          item.isActive ? "text-danger-500" : "text-primary-600"
                        }`}
                      >
                        {item.isActive ? "Pasifleştir" : "Aktifleştir"}
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
            {items.length === 0 && <p className="py-4 text-sm text-text-secondary">Henüz bölge eklenmemiş.</p>}
          </ul>
        )}

        <form onSubmit={handleAdd} className="flex gap-3">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Yeni bölge adı"
            className="input flex-1"
          />
          <button
            type="submit"
            disabled={busy}
            className="btn-primary"
          >
            <Plus size={16} strokeWidth={2} />
            Ekle
          </button>
        </form>
      </div>
    </SectionCard>
  );
}

/**
 * Formal Değerlendirme sisteminin kriter kataloğu — mevcut basit Performans
 * sayfasından (tamamlanan iş + müşteri puanı) bağımsız, ayrı bir bölüm.
 * Hizmet Türleri/Bölgeler ile aynı CRUD stili (isim + isActive toggle),
 * ek olarak opsiyonel bir açıklama alanı taşır.
 */
function EvaluationCriteriaSection() {
  const [items, setItems] = useState<EvaluationCriterion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: EvaluationCriterion[] }>("/evaluation-criteria");
      setItems(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kriterler yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.post("/evaluation-criteria", {
        name: newName.trim(),
        description: newDescription.trim() || undefined,
      });
      setNewName("");
      setNewDescription("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Eklenemedi");
    } finally {
      setBusy(false);
    }
  }

  async function handleRename(id: string) {
    if (!editingName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/evaluation-criteria/${id}`, { name: editingName.trim() });
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Güncellenemedi");
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleActive(item: EvaluationCriterion) {
    setBusy(true);
    setError(null);
    try {
      if (item.isActive) {
        await api.delete(`/evaluation-criteria/${item.id}`);
      } else {
        await api.patch(`/evaluation-criteria/${item.id}`, { isActive: true });
      }
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Güncellenemedi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionCard
      icon={ClipboardList}
      title="Değerlendirme Kriterleri"
      description="Personel değerlendirme formunda kullanılacak kriterler (1-20 arası puanlanır)."
      action={
        <span className="rounded-full bg-surface-subtle px-2.5 py-1 font-mono text-2xs text-text-faint">
          {items.filter((i) => i.isActive).length} aktif
        </span>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

        {loading ? (
          <p className="text-sm text-text-secondary">Yükleniyor...</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-3">
                {editingId === item.id ? (
                  <input
                    autoFocus
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleRename(item.id)}
                    className="input flex-1"
                  />
                ) : (
                  <span className="flex flex-col">
                    <span className={`text-sm ${item.isActive ? "text-text-primary" : "text-text-faint line-through"}`}>
                      {item.name}
                    </span>
                    {item.description && <span className="text-xs text-text-faint">{item.description}</span>}
                  </span>
                )}

                <div className="flex items-center gap-2">
                  {editingId === item.id ? (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleRename(item.id)}
                        className="rounded-xl border border-primary-100 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700 transition hover:bg-primary-100"
                      >
                        Kaydet
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-xl border border-border bg-surface-base px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
                      >
                        Vazgeç
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(item.id);
                          setEditingName(item.name);
                        }}
                        aria-label="Düzenle"
                        className="flex h-8 w-8 items-center justify-center rounded-xl text-text-faint transition hover:bg-surface-subtle hover:text-text-primary"
                      >
                        <Pencil size={15} strokeWidth={1.75} />
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleToggleActive(item)}
                        className={`rounded-xl px-3 py-1.5 text-xs font-medium transition hover:bg-surface-subtle ${
                          item.isActive ? "text-danger-500" : "text-primary-600"
                        }`}
                      >
                        {item.isActive ? "Pasifleştir" : "Aktifleştir"}
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
            {items.length === 0 && <p className="py-4 text-sm text-text-secondary">Henüz kriter eklenmemiş.</p>}
          </ul>
        )}

        <form onSubmit={handleAdd} className="flex flex-col gap-3 sm:flex-row">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Yeni kriter adı"
            className="input flex-1"
          />
          <input
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Açıklama (opsiyonel)"
            className="input flex-1"
          />
          <button type="submit" disabled={busy} className="btn-primary shrink-0">
            <Plus size={16} strokeWidth={2} />
            Ekle
          </button>
        </form>
      </div>
    </SectionCard>
  );
}

function BackupSection() {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleBackup() {
    setDownloading(true);
    setError(null);
    try {
      const dateStr = new Date().toISOString().slice(0, 10);
      await downloadFile("/admin/backup", `nilufer-yedek-${dateStr}.json`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Yedek alınamadı");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <SectionCard
      icon={HardDrive}
      title="Yedekleme"
      description="Veritabanındaki tüm verilerin bir JSON dosyası olarak indirilmesi."
    >
      <div className="flex flex-col gap-3">
        {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}
        <button
          type="button"
          onClick={handleBackup}
          disabled={downloading}
          className="btn-secondary w-fit"
        >
          <Download size={16} strokeWidth={1.75} />
          {downloading ? "İndiriliyor..." : "Yedek Al"}
        </button>
      </div>
    </SectionCard>
  );
}

const CLEAR_CONFIRM_WORD = "TEMIZLE";

function DangerZoneSection() {
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  function openModal() {
    setConfirmText("");
    setError(null);
    setModalOpen(true);
  }

  async function handleClear() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<{ message: string; deleted: Record<string, number> }>("/admin/clear-demo-data", {
        confirm: confirmText,
      });
      setResult(res.message);
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Silinemedi, tekrar deneyin");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-danger-100 bg-danger-50 p-6 shadow-card">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-surface-card text-danger-500 ring-1 ring-danger-100">
          <AlertTriangle size={18} strokeWidth={1.75} />
        </div>
        <div>
          <h2 className="text-base font-semibold text-danger-500">Tehlikeli Bölge</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Tüm müşteri, iş, sözleşme, ödeme, teklif, mesaj ve avans kayıtlarını kalıcı olarak siler. Kullanıcı
            hesapları ve giriş bilgileri etkilenmez, sisteme giriş yapmaya devam edebilirsiniz.
          </p>
        </div>
      </div>

      {result && <p className="mt-4 rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm font-medium text-primary-700">{result}</p>}

      <div className="mt-5">
        <button
          type="button"
          onClick={openModal}
          className="btn-danger"
        >
          <Trash2 size={16} strokeWidth={1.75} />
          Tüm Demo Verileri Sil
        </button>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Demo Verileri Sil">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-secondary">
            Bu işlem geri alınamaz. Müşteriler, işler, sözleşmeler, ödemeler, teklifler, mesajlar ve avans
            talepleri kalıcı olarak silinecek. Devam etmek için aşağıya <strong>{CLEAR_CONFIRM_WORD}</strong>{" "}
            yazın.
          </p>
          <input
            autoFocus
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="input"
            placeholder={CLEAR_CONFIRM_WORD}
          />

          {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

          <div className="mt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="btn-ghost"
            >
              Vazgeç
            </button>
            <button
              type="button"
              disabled={confirmText !== CLEAR_CONFIRM_WORD || loading}
              onClick={handleClear}
              className="btn-danger"
            >
              {loading ? "Siliniyor..." : "Kalıcı Olarak Sil"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  Bell,
  Building2,
  Download,
  HardDrive,
  Info,
  MapPin,
  Pencil,
  Plus,
  Settings,
  Sparkles,
  Target,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { RequireRole } from "@/components/RequireRole";
import { PageHeader } from "@/components/PageHeader";
import { Modal } from "@/components/Modal";
import { Toggle } from "@/components/Toggle";
import { useAuth } from "@/lib/AuthProvider";
import { useToast } from "@/lib/ToastProvider";
import { api, ApiError, downloadFile } from "@/lib/api";
import type { District, NotificationPreference, ServiceType, SettingsMap, SystemHealth } from "@/lib/types";

export default function SettingsPage() {
  const { user } = useAuth();
  const isOwner = user?.role === "OWNER";

  return (
    <RequireRole roles={["OWNER", "MANAGER", "TEAM_LEAD", "STAFF", "CUSTOMER"]}>
      <div className="flex flex-col gap-6">
        <PageHeader
          icon={Settings}
          title="Ayarlar"
          description={isOwner ? "İşletme ayarlarınızı buradan yönetin." : "Bildirim tercihlerinizi buradan yönetin."}
        />

        {isOwner && <EmailStatusNote />}

        <NotificationPreferencesSection isOwner={isOwner} />

        {isOwner && (
          <>
            <CompanyInfoSection />
            <TargetsSection />
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <ServiceTypesSection />
              <DistrictsSection />
            </div>
            <BackupSection />
            <DangerZoneSection />
          </>
        )}
      </div>
    </RequireRole>
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
        Email yapılandırılmadığı için giriş doğrulama kodu (2FA) şu an devre dışı — SMTP ayarları eklenince
        otomatik aktifleşir.
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
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-danger-500 ring-1 ring-danger-100">
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

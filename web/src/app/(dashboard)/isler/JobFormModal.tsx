"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AlertTriangle } from "lucide-react";
import { WarrantyNotice } from "@/components/WarrantyBadge";
import type { ActiveWarranty } from "@/lib/types";
import { Modal } from "@/components/Modal";
import { useToast } from "@/lib/ToastProvider";
import { api, ApiError } from "@/lib/api";
import type { Customer, Job, JobTemplate, ServiceType, Staff, StaffUnavailability } from "@/lib/types";

/** Bölüm K: seçilen gün için müsait olmayan personel — staffId → kayıtlar. */
type UnavailabilityMap = Record<string, Pick<StaffUnavailability, "startTime" | "endTime" | "reason">[]>;

function describeUnavailability(rows: UnavailabilityMap[string]): string {
  return rows
    .map((r) => (r.startTime && r.endTime ? `${r.startTime}–${r.endTime}` : "tüm gün"))
    .join(", ");
}

const OTHER_SERVICE_TYPE = "__diger__";

interface JobFormModalProps {
  open: boolean;
  onClose: () => void;
  /** Oluşturulan iş (Bölüm J: randevu talebine bağlamak için id gerekir). */
  onSaved: (job: Job) => void;
  customers: Customer[];
  staff: Staff[];
  /** Bölüm E (2. tur): Sözleşmeler → "Şimdi İş Oluştur" kısayolundan önceden doldurulmuş değerler. */
  prefill?: { customerId?: string; serviceType?: string; scheduledAt?: string; notes?: string };
}

export function JobFormModal({ open, onClose, onSaved, customers, staff, prefill }: JobFormModalProps) {
  const [customerId, setCustomerId] = useState("");
  const [assignedStaffId, setAssignedStaffId] = useState("");
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [serviceTypeSelect, setServiceTypeSelect] = useState("");
  const [serviceTypeOther, setServiceTypeOther] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [scheduledEndAt, setScheduledEndAt] = useState("");
  const [notes, setNotes] = useState("");
  const [price, setPrice] = useState("");
  // Bölüm T (5. tur): "Şablondan Doldur" — serviceType/price/notes/bitiş saatini
  // önceden doldurur; kullanıcı her alanı yine değiştirebilir.
  const [templates, setTemplates] = useState<JobTemplate[]>([]);
  const [templateId, setTemplateId] = useState("");

  function applyTemplate(id: string) {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    const matched = serviceTypes.find((s) => s.name === t.serviceType);
    setServiceTypeSelect(matched ? matched.name : OTHER_SERVICE_TYPE);
    if (!matched) setServiceTypeOther(t.serviceType);
    if (t.defaultPrice !== null) setPrice(String(Number(t.defaultPrice)));
    if (t.defaultNotes) setNotes(t.defaultNotes);
    if (t.defaultDurationMinutes && scheduledAt) {
      const end = new Date(scheduledAt);
      end.setMinutes(end.getMinutes() + t.defaultDurationMinutes);
      const pad = (n: number) => String(n).padStart(2, "0");
      setScheduledEndAt(`${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}T${pad(end.getHours())}:${pad(end.getMinutes())}`);
    }
  }
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  // Bölüm K (3. tur): seçilen tarihte müsait olmayan personel — ATAMAYI
  // ENGELLEMEZ, yalnızca seçenek yanında ve seçim altında uyarı gösterir.
  const [unavailable, setUnavailable] = useState<UnavailabilityMap>({});
  const scheduledDate = scheduledAt ? scheduledAt.slice(0, 10) : "";
  useEffect(() => {
    if (!open || !scheduledDate) {
      setUnavailable({});
      return;
    }
    let cancelled = false;
    api
      .get<{ data: (Pick<StaffUnavailability, "startTime" | "endTime" | "reason"> & { staffId: string })[] }>(
        `/staff/unavailability?date=${scheduledDate}`
      )
      .then((res) => {
        if (cancelled) return;
        const map: UnavailabilityMap = {};
        for (const row of res.data) (map[row.staffId] ??= []).push(row);
        setUnavailable(map);
      })
      .catch(() => {
        if (!cancelled) setUnavailable({});
      });
    return () => {
      cancelled = true;
    };
  }, [open, scheduledDate]);

  useEffect(() => {
    if (open) {
      setCustomerId(prefill?.customerId ?? "");
      setAssignedStaffId("");
      setServiceTypeSelect("");
      setServiceTypeOther(prefill?.serviceType ?? "");
      setScheduledAt(prefill?.scheduledAt ?? "");
      setScheduledEndAt("");
      setNotes(prefill?.notes ?? "");
      setPrice("");
      setTemplateId("");
      setError(null);
      api
        .get<{ data: JobTemplate[] }>("/job-templates")
        .then((res) => setTemplates(res.data))
        .catch(() => setTemplates([]));
      api
        .get<{ data: ServiceType[] }>("/service-types")
        .then((res) => {
          const active = res.data.filter((s) => s.isActive);
          setServiceTypes(active);
          // Sözleşmedeki hizmet türü mevcut listede varsa doğrudan seç, yoksa "Diğer" ile serbest metin olarak doldur.
          if (prefill?.serviceType) {
            const matched = active.find((s) => s.name === prefill.serviceType);
            setServiceTypeSelect(matched ? matched.name : OTHER_SERVICE_TYPE);
          }
        })
        .catch(() => setServiceTypes([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const serviceType = serviceTypeSelect === OTHER_SERVICE_TYPE ? serviceTypeOther : serviceTypeSelect;

  // Bölüm Y (6. tur): müşteri + hizmet türü seçilince geçerli garanti uyarısı (bilgi amaçlı).
  const [activeWarranty, setActiveWarranty] = useState<ActiveWarranty | null>(null);
  useEffect(() => {
    if (!open || !customerId || !serviceType) {
      setActiveWarranty(null);
      return;
    }
    let cancelled = false;
    api
      .get<{ data: ActiveWarranty[] }>(`/customers/${customerId}/active-warranties?serviceType=${encodeURIComponent(serviceType)}`)
      .then((res) => {
        if (!cancelled) setActiveWarranty(res.data[0] ?? null);
      })
      .catch(() => {
        if (!cancelled) setActiveWarranty(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, customerId, serviceType]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const created = await api.post<Job>("/jobs", {
        customerId,
        assignedStaffId: assignedStaffId || undefined,
        serviceType,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        scheduledEndAt: scheduledEndAt ? new Date(scheduledEndAt).toISOString() : undefined,
        notes: notes || undefined,
        price: price ? Number(price) : undefined,
      });
      onSaved(created);
      onClose();
      showToast("İş oluşturuldu.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kaydedilemedi, tekrar deneyin");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Yeni İş">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {templates.length > 0 && (
          <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface-subtle p-3">
            <label className="text-xs font-semibold text-text-secondary">Şablondan Doldur (opsiyonel)</label>
            <select value={templateId} onChange={(e) => applyTemplate(e.target.value)} className="input">
              <option value="">Şablon seçin...</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} — {t.serviceType}
                  {t.defaultPrice !== null ? ` · ${Number(t.defaultPrice).toLocaleString("tr-TR")} ₺` : ""}
                </option>
              ))}
            </select>
            <p className="text-2xs text-text-faint">Hizmet türü, fiyat ve not otomatik dolar; süre tanımlıysa planlanan saate göre bitiş de hesaplanır.</p>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Müşteri</label>
          <select required value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="input">
            <option value="" disabled>
              Seçin
            </option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullName}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          {activeWarranty && <WarrantyNotice daysLeft={activeWarranty.daysLeft} serviceType={activeWarranty.serviceType} />}
          <label className="text-sm font-medium text-text-secondary">Personel (opsiyonel)</label>
          <select value={assignedStaffId} onChange={(e) => setAssignedStaffId(e.target.value)} className="input">
            <option value="">Atanmadı</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.user.fullName}
                {unavailable[s.id] ? ` ⚠ müsait değil (${describeUnavailability(unavailable[s.id])})` : ""}
              </option>
            ))}
          </select>
          {assignedStaffId && unavailable[assignedStaffId] && (
            <p className="flex items-start gap-2 rounded-xl border border-warning-100 bg-warning-50 px-3 py-2 text-xs text-warning-600">
              <AlertTriangle size={14} strokeWidth={2} className="mt-0.5 shrink-0" />
              <span>
                Bu personel {scheduledDate.split("-").reverse().join(".")} tarihinde müsait olmadığını işaretlemiş (
                {describeUnavailability(unavailable[assignedStaffId])}
                {unavailable[assignedStaffId].find((r) => r.reason)?.reason
                  ? ` · ${unavailable[assignedStaffId].find((r) => r.reason)!.reason}`
                  : ""}
                ). Yine de atayabilirsiniz.
              </span>
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Hizmet Türü</label>
          <select
            required
            value={serviceTypeSelect}
            onChange={(e) => setServiceTypeSelect(e.target.value)}
            className="input"
          >
            <option value="" disabled>
              Seçin
            </option>
            {serviceTypes.map((s) => (
              <option key={s.id} value={s.name}>
                {s.name}
              </option>
            ))}
            <option value={OTHER_SERVICE_TYPE}>Diğer</option>
          </select>
          {serviceTypeSelect === OTHER_SERVICE_TYPE && (
            <input
              required
              value={serviceTypeOther}
              onChange={(e) => setServiceTypeOther(e.target.value)}
              className="input mt-2"
              placeholder="Hizmet türünü yazın"
            />
          )}
        </div>

        {/* Randevu penceresi — Stitch Müdür → İşler kartlarındaki "09:00 – 11:00". */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Başlangıç (opsiyonel)</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="input"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Tahmini Bitiş (opsiyonel)</label>
            <input
              type="datetime-local"
              value={scheduledEndAt}
              min={scheduledAt || undefined}
              onChange={(e) => setScheduledEndAt(e.target.value)}
              className="input"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Ücret (₺, opsiyonel)</label>
          <input type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="input" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Not (opsiyonel)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input" rows={3} />
        </div>

        {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

        <div className="mt-2 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-2xl px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:bg-surface-subtle">
            Vazgeç
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-2xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition hover:bg-primary-700 disabled:opacity-60"
          >
            {saving ? "Kaydediliyor..." : "Oluştur"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

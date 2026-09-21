"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { LoadingBlock } from "@/components/LoadingBlock";
import { MessageSquareWarning, Plus, UserCheck } from "lucide-react";
import { RequireRole } from "@/components/RequireRole";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/Modal";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthProvider";
import { useToast } from "@/lib/ToastProvider";
import { formatDateTime } from "@/lib/format";
import type { ComplaintPriority, ComplaintStatus, CustomerComplaint, Job, Paginated, Staff } from "@/lib/types";

/**
 * Bölüm AO (9. tur): Şikayet/sorun bildirimi. CUSTOMER → "Şikayetlerim"
 * (yeni şikayet formu + geçmiş); OWNER/MANAGER → "Şikayetler" (durum/öncelik
 * filtresi, atama, çözüm notu). Bekleyen Onaylar'dan AYRI bir iş akışı.
 */
const STATUS_LABELS: Record<ComplaintStatus, string> = {
  OPEN: "Açık",
  IN_PROGRESS: "İşlemde",
  RESOLVED: "Çözüldü",
  CLOSED: "Kapatıldı",
};
const STATUS_TONES: Record<ComplaintStatus, string> = {
  OPEN: "border-danger-100 bg-danger-50 text-danger-500",
  IN_PROGRESS: "border-warning-100 bg-warning-50 text-warning-600",
  RESOLVED: "border-success-100 bg-success-50 text-success-600",
  CLOSED: "border-border bg-surface-subtle text-text-secondary",
};
const PRIORITY_LABELS: Record<ComplaintPriority, string> = { LOW: "Düşük", MEDIUM: "Orta", HIGH: "Yüksek" };
const PRIORITY_TONES: Record<ComplaintPriority, string> = {
  LOW: "bg-surface-subtle text-text-secondary",
  MEDIUM: "bg-info-50 text-info-600",
  HIGH: "bg-danger-50 text-danger-500",
};

export default function ComplaintsPage() {
  return (
    <RequireRole roles={["OWNER", "MANAGER", "CUSTOMER"]}>
      <ComplaintsContent />
    </RequireRole>
  );
}

function ComplaintsContent() {
  const { user } = useAuth();
  const isCustomer = user?.role === "CUSTOMER";
  const { showToast } = useToast();

  const [rows, setRows] = useState<CustomerComplaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ComplaintStatus | "ALL">("ALL");
  const [priority, setPriority] = useState<ComplaintPriority | "ALL">("ALL");
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CustomerComplaint | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ limit: "100" });
      if (status !== "ALL") q.set("status", status);
      if (priority !== "ALL") q.set("priority", priority);
      const res = await api.get<Paginated<CustomerComplaint>>(`/complaints?${q.toString()}`);
      setRows(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Şikayetler yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [status, priority]);

  useEffect(() => {
    load();
  }, [load]);

  const openCount = rows.filter((r) => r.status === "OPEN" || r.status === "IN_PROGRESS").length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={MessageSquareWarning}
        title={isCustomer ? "Şikayetlerim" : "Şikayetler"}
        description={
          isCustomer
            ? "Hizmetle ilgili bir sorun yaşadıysanız buradan bildirin; çözüm sürecini takip edin."
            : "Müşteri şikayetleri — öncelik verin, sorumlu atayın, çözüm notuyla kapatın."
        }
        actions={
          isCustomer ? (
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="flex items-center gap-2 rounded-2xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition hover:bg-primary-700"
            >
              <Plus size={16} strokeWidth={2} />
              Yeni Şikayet
            </button>
          ) : undefined
        }
      />

      {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        {(["ALL", "OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              status === s ? "bg-primary-600 text-white" : "border border-border bg-surface-base text-text-secondary hover:bg-surface-subtle"
            }`}
          >
            {s === "ALL" ? "Tümü" : STATUS_LABELS[s]}
          </button>
        ))}
        {!isCustomer && (
          <>
            <span className="mx-1 h-5 w-px bg-border" />
            {(["ALL", "HIGH", "MEDIUM", "LOW"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  priority === p ? "bg-primary-600 text-white" : "border border-border bg-surface-base text-text-secondary hover:bg-surface-subtle"
                }`}
              >
                {p === "ALL" ? "Tüm öncelikler" : PRIORITY_LABELS[p]}
              </button>
            ))}
          </>
        )}
        {!loading && <span className="ml-auto text-xs text-text-secondary">{openCount} açık/işlemde · {rows.length} kayıt</span>}
      </div>

      {loading ? (
        <LoadingBlock lines={3} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={MessageSquareWarning}
          title={isCustomer ? "Henüz şikayetiniz yok" : "Şikayet yok"}
          description={isCustomer ? "Bir sorun yaşarsanız buradan bildirebilirsiniz." : "Bu filtreyle eşleşen şikayet bulunmuyor."}
          actionLabel={isCustomer ? "Yeni Şikayet" : undefined}
          onAction={isCustomer ? () => setFormOpen(true) : undefined}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((c) => (
            <li key={c.id} className="rounded-2xl border border-border bg-surface-card p-5 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-text-primary">{c.subject}</h3>
                    <span className={`rounded-full border px-2.5 py-0.5 text-2xs font-semibold ${STATUS_TONES[c.status]}`}>{STATUS_LABELS[c.status]}</span>
                    <span className={`rounded-full px-2 py-0.5 text-2xs font-semibold ${PRIORITY_TONES[c.priority]}`}>{PRIORITY_LABELS[c.priority]} öncelik</span>
                  </div>
                  <p className="mt-1 text-xs text-text-secondary">
                    {!isCustomer && c.customer ? `${c.customer.fullName} · ` : ""}
                    {formatDateTime(c.createdAt)}
                    {c.job ? ` · İş #NLF-${c.job.sequenceNo} (${c.job.serviceType})` : ""}
                    {c.assignedTo ? ` · Sorumlu: ${c.assignedTo.fullName}` : !isCustomer ? " · Atanmamış" : ""}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-text-primary">{c.description}</p>
                  {c.resolutionNote && (
                    <p className="mt-2 rounded-2xl border border-success-100 bg-success-50 px-3 py-2 text-xs text-success-600">
                      <span className="font-semibold">Çözüm: </span>
                      {c.resolutionNote}
                      {c.resolvedAt ? ` · ${formatDateTime(c.resolvedAt)}` : ""}
                    </p>
                  )}
                </div>
                {!isCustomer && (
                  <button
                    type="button"
                    onClick={() => setEditTarget(c)}
                    className="flex items-center gap-1.5 rounded-xl border border-border bg-surface-base px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:border-border-strong hover:bg-surface-subtle hover:text-text-primary"
                  >
                    <UserCheck size={13} strokeWidth={1.75} />
                    Yönet
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {isCustomer && (
        <NewComplaintModal
          open={formOpen}
          onClose={() => setFormOpen(false)}
          onSent={() => {
            load();
            showToast("Şikayetiniz iletildi. Yönetim en kısa sürede dönüş yapacak.");
          }}
        />
      )}
      {!isCustomer && (
        <ManageComplaintModal
          complaint={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            load();
            showToast("Şikayet güncellendi.");
          }}
        />
      )}
    </div>
  );
}

function NewComplaintModal({ open, onClose, onSent }: { open: boolean; onClose: () => void; onSent: () => void }) {
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [jobId, setJobId] = useState("");
  const [priority, setPriority] = useState<ComplaintPriority>("MEDIUM");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSubject("");
    setDescription("");
    setJobId("");
    setPriority("MEDIUM");
    setError(null);
    // Müşteri kendi işlerini görür (GET /jobs kayıt bazlı filtreli) — şikayeti bir işe bağlamak için.
    api
      .get<Paginated<Job>>("/jobs?limit=50")
      .then((res) => setJobs(res.data))
      .catch(() => setJobs([]));
  }, [open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.post("/complaints", { subject, description, priority, jobId: jobId || undefined });
      onSent();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gönderilemedi, tekrar deneyin");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Yeni Şikayet / Sorun Bildirimi">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Konu</label>
          <input required minLength={3} maxLength={200} value={subject} onChange={(e) => setSubject(e.target.value)} className="input" placeholder="Örn. İlaçlama sonrası haşere devam ediyor" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Açıklama</label>
          <textarea required minLength={10} maxLength={4000} rows={4} value={description} onChange={(e) => setDescription(e.target.value)} className="input" placeholder="Sorunu mümkün olduğunca ayrıntılı anlatın (en az 10 karakter)." />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">İlgili iş (opsiyonel)</label>
            <select value={jobId} onChange={(e) => setJobId(e.target.value)} className="input">
              <option value="">— Seçilmedi —</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  #NLF-{j.sequenceNo} · {j.serviceType}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Aciliyet</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value as ComplaintPriority)} className="input">
              <option value="LOW">Düşük</option>
              <option value="MEDIUM">Orta</option>
              <option value="HIGH">Yüksek</option>
            </select>
          </div>
        </div>
        {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}
        <div className="mt-2 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-2xl px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:bg-surface-subtle">
            Vazgeç
          </button>
          <button type="submit" disabled={saving} className="rounded-2xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition hover:bg-primary-700 disabled:opacity-60">
            {saving ? "Gönderiliyor..." : "Gönder"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ManageComplaintModal({ complaint, onClose, onSaved }: { complaint: CustomerComplaint | null; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const [status, setStatus] = useState<ComplaintStatus>("OPEN");
  const [priority, setPriority] = useState<ComplaintPriority>("MEDIUM");
  const [assignedToUserId, setAssignedToUserId] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");
  const [staff, setStaff] = useState<Staff[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!complaint) return;
    setStatus(complaint.status);
    setPriority(complaint.priority);
    setAssignedToUserId(complaint.assignedToUserId ?? "");
    setResolutionNote(complaint.resolutionNote ?? "");
    setError(null);
    api
      .get<Paginated<Staff>>("/staff?limit=100")
      .then((res) => setStaff(res.data))
      .catch(() => setStaff([]));
  }, [complaint]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!complaint) return;
    setError(null);
    setSaving(true);
    try {
      await api.patch(`/complaints/${complaint.id}`, {
        status,
        priority,
        assignedToUserId: assignedToUserId || null,
        resolutionNote: resolutionNote.trim() || null,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  }

  // Atanan kişi listede yoksa (örn. başka yönetici) yine seçili kalsın.
  const assigneeInList = staff.some((s) => s.user.id === assignedToUserId) || assignedToUserId === user?.id || !assignedToUserId;

  return (
    <Modal open={!!complaint} onClose={onClose} title={complaint ? `Şikayeti Yönet — ${complaint.subject}` : "Şikayeti Yönet"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {complaint && (
          <p className="rounded-2xl bg-surface-subtle px-4 py-3 text-sm text-text-secondary">
            <span className="font-medium text-text-primary">{complaint.customer?.fullName}</span> · {formatDateTime(complaint.createdAt)}
            <br />
            {complaint.description}
          </p>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Durum</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as ComplaintStatus)} className="input">
              {(Object.keys(STATUS_LABELS) as ComplaintStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Öncelik</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value as ComplaintPriority)} className="input">
              {(Object.keys(PRIORITY_LABELS) as ComplaintPriority[]).map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Sorumlu</label>
          <select value={assignedToUserId} onChange={(e) => setAssignedToUserId(e.target.value)} className="input">
            <option value="">— Atanmamış —</option>
            {user && <option value={user.id}>Bana ata ({user.fullName})</option>}
            {staff.map((s) => (
              <option key={s.id} value={s.user.id}>
                {s.user.fullName} · {s.position}
              </option>
            ))}
            {!assigneeInList && complaint?.assignedTo && <option value={assignedToUserId}>{complaint.assignedTo.fullName}</option>}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Çözüm notu {status === "RESOLVED" || status === "CLOSED" ? "(müşteriye bildirilir)" : "(opsiyonel)"}</label>
          <textarea rows={3} maxLength={4000} value={resolutionNote} onChange={(e) => setResolutionNote(e.target.value)} className="input" placeholder="Ne yapıldı, nasıl çözüldü?" />
        </div>
        {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}
        <div className="mt-2 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-2xl px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:bg-surface-subtle">
            Vazgeç
          </button>
          <button type="submit" disabled={saving} className="rounded-2xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition hover:bg-primary-700 disabled:opacity-60">
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

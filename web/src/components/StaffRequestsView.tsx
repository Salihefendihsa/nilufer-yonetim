"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Inbox, MessageSquareReply, Plus } from "lucide-react";
import { LoadingBlock } from "@/components/LoadingBlock";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/Modal";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/lib/ToastProvider";
import { formatDateTime } from "@/lib/format";
import { ROLE_SHORT_LABELS } from "@/lib/auth";
import type { Paginated, StaffRequest, StaffRequestCategory, StaffRequestPriority, StaffRequestStatus } from "@/lib/types";

/**
 * Personel → Patron genel talep kanalı (Şikayetler sayfasının tersi).
 * mode="mine": MANAGER/TEAM_LEAD/STAFF — "Taleplerim" (yeni talep + geçmiş).
 * mode="owner": OWNER — "Personel Talepleri" (filtre, yanıt notu, durum).
 * Backend kapsamı zaten role göre daraltır; mod yalnızca arayüzü seçer.
 */
const STATUS_LABELS: Record<StaffRequestStatus, string> = {
  OPEN: "Açık",
  IN_PROGRESS: "İşlemde",
  RESOLVED: "Çözüldü",
  REJECTED: "Reddedildi",
};
const STATUS_TONES: Record<StaffRequestStatus, string> = {
  OPEN: "border-danger-100 bg-danger-50 text-danger-500",
  IN_PROGRESS: "border-warning-100 bg-warning-50 text-warning-600",
  RESOLVED: "border-success-100 bg-success-50 text-success-600",
  REJECTED: "border-border bg-surface-subtle text-text-secondary",
};
const CATEGORY_LABELS: Record<StaffRequestCategory, string> = {
  EQUIPMENT: "Ekipman",
  SUGGESTION: "Öneri",
  COMPLAINT: "Şikayet",
  OTHER: "Diğer",
};
const PRIORITY_LABELS: Record<StaffRequestPriority, string> = { LOW: "Düşük", MEDIUM: "Orta", HIGH: "Yüksek" };
const PRIORITY_TONES: Record<StaffRequestPriority, string> = {
  LOW: "bg-surface-subtle text-text-secondary",
  MEDIUM: "bg-info-50 text-info-600",
  HIGH: "bg-danger-50 text-danger-500",
};

const chip = (active: boolean) =>
  `rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
    active ? "bg-primary-600 text-white" : "border border-border bg-surface-base text-text-secondary hover:bg-surface-subtle"
  }`;

export function StaffRequestsView({ mode }: { mode: "mine" | "owner" }) {
  const isOwner = mode === "owner";
  const { showToast } = useToast();

  const [rows, setRows] = useState<StaffRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<StaffRequestStatus | "ALL">("ALL");
  const [category, setCategory] = useState<StaffRequestCategory | "ALL">("ALL");
  const [formOpen, setFormOpen] = useState(false);
  const [replyTarget, setReplyTarget] = useState<StaffRequest | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ limit: "100" });
      if (status !== "ALL") q.set("status", status);
      if (category !== "ALL") q.set("category", category);
      const res = await api.get<Paginated<StaffRequest>>(`/staff-requests?${q.toString()}`);
      setRows(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Talepler yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [status, category]);

  useEffect(() => {
    load();
  }, [load]);

  const openCount = rows.filter((r) => r.status === "OPEN" || r.status === "IN_PROGRESS").length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Inbox}
        title={isOwner ? "Personel Talepleri" : "Taleplerim"}
        description={
          isOwner
            ? "Müdür, ekip lideri ve personelden gelen ekipman, öneri ve şikayet talepleri — yanıtlayın, sonuçlandırın."
            : "Ekipman ihtiyacı, öneri veya şikayetinizi doğrudan Patron'a iletin; yanıtı buradan takip edin."
        }
        actions={
          !isOwner ? (
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="flex items-center gap-2 rounded-2xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition hover:bg-primary-700"
            >
              <Plus size={16} strokeWidth={2} />
              Yeni Talep
            </button>
          ) : undefined
        }
      />

      {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        {(["ALL", "OPEN", "IN_PROGRESS", "RESOLVED", "REJECTED"] as const).map((s) => (
          <button key={s} type="button" onClick={() => setStatus(s)} className={chip(status === s)}>
            {s === "ALL" ? "Tümü" : STATUS_LABELS[s]}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-border" />
        {(["ALL", "EQUIPMENT", "SUGGESTION", "COMPLAINT", "OTHER"] as const).map((c) => (
          <button key={c} type="button" onClick={() => setCategory(c)} className={chip(category === c)}>
            {c === "ALL" ? "Tüm kategoriler" : CATEGORY_LABELS[c]}
          </button>
        ))}
        {!loading && <span className="ml-auto text-xs text-text-secondary">{openCount} açık/işlemde · {rows.length} kayıt</span>}
      </div>

      {loading ? (
        <LoadingBlock lines={3} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={isOwner ? "Talep yok" : "Henüz talebiniz yok"}
          description={isOwner ? "Bu filtreyle eşleşen personel talebi bulunmuyor." : "Bir ihtiyacınız ya da öneriniz olursa buradan iletebilirsiniz."}
          actionLabel={!isOwner ? "Yeni Talep" : undefined}
          onAction={!isOwner ? () => setFormOpen(true) : undefined}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((r) => (
            <li key={r.id} className="rounded-2xl border border-border bg-surface-card p-5 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-text-primary">{r.subject}</h3>
                    <span className={`rounded-full border px-2.5 py-0.5 text-2xs font-semibold ${STATUS_TONES[r.status]}`}>{STATUS_LABELS[r.status]}</span>
                    <span className="rounded-full bg-primary-50 px-2 py-0.5 text-2xs font-semibold text-primary-700">{CATEGORY_LABELS[r.category]}</span>
                    <span className={`rounded-full px-2 py-0.5 text-2xs font-semibold ${PRIORITY_TONES[r.priority]}`}>{PRIORITY_LABELS[r.priority]} öncelik</span>
                  </div>
                  <p className="mt-1 text-xs text-text-secondary">
                    {isOwner && r.staffUser ? `${r.staffUser.fullName} (${ROLE_SHORT_LABELS[r.staffUser.role]}) · ` : ""}
                    {formatDateTime(r.createdAt)}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm text-text-primary">{r.description}</p>
                  {r.responseNote && (
                    <p className="mt-2 rounded-2xl border border-success-100 bg-success-50 px-3 py-2 text-xs text-success-600">
                      <span className="font-semibold">Patron yanıtı: </span>
                      {r.responseNote}
                      {r.resolvedAt ? ` · ${formatDateTime(r.resolvedAt)}` : ""}
                    </p>
                  )}
                </div>
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => setReplyTarget(r)}
                    className="flex items-center gap-1.5 rounded-xl border border-border bg-surface-base px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:border-border-strong hover:bg-surface-subtle hover:text-text-primary"
                  >
                    <MessageSquareReply size={13} strokeWidth={1.75} />
                    Yanıtla
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {!isOwner && (
        <NewStaffRequestModal
          open={formOpen}
          onClose={() => setFormOpen(false)}
          onSent={() => {
            load();
            showToast("Talebiniz Patron'a iletildi.");
          }}
        />
      )}
      {isOwner && (
        <ReplyStaffRequestModal
          request={replyTarget}
          onClose={() => setReplyTarget(null)}
          onSaved={() => {
            load();
            showToast("Talep yanıtlandı.");
          }}
        />
      )}
    </div>
  );
}

function NewStaffRequestModal({ open, onClose, onSent }: { open: boolean; onClose: () => void; onSent: () => void }) {
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<StaffRequestCategory>("EQUIPMENT");
  const [priority, setPriority] = useState<StaffRequestPriority>("MEDIUM");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSubject("");
    setDescription("");
    setCategory("EQUIPMENT");
    setPriority("MEDIUM");
    setError(null);
  }, [open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.post("/staff-requests", { subject, description, category, priority });
      onSent();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gönderilemedi, tekrar deneyin");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Yeni Talep">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Kategori</label>
            <select value={category} onChange={(e) => setCategory(e.target.value as StaffRequestCategory)} className="input">
              {(Object.keys(CATEGORY_LABELS) as StaffRequestCategory[]).map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Öncelik</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value as StaffRequestPriority)} className="input">
              {(Object.keys(PRIORITY_LABELS) as StaffRequestPriority[]).map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Konu</label>
          <input required minLength={3} maxLength={200} value={subject} onChange={(e) => setSubject(e.target.value)} className="input" placeholder="Örn. Yeni pülverizatör ihtiyacı" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Açıklama</label>
          <textarea required minLength={10} maxLength={4000} rows={4} value={description} onChange={(e) => setDescription(e.target.value)} className="input" placeholder="Talebinizi ayrıntılı anlatın (en az 10 karakter)." />
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

function ReplyStaffRequestModal({ request, onClose, onSaved }: { request: StaffRequest | null; onClose: () => void; onSaved: () => void }) {
  const [status, setStatus] = useState<StaffRequestStatus>("OPEN");
  const [priority, setPriority] = useState<StaffRequestPriority>("MEDIUM");
  const [responseNote, setResponseNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!request) return;
    setStatus(request.status);
    setPriority(request.priority);
    setResponseNote(request.responseNote ?? "");
    setError(null);
  }, [request]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!request) return;
    setError(null);
    setSaving(true);
    try {
      await api.patch(`/staff-requests/${request.id}`, { status, priority, responseNote: responseNote.trim() || null });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={!!request} onClose={onClose} title={request ? `Talebi Yanıtla — ${request.subject}` : "Talebi Yanıtla"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {request && (
          <p className="rounded-2xl bg-surface-subtle px-4 py-3 text-sm text-text-secondary">
            <span className="font-medium text-text-primary">{request.staffUser?.fullName}</span> · {CATEGORY_LABELS[request.category]} · {formatDateTime(request.createdAt)}
            <br />
            {request.description}
          </p>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Durum</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as StaffRequestStatus)} className="input">
              {(Object.keys(STATUS_LABELS) as StaffRequestStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Öncelik</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value as StaffRequestPriority)} className="input">
              {(Object.keys(PRIORITY_LABELS) as StaffRequestPriority[]).map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Yanıt notu (talep sahibine bildirilir)</label>
          <textarea rows={3} maxLength={4000} value={responseNote} onChange={(e) => setResponseNote(e.target.value)} className="input" placeholder="Karar, yapılacak işlem veya gerekçe" />
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

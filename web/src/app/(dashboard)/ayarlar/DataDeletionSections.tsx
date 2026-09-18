"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldAlert, Trash2, Check, X, UserX } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/lib/ToastProvider";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Modal } from "@/components/Modal";
import { formatDateTime } from "@/lib/format";
import type { DataDeletionRequest } from "@/lib/types";

const STATUS_LABELS: Record<string, string> = { PENDING: "Bekliyor", COMPLETED: "Tamamlandı", REJECTED: "Reddedildi" };

/**
 * Bölüm AD (7. tur): OWNER → Ayarlar → "Veri Silme Talepleri" (KVKK).
 * Onay geri alınamaz: kişisel veriler anonimleştirilir, hesap kapanır; iş/ödeme/
 * sözleşme kayıtları istatistik ve yasal zorunluluk için kalır.
 */
export function DataDeletionRequestsSection() {
  const { showToast } = useToast();
  const [items, setItems] = useState<DataDeletionRequest[]>([]);
  const [status, setStatus] = useState<"PENDING" | "ALL">("PENDING");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [approveTarget, setApproveTarget] = useState<DataDeletionRequest | null>(null);
  const [rejectTarget, setRejectTarget] = useState<DataDeletionRequest | null>(null);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: DataDeletionRequest[] }>(`/data-deletion-requests?status=${status}`);
      setItems(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Talepler yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  async function approve() {
    if (!approveTarget) return;
    setBusyId(approveTarget.id);
    try {
      await api.post(`/data-deletion-requests/${approveTarget.id}/approve`, {});
      showToast("Talep onaylandı; müşteri verileri anonimleştirildi.");
      setApproveTarget(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Onaylanamadı");
    } finally {
      setBusyId(null);
    }
  }

  async function reject() {
    if (!rejectTarget || !reason.trim()) return;
    setBusyId(rejectTarget.id);
    try {
      await api.post(`/data-deletion-requests/${rejectTarget.id}/reject`, { reason: reason.trim() });
      showToast("Talep reddedildi, müşteriye bildirildi.");
      setRejectTarget(null);
      setReason("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Reddedilemedi");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col rounded-2xl border border-border bg-surface-card p-6 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-danger-50 text-danger-500 ring-1 ring-danger-100">
            <ShieldAlert size={17} strokeWidth={1.75} />
          </span>
          <div>
            <h2 className="text-base font-semibold text-text-primary">Veri Silme Talepleri (KVKK)</h2>
            <p className="mt-0.5 text-sm text-text-secondary">Onay geri alınamaz: müşterinin kişisel bilgileri anonimleştirilir ve hesabı kapanır; iş, ödeme ve sözleşme kayıtları korunur.</p>
          </div>
        </div>
        <div className="flex gap-1 rounded-xl border border-border bg-surface-subtle p-0.5">
          {(["PENDING", "ALL"] as const).map((s) => (
            <button key={s} type="button" onClick={() => setStatus(s)} className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${status === s ? "bg-primary-600 text-white" : "text-text-secondary hover:text-text-primary"}`}>
              {s === "PENDING" ? "Bekleyen" : "Tümü"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3">
        {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}
        {loading ? (
          <p className="text-sm text-text-secondary">Yükleniyor...</p>
        ) : items.length === 0 ? (
          <p className="py-4 text-center text-sm text-text-faint">{status === "PENDING" ? "Bekleyen talep yok." : "Henüz talep yok."}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {items.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium text-text-primary">
                    {r.customer?.fullName ?? "Müşteri"}
                    <span className={`rounded-full px-2 py-0.5 text-2xs font-semibold ${r.status === "PENDING" ? "bg-warning-50 text-warning-600" : r.status === "COMPLETED" ? "bg-surface-muted text-text-secondary" : "bg-danger-50 text-danger-500"}`}>
                      {STATUS_LABELS[r.status]}
                    </span>
                  </p>
                  <p className="text-xs text-text-secondary">
                    Talep: {formatDateTime(r.requestedAt)}
                    {r.customer?.phone ? ` · ${r.customer.phone}` : ""}
                    {r.processedAt ? ` · İşlem: ${formatDateTime(r.processedAt)}${r.processedBy ? ` (${r.processedBy.fullName})` : ""}` : ""}
                    {r.rejectionReason ? ` · Gerekçe: ${r.rejectionReason}` : ""}
                  </p>
                </div>
                {r.status === "PENDING" && (
                  <div className="flex gap-2">
                    <button type="button" disabled={busyId === r.id} onClick={() => setApproveTarget(r)} className="flex items-center gap-1.5 rounded-xl bg-danger-500 px-3 py-2 text-xs font-semibold text-white shadow-card transition hover:bg-danger-600 disabled:opacity-50">
                      <Trash2 size={13} strokeWidth={2} /> Anonimleştir
                    </button>
                    <button type="button" disabled={busyId === r.id} onClick={() => { setReason(""); setRejectTarget(r); }} className="flex items-center gap-1.5 rounded-xl border border-border bg-surface-base px-3 py-2 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle disabled:opacity-50">
                      <X size={13} strokeWidth={2} /> Reddet
                    </button>
                  </div>
                )}
                {r.status === "COMPLETED" && <Check size={15} strokeWidth={2} className="text-text-faint" />}
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={!!approveTarget}
        title="Verileri kalıcı olarak anonimleştir"
        description={`"${approveTarget?.customer?.fullName}" adlı müşterinin adı, telefonu, e-postası ve adresi silinecek; hesabı kapanacak ve oturumları sonlanacak. İş/ödeme/sözleşme kayıtları istatistik için kalır. Bu işlem GERİ ALINAMAZ.`}
        confirmLabel="Evet, anonimleştir"
        loading={busyId === approveTarget?.id}
        onConfirm={approve}
        onClose={() => setApproveTarget(null)}
      />

      <Modal open={!!rejectTarget} onClose={() => setRejectTarget(null)} title="Talebi reddet">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-secondary">Gerekçe müşteriye bildirim olarak iletilir (örn. açık sözleşme/borç).</p>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={1000} className="input" placeholder="Gerekçe" />
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setRejectTarget(null)} className="rounded-2xl px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:bg-surface-subtle">Vazgeç</button>
            <button type="button" disabled={!reason.trim() || busyId === rejectTarget?.id} onClick={reject} className="rounded-2xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition hover:bg-primary-700 disabled:opacity-60">Reddet</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/** Bölüm AD: Müşteri → Ayarlar → "Hesabımı ve Verilerimi Sil" — talep açar; durumunu gösterir. */
export function CustomerDataDeletionSection() {
  const { showToast } = useToast();
  const [latest, setLatest] = useState<DataDeletionRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: DataDeletionRequest | null }>("/customers/me/deletion-request");
      setLatest(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Durum yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api.post("/customers/me/deletion-request", {});
      showToast("Talebiniz alındı. İşletme yetkilisi inceleyip sizi bilgilendirecek.");
      setConfirmOpen(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Talep gönderilemedi");
    } finally {
      setBusy(false);
    }
  }

  const pending = latest?.status === "PENDING";

  return (
    <div className="flex flex-col rounded-2xl border border-danger-100 bg-surface-card p-6 shadow-card">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-danger-50 text-danger-500 ring-1 ring-danger-100">
          <UserX size={17} strokeWidth={1.75} />
        </span>
        <div>
          <h2 className="text-base font-semibold text-text-primary">Hesabımı ve Verilerimi Sil</h2>
          <p className="mt-0.5 text-sm text-text-secondary">
            KVKK kapsamında kişisel verilerinizin silinmesini talep edebilirsiniz. Onaylandığında adınız, telefonunuz, e-postanız ve adresiniz kaldırılır ve hesabınız kapanır; geçmiş işleriniz yalnızca istatistiksel (kimliksiz) kayıt olarak kalır.
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3">
        {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}
        {loading ? (
          <p className="text-sm text-text-secondary">Yükleniyor...</p>
        ) : pending ? (
          <p className="rounded-2xl border border-warning-100 bg-warning-50 px-4 py-3 text-sm text-warning-600">Talebiniz inceleniyor ({formatDateTime(latest!.requestedAt)}). Sonuç size bildirilecek.</p>
        ) : (
          <>
            {latest?.status === "REJECTED" && (
              <p className="rounded-2xl border border-border bg-surface-subtle px-4 py-3 text-sm text-text-secondary">
                Son talebiniz reddedildi{latest.rejectionReason ? `: ${latest.rejectionReason}` : "."} Dilerseniz yeniden talep açabilirsiniz.
              </p>
            )}
            <button type="button" onClick={() => setConfirmOpen(true)} className="self-start rounded-2xl border border-danger-100 bg-danger-50 px-4 py-2.5 text-sm font-semibold text-danger-500 transition hover:bg-danger-100">
              Silme talebi oluştur
            </button>
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Veri silme talebi gönder"
        description="Talebiniz işletme yetkilisine iletilecek. Onaylanırsa kişisel bilgileriniz kalıcı olarak kaldırılır ve bu hesapla bir daha giriş yapamazsınız. Devam etmek istiyor musunuz?"
        confirmLabel="Talebi gönder"
        loading={busy}
        onConfirm={submit}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
}

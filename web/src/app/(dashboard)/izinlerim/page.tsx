"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { CalendarOff, Plus } from "lucide-react";
import { RequireRole } from "@/components/RequireRole";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/Modal";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/lib/ToastProvider";
import { formatDate } from "@/lib/format";
import type { LeaveRequest, Paginated } from "@/lib/types";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Bekliyor",
  APPROVED: "Onaylandı",
  REJECTED: "Reddedildi",
};

const STATUS_TONES: Record<string, string> = {
  PENDING: "bg-warning-50 text-warning-600",
  APPROVED: "bg-primary-50 text-primary-700",
  REJECTED: "bg-danger-50 text-danger-500",
};

export default function LeaveRequestsPage() {
  return (
    <RequireRole roles={["TEAM_LEAD", "STAFF"]}>
      <LeaveRequestsContent />
    </RequireRole>
  );
}

function LeaveRequestsContent() {
  const [rows, setRows] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const { showToast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<Paginated<LeaveRequest>>("/leave-requests?mine=true&limit=100");
      setRows(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "İzin talepleri yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={CalendarOff}
        title="İzin Taleplerim"
        description="Yeni izin talebi oluşturun ve geçmiş taleplerinizin durumunu görün."
        actions={
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="flex items-center gap-2 rounded-2xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition hover:bg-primary-700"
          >
            <Plus size={16} strokeWidth={2} />
            Yeni Talep
          </button>
        }
      />

      {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

      {loading ? (
        <p className="py-16 text-center text-sm text-text-faint">Yükleniyor...</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface-card shadow-card">
          <EmptyState icon={CalendarOff} title="Henüz izin talebiniz yok" description="Yeni bir talep oluşturarak başlayın." />
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface-card shadow-card">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-col gap-2 px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-text-primary">
                  {formatDate(r.startDate)} – {formatDate(r.endDate)}
                </p>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_TONES[r.status]}`}>
                  {STATUS_LABELS[r.status]}
                </span>
              </div>
              <p className="text-sm text-text-secondary">{r.reason}</p>
              {r.decisionNote && (
                <p className="text-xs text-text-faint">Not: {r.decisionNote}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      <NewLeaveRequestModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onCreated={() => {
          setFormOpen(false);
          load();
          showToast("İzin talebiniz gönderildi.");
        }}
      />
    </div>
  );
}

function NewLeaveRequestModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    setStartDate("");
    setEndDate("");
    setReason("");
    setError(null);
    onClose();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!startDate || !endDate || !reason.trim()) {
      setError("Tüm alanlar zorunludur");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/leave-requests", { startDate, endDate, reason: reason.trim() });
      handleClose();
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Talep oluşturulamadı");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Yeni İzin Talebi">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Başlangıç</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input w-full" />
          </div>
          <div>
            <label className="label">Bitiş</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input w-full" />
          </div>
        </div>

        <div>
          <label className="label">Gerekçe</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="input w-full resize-none" />
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={handleClose} className="btn-ghost">
            Vazgeç
          </button>
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? "Gönderiliyor..." : "Talebi Gönder"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

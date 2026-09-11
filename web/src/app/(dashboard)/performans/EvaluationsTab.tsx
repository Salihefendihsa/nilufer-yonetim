"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ClipboardList, Lock, Plus, Send } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/Modal";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthProvider";
import type { Evaluation, EvaluationCriterion, EvaluationPeriod, Paginated, Staff } from "@/lib/types";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Taslak",
  SUBMITTED: "Gönderildi",
  LOCKED: "Kilitli",
};

const STATUS_TONES: Record<string, string> = {
  DRAFT: "bg-surface-subtle text-text-secondary",
  SUBMITTED: "bg-info-50 text-info-600",
  LOCKED: "bg-warning-50 text-warning-600",
};

export function EvaluationsTab() {
  const { user } = useAuth();
  const canManage = user?.role === "OWNER" || user?.role === "MANAGER";
  const isOwner = user?.role === "OWNER";

  const [periods, setPeriods] = useState<EvaluationPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [criteria, setCriteria] = useState<EvaluationCriterion[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newPeriodOpen, setNewPeriodOpen] = useState(false);
  const [formTarget, setFormTarget] = useState<Staff | null>(null);

  const loadPeriods = useCallback(async () => {
    try {
      const res = await api.get<{ data: EvaluationPeriod[] }>("/evaluation-periods");
      setPeriods(res.data);
      if (res.data.length > 0 && !selectedPeriodId) {
        setSelectedPeriodId(res.data[0].id);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Dönemler yüklenemedi");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadPeriods();
    api.get<{ data: EvaluationCriterion[] }>("/evaluation-criteria").then((res) => setCriteria(res.data.filter((c) => c.isActive)));
    if (canManage) {
      api.get<Paginated<Staff>>("/staff?limit=100").then((res) => setStaff(res.data));
    }
  }, [loadPeriods, canManage]);

  const selectedPeriod = periods.find((p) => p.id === selectedPeriodId) ?? null;

  const loadEvaluations = useCallback(async () => {
    if (!selectedPeriodId) {
      setEvaluations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: Evaluation[] }>(`/evaluations?periodId=${selectedPeriodId}`);
      setEvaluations(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Değerlendirmeler yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [selectedPeriodId]);

  useEffect(() => {
    loadEvaluations();
  }, [loadEvaluations]);

  // Sadece giriş yapan kullanıcının kendi verdiği değerlendirmeler — herkesin
  // aynı personel için ayrı bir kaydı olabilir (@@unique evaluator+target+period).
  const myEvaluationByStaffId = useMemo(() => {
    const map = new Map<string, Evaluation>();
    for (const e of evaluations) {
      if (e.evaluatorUserId === user?.id) map.set(e.targetStaffId, e);
    }
    return map;
  }, [evaluations, user?.id]);

  async function handleLockPeriod() {
    if (!selectedPeriod) return;
    if (!confirm(`"${selectedPeriod.label}" dönemini kilitlemek istediğinize emin misiniz? Bu dönemdeki TÜM değerlendirmeler kilitlenecek ve düzenlenemez hale gelecek.`)) return;
    try {
      await api.patch(`/evaluation-periods/${selectedPeriod.id}`, { isLocked: true });
      await Promise.all([loadPeriods(), loadEvaluations()]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Dönem kilitlenemedi");
    }
  }

  if (!canManage) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Bu bölüm yönetim içindir"
        description="Aldığınız değerlendirmeleri personel detay sayfanızdan görebilirsiniz."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={selectedPeriodId ?? ""}
          onChange={(e) => setSelectedPeriodId(e.target.value || null)}
          className="input w-56"
        >
          {periods.length === 0 && <option value="">Dönem yok</option>}
          {periods.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label} {p.isLocked ? "(Kilitli)" : ""}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => setNewPeriodOpen(true)}
          className="flex items-center gap-1.5 rounded-2xl border border-border bg-surface-base px-3.5 py-2 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle"
        >
          <Plus size={14} strokeWidth={2} />
          Yeni Dönem
        </button>

        {isOwner && selectedPeriod && !selectedPeriod.isLocked && (
          <button
            type="button"
            onClick={handleLockPeriod}
            className="flex items-center gap-1.5 rounded-2xl border border-warning-100 bg-warning-50 px-3.5 py-2 text-xs font-semibold text-warning-600 transition hover:bg-warning-100"
          >
            <Lock size={14} strokeWidth={2} />
            Dönemi Kilitle
          </button>
        )}
      </div>

      {loading ? (
        <p className="py-16 text-center text-sm text-text-faint">Yükleniyor...</p>
      ) : !selectedPeriodId ? (
        <EmptyState icon={ClipboardList} title="Önce bir dönem oluşturun" description="Değerlendirme yapabilmek için bir dönem seçin." />
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface-card shadow-card">
          {staff.map((s) => {
            const mine = myEvaluationByStaffId.get(s.id);
            return (
              <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-4">
                <div>
                  <p className="text-sm font-medium text-text-primary">{s.user.fullName}</p>
                  <p className="text-xs text-text-secondary">{s.position}</p>
                </div>
                <div className="flex items-center gap-3">
                  {mine && (
                    <>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_TONES[mine.status]}`}>
                        {STATUS_LABELS[mine.status]}
                      </span>
                      {mine.averageScore !== null && (
                        <span className="font-mono text-sm text-text-secondary">Ort: {mine.averageScore}</span>
                      )}
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setFormTarget(s)}
                    disabled={!!selectedPeriod?.isLocked}
                    className="rounded-xl border border-primary-100 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700 transition hover:bg-primary-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {mine ? (mine.status === "DRAFT" ? "Düzenle" : "Görüntüle") : "Değerlendir"}
                  </button>
                </div>
              </li>
            );
          })}
          {staff.length === 0 && <p className="px-5 py-6 text-sm text-text-secondary">Henüz personel yok.</p>}
        </ul>
      )}

      <NewPeriodModal
        open={newPeriodOpen}
        onClose={() => setNewPeriodOpen(false)}
        onCreated={(p) => {
          setNewPeriodOpen(false);
          setSelectedPeriodId(p.id);
          loadPeriods();
        }}
      />

      {formTarget && (
        <EvaluationFormModal
          staff={formTarget}
          periodId={selectedPeriodId!}
          criteria={criteria}
          existing={myEvaluationByStaffId.get(formTarget.id) ?? null}
          onClose={() => setFormTarget(null)}
          onSaved={() => {
            setFormTarget(null);
            loadEvaluations();
          }}
        />
      )}
    </div>
  );
}

function NewPeriodModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (period: EvaluationPeriod) => void;
}) {
  const [label, setLabel] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!label.trim() || !startDate || !endDate) {
      setError("Tüm alanlar zorunludur");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const period = await api.post<EvaluationPeriod>("/evaluation-periods", { label: label.trim(), startDate, endDate });
      setLabel("");
      setStartDate("");
      setEndDate("");
      onCreated(period);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Dönem oluşturulamadı");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Yeni Değerlendirme Dönemi">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}
        <div>
          <label className="label">Dönem Adı</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Örn. 2026 Eylül" className="input w-full" />
        </div>
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
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost">
            Vazgeç
          </button>
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? "Oluşturuluyor..." : "Oluştur"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EvaluationFormModal({
  staff,
  periodId,
  criteria,
  existing,
  onClose,
  onSaved,
}: {
  staff: Staff;
  periodId: string;
  criteria: EvaluationCriterion[];
  existing: Evaluation | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const readOnly = existing !== null && existing.status !== "DRAFT";
  const [scores, setScores] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const c of criteria) {
      const found = existing?.scores.find((s) => s.criterionId === c.id);
      map[c.id] = found?.score ?? 10;
    }
    return map;
  });
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [managerScore, setManagerScore] = useState<string>(existing?.managerScore != null ? String(existing.managerScore) : "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function buildPayload() {
    return {
      scores: criteria.map((c) => ({ criterionId: c.id, score: scores[c.id] ?? 10 })),
      comment: comment.trim() || null,
      managerScore: managerScore.trim() ? Number(managerScore) : null,
    };
  }

  async function handleSaveDraft() {
    setSubmitting(true);
    setError(null);
    try {
      if (existing) {
        await api.patch(`/evaluations/${existing.id}`, buildPayload());
      } else {
        await api.post("/evaluations", { targetStaffId: staff.id, periodId, ...buildPayload() });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kaydedilemedi");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitEvaluation() {
    setSubmitting(true);
    setError(null);
    try {
      let evaluationId = existing?.id;
      if (evaluationId) {
        await api.patch(`/evaluations/${evaluationId}`, buildPayload());
      } else {
        const created = await api.post<Evaluation>("/evaluations", { targetStaffId: staff.id, periodId, ...buildPayload() });
        evaluationId = created.id;
      }
      await api.post(`/evaluations/${evaluationId}/submit`);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gönderilemedi");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`${staff.user.fullName} — Değerlendirme`}>
      <div className="flex flex-col gap-4">
        {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

        {readOnly && (
          <p className="rounded-2xl border border-warning-100 bg-warning-50 px-4 py-3 text-sm text-warning-600">
            Bu değerlendirme {existing?.status === "LOCKED" ? "kilitli" : "gönderilmiş"} — salt okunur.
          </p>
        )}

        <div className="flex flex-col gap-3">
          {criteria.map((c) => (
            <div key={c.id}>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-sm font-medium text-text-primary">{c.name}</label>
                <span className="font-mono text-sm text-text-secondary">{scores[c.id] ?? 10}/20</span>
              </div>
              <input
                type="range"
                min={1}
                max={20}
                value={scores[c.id] ?? 10}
                disabled={readOnly}
                onChange={(e) => setScores({ ...scores, [c.id]: Number(e.target.value) })}
                className="w-full"
              />
              {c.description && <p className="mt-0.5 text-xs text-text-faint">{c.description}</p>}
            </div>
          ))}
          {criteria.length === 0 && (
            <p className="text-sm text-text-secondary">
              Henüz aktif kriter yok — Ayarlar → Değerlendirme Kriterleri&apos;nden ekleyin.
            </p>
          )}
        </div>

        <div>
          <label className="label">Yorum</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            disabled={readOnly}
            rows={3}
            className="input w-full resize-none"
          />
        </div>

        <div>
          <label className="label">Genel Puan (opsiyonel, 1-20)</label>
          <input
            type="number"
            min={1}
            max={20}
            value={managerScore}
            disabled={readOnly}
            onChange={(e) => setManagerScore(e.target.value)}
            className="input w-full"
            placeholder="Kriter ortalamasından ayrı, ek bir genel puan"
          />
        </div>

        {!readOnly && (
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-ghost">
              Vazgeç
            </button>
            <button type="button" onClick={handleSaveDraft} disabled={submitting || criteria.length === 0} className="btn-secondary">
              Taslak Kaydet
            </button>
            <button type="button" onClick={handleSubmitEvaluation} disabled={submitting || criteria.length === 0} className="btn-primary">
              <Send size={14} strokeWidth={2} />
              Gönder
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}

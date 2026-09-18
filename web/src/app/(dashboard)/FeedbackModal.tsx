"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Star, ThumbsUp, ThumbsDown } from "lucide-react";
import { Modal } from "@/components/Modal";
import { api, ApiError } from "@/lib/api";

interface FeedbackModalProps {
  open: boolean;
  jobId: string | null;
  serviceType?: string;
  onClose: () => void;
  onSubmitted: () => void;
}

const CRITERIA: { key: "serviceQualityScore" | "punctualityScore" | "staffProfessionalismScore"; label: string; hint: string }[] = [
  { key: "serviceQualityScore", label: "Hizmet Kalitesi", hint: "Uygulamanın etkinliği ve özeni" },
  { key: "punctualityScore", label: "Dakiklik", hint: "Randevu saatine uyum" },
  { key: "staffProfessionalismScore", label: "Personel Profesyonelliği", hint: "İletişim, nezaket, bilgilendirme" },
];

/**
 * Bölüm S (5. tur): Tamamlanmış iş için yapılandırılmış geri bildirim —
 * 3 kriter (1–5) + "Tavsiye eder misiniz?" + yorum. Genel yıldız puanından
 * bağımsız; bir kez gönderilir (sunucu 409 döner).
 */
export function FeedbackModal({ open, jobId, serviceType, onClose, onSubmitted }: FeedbackModalProps) {
  const [scores, setScores] = useState<Record<string, number>>({});
  const [hover, setHover] = useState<Record<string, number>>({});
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setScores({});
      setHover({});
      setWouldRecommend(null);
      setComment("");
      setError(null);
    }
  }, [open]);

  const complete = CRITERIA.every((c) => scores[c.key]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!jobId || !complete) return;
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/jobs/${jobId}/feedback`, {
        ...scores,
        wouldRecommend: wouldRecommend ?? undefined,
        feedbackComment: comment.trim() || undefined,
      });
      onSubmitted();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gönderilemedi, tekrar deneyin");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Detaylı Değerlendirme">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {serviceType && <p className="text-sm text-text-secondary">{serviceType} hizmetinizi birkaç açıdan değerlendirin — geri bildiriminiz ekibimize doğrudan iletilir.</p>}

        {CRITERIA.map((c) => (
          <div key={c.key} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between">
              <label className="text-sm font-medium text-text-primary">{c.label}</label>
              <span className="text-xs text-text-faint">{c.hint}</span>
            </div>
            <div className="flex items-center gap-1" onMouseLeave={() => setHover((h) => ({ ...h, [c.key]: 0 }))}>
              {[1, 2, 3, 4, 5].map((n) => {
                const active = n <= (hover[c.key] || scores[c.key] || 0);
                return (
                  <button
                    key={n}
                    type="button"
                    aria-label={`${c.label}: ${n} yıldız`}
                    onMouseEnter={() => setHover((h) => ({ ...h, [c.key]: n }))}
                    onClick={() => setScores((s) => ({ ...s, [c.key]: n }))}
                    className="rounded-lg p-1 transition hover:bg-surface-subtle"
                  >
                    <Star size={22} strokeWidth={1.75} className={active ? "fill-warning-500 text-warning-500" : "text-text-faint"} />
                  </button>
                );
              })}
              {scores[c.key] && <span className="ml-2 font-mono text-xs text-text-secondary">{scores[c.key]}/5</span>}
            </div>
          </div>
        ))}

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-primary">Bizi tavsiye eder misiniz?</label>
          <div className="flex gap-2">
            {(
              [
                [true, "Evet", ThumbsUp],
                [false, "Hayır", ThumbsDown],
              ] as const
            ).map(([value, label, Icon]) => (
              <button
                key={label}
                type="button"
                onClick={() => setWouldRecommend(value)}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                  wouldRecommend === value ? "border-primary-600 bg-primary-50 text-primary-700" : "border-border bg-surface-base text-text-secondary hover:bg-surface-subtle"
                }`}
              >
                <Icon size={15} strokeWidth={1.75} />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-primary">Yorumunuz (opsiyonel)</label>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} maxLength={2000} className="input" placeholder="Beğendiğiniz ya da geliştirmemizi istediğiniz bir şey var mı?" />
        </div>

        {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-2xl px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:bg-surface-subtle">
            Vazgeç
          </button>
          <button
            type="submit"
            disabled={saving || !complete}
            className="rounded-2xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition hover:bg-primary-700 disabled:opacity-60"
          >
            {saving ? "Gönderiliyor..." : "Gönder"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

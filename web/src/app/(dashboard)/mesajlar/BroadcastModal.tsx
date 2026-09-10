"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Modal } from "@/components/Modal";
import { useToast } from "@/lib/ToastProvider";
import { api, ApiError } from "@/lib/api";

interface BroadcastModalProps {
  open: boolean;
  onClose: () => void;
  onSent: () => void;
}

/**
 * Ekip liderinin doğrudan ekibinin tamamına aynı mesajı göndermesi
 * (Stitch Şef → Mesajlar: "Tüm Ekibime Toplu Duyuru Gönder").
 *
 * Grup konuşması kavramı sistemde yok; backend her ekip üyesiyle ayrı birebir
 * konuşmaya yazar ve tüm yazma işlemi tek transaction içindedir.
 */
export function BroadcastModal({ open, onClose, onSent }: BroadcastModalProps) {
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (open) {
      setContent("");
      setError(null);
    }
  }, [open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (content.trim() === "") return;
    setSending(true);
    setError(null);
    try {
      const res = await api.post<{ recipientCount: number }>("/conversations/broadcast", {
        content: content.trim(),
      });
      if (res.recipientCount === 0) {
        setError("Duyuru gönderilecek ekip üyesi bulunamadı");
        return;
      }
      onSent();
      onClose();
      showToast(`Duyuru ${res.recipientCount} ekip üyesine gönderildi.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Duyuru gönderilemedi");
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Tüm Ekibime Duyuru">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="rounded-2xl bg-surface-subtle px-4 py-3 text-xs text-text-secondary">
          Mesaj, doğrudan size bağlı her ekip üyesine ayrı ayrı iletilir ve her biri kendi
          sohbetinde görür.
        </p>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Duyuru metni</label>
          <textarea
            required
            autoFocus
            rows={4}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="input"
            placeholder="Örn. Yarın 08:00'de depoda toplanıyoruz."
          />
        </div>

        {error && (
          <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>
        )}

        <div className="mt-2 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:bg-surface-subtle"
          >
            Vazgeç
          </button>
          <button
            type="submit"
            disabled={sending || content.trim() === ""}
            className="rounded-2xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition hover:bg-primary-700 disabled:opacity-60"
          >
            {sending ? "Gönderiliyor..." : "Duyuruyu Gönder"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

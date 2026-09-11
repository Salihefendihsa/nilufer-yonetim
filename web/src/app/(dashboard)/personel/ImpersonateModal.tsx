"use client";

import { useState } from "react";
import { UserCog } from "lucide-react";
import { Modal } from "@/components/Modal";
import { api, ApiError } from "@/lib/api";
import { beginImpersonation, type AuthUser } from "@/lib/auth";
import type { Staff } from "@/lib/types";

interface ImpersonateModalProps {
  open: boolean;
  onClose: () => void;
  staff: Staff | null;
}

interface ImpersonateResponse {
  token: string;
  user: AuthUser;
  impersonation: { sessionId: string; reason: string; targetFullName: string };
}

/**
 * OWNER'ın bir kullanıcı hesabına tam audit izli girmesi. Gerekçe zorunlu
 * (Gözlemci Modu ile aynı desen). Başarılı olunca OWNER'ın kendi token'ı
 * saklanır, hedef kullanıcının token'ına geçilir ve sayfa "/"'a yönlendirilir
 * — üstteki ImpersonationBanner o andan itibaren tüm ekranlarda görünür.
 */
export function ImpersonateModal({ open, onClose, staff }: ImpersonateModalProps) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    setReason("");
    setError(null);
    onClose();
  }

  async function handleSubmit() {
    if (!staff || !reason.trim()) {
      setError("Gerekçe zorunludur");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post<ImpersonateResponse>("/admin/impersonate", {
        targetUserId: staff.user.id,
        reason: reason.trim(),
      });
      beginImpersonation(res.token, res.user, res.impersonation);
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impersonation başlatılamadı");
      setSubmitting(false);
    }
  }

  if (!staff) return null;

  return (
    <Modal open={open} onClose={handleClose} title="Bu Kullanıcı Olarak Gir">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text-secondary">
          <strong>{staff.user.fullName}</strong> ({staff.user.email}) hesabına giriş yapacaksınız. Bu oturumda
          yaptığınız her işlem, gerçek aktör olarak sizi gösteren bir not ile denetim kaydına işlenir.
        </p>

        {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-text-primary" htmlFor="impersonate-reason">
            Gerekçe
          </label>
          <textarea
            id="impersonate-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            required
            placeholder="Örn. destek talebini yerinde inceliyorum"
            className="input w-full resize-none"
          />
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={handleClose} className="btn-ghost">
            Vazgeç
          </button>
          <button type="button" onClick={handleSubmit} disabled={submitting} className="btn-primary">
            <UserCog size={14} strokeWidth={1.75} />
            {submitting ? "Başlatılıyor..." : "Bu Kullanıcı Olarak Gir"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

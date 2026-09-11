"use client";

import { useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { Modal } from "@/components/Modal";
import { api, ApiError } from "@/lib/api";
import type { Staff } from "@/lib/types";

interface ResetPasswordModalProps {
  open: boolean;
  onClose: () => void;
  staff: Staff | null;
}

/**
 * OWNER, bir kullanıcının GERÇEK şifresini asla görmez — bunun yerine
 * backend rastgele bir geçici şifre üretir ve yalnızca bu modalde bir
 * kereliğine gösterilir (hiçbir yerde loglanmaz/saklanmaz). Kullanıcı bir
 * sonraki girişinde zorunlu şifre değiştirme ekranına düşer.
 */
export function ResetPasswordModal({ open, onClose, staff }: ResetPasswordModalProps) {
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function handleClose() {
    setTemporaryPassword(null);
    setError(null);
    setCopied(false);
    onClose();
  }

  async function handleReset() {
    if (!staff) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<{ temporaryPassword: string }>(`/admin/users/${staff.user.id}/reset-password`);
      setTemporaryPassword(res.temporaryPassword);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Şifre sıfırlanamadı");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!temporaryPassword) return;
    await navigator.clipboard.writeText(temporaryPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!staff) return null;

  return (
    <Modal open={open} onClose={handleClose} title="Şifreyi Sıfırla">
      <div className="flex flex-col gap-4">
        {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

        {!temporaryPassword ? (
          <>
            <p className="text-sm text-text-secondary">
              <strong>{staff.user.fullName}</strong> ({staff.user.email}) için yeni, rastgele bir geçici şifre
              oluşturulacak. Kullanıcı bir sonraki girişinde şifresini değiştirmek zorunda kalacak. Bu işlem
              denetim kaydına işlenir.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={handleClose} className="btn-ghost">
                Vazgeç
              </button>
              <button type="button" onClick={handleReset} disabled={loading} className="btn-primary">
                <KeyRound size={14} strokeWidth={1.75} />
                {loading ? "Oluşturuluyor..." : "Şifreyi Sıfırla"}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-text-secondary">
              Geçici şifre oluşturuldu. Bu şifre yalnızca burada, bir kereliğine gösteriliyor — kaydedilmiyor,
              tekrar görüntülenemez. Kullanıcıya güvenli bir şekilde iletin.
            </p>
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface-subtle px-4 py-3">
              <code className="flex-1 font-mono text-sm font-semibold text-text-primary">{temporaryPassword}</code>
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 rounded-xl border border-border bg-surface-base px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-surface-card"
              >
                {copied ? <Check size={13} strokeWidth={2} /> : <Copy size={13} strokeWidth={1.75} />}
                {copied ? "Kopyalandı" : "Kopyala"}
              </button>
            </div>
            <div className="flex justify-end">
              <button type="button" onClick={handleClose} className="btn-primary">
                Kapat
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

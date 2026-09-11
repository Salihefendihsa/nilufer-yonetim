"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { api, ApiError } from "@/lib/api";
import type { Staff, UnlinkedUser, Paginated } from "@/lib/types";

interface ManagerRow {
  id: string;
  email: string;
  fullName: string;
}

interface DemoteModalProps {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  manager: ManagerRow | null;
}

/**
 * MANAGER → STAFF/TEAM_LEAD düşürme. Bu kullanıcının daha önce arşivlenmiş
 * bir Staff kaydı varsa (terfi sırasında) backend onu otomatik geri açar —
 * bu durumda pozisyon/maaş/şef alanları OPSİYONELDİR (boş bırakılırsa eski
 * değerler korunur). Hiç Staff geçmişi yoksa backend 400 ile pozisyon/maaşı
 * zorunlu kılar; formda bu bilgi bir ipucu olarak gösterilir.
 */
export function DemoteModal({ open, onClose, onDone, manager }: DemoteModalProps) {
  const [newRole, setNewRole] = useState<"STAFF" | "TEAM_LEAD">("STAFF");
  const [reason, setReason] = useState("");
  const [position, setPosition] = useState("");
  const [salaryBase, setSalaryBase] = useState("");
  const [supervisorId, setSupervisorId] = useState("");
  const [teamLeads, setTeamLeads] = useState<Staff[]>([]);
  const [managers, setManagers] = useState<UnlinkedUser[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setNewRole("STAFF");
    setReason("");
    setPosition("");
    setSalaryBase("");
    setSupervisorId("");
    setError(null);

    api
      .get<Paginated<Staff>>("/staff?role=TEAM_LEAD&limit=100")
      .then((res) => setTeamLeads(res.data))
      .catch(() => setTeamLeads([]));
    api
      .get<{ data: UnlinkedUser[] }>("/users?role=MANAGER")
      .then((res) => setManagers(res.data))
      .catch(() => setManagers([]));
  }, [open]);

  function handleClose() {
    onClose();
  }

  async function handleSubmit() {
    if (!manager || !reason.trim()) {
      setError("Gerekçe zorunludur");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/users/${manager.id}/demote-from-manager`, {
        reason: reason.trim(),
        newRole,
        position: position.trim() || undefined,
        salaryBase: salaryBase ? Number(salaryBase) : undefined,
        supervisorId: supervisorId || undefined,
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "İşlem gerçekleştirilemedi");
    } finally {
      setSubmitting(false);
    }
  }

  if (!manager) return null;

  return (
    <Modal open={open} onClose={handleClose} title="Personel'e Düşür">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text-secondary">
          <strong>{manager.fullName}</strong> ({manager.email}) Müdürlükten düşürülecek. Daha önce bir personel
          kaydı varsa (terfi öncesi) geri açılır; yoksa aşağıdaki pozisyon ve taban maaş zorunludur.
        </p>

        {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Yeni Rol</label>
          <select value={newRole} onChange={(e) => setNewRole(e.target.value as "STAFF" | "TEAM_LEAD")} className="input">
            <option value="STAFF">Personel</option>
            <option value="TEAM_LEAD">Ekip Lideri</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Pozisyon (yalnızca eski kayıt yoksa zorunlu)</label>
          <input value={position} onChange={(e) => setPosition(e.target.value)} className="input" placeholder="Örn. İlaçlama Teknisyeni" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Taban Maaş ₺ (yalnızca eski kayıt yoksa zorunlu)</label>
          <input type="number" min={0} step="0.01" value={salaryBase} onChange={(e) => setSalaryBase(e.target.value)} className="input" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Şef (opsiyonel)</label>
          <select value={supervisorId} onChange={(e) => setSupervisorId(e.target.value)} className="input">
            <option value="">Değiştirme / Yok</option>
            {teamLeads.length > 0 && (
              <optgroup label="Ekip Liderleri">
                {teamLeads.map((lead) => (
                  <option key={lead.id} value={lead.id}>
                    {lead.user.fullName}
                  </option>
                ))}
              </optgroup>
            )}
            {managers.filter((m) => m.id !== manager.id).length > 0 && (
              <optgroup label="Müdürler">
                {managers
                  .filter((m) => m.id !== manager.id)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.fullName}
                    </option>
                  ))}
              </optgroup>
            )}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-text-primary">Gerekçe</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="input w-full resize-none" />
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={handleClose} className="btn-ghost">
            Vazgeç
          </button>
          <button type="button" onClick={handleSubmit} disabled={submitting} className="btn-primary">
            {submitting ? "İşleniyor..." : "Personel'e Düşür"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

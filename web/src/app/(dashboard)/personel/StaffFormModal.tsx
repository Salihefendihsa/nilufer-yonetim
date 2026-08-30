"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Modal } from "@/components/Modal";
import { api, ApiError } from "@/lib/api";
import type { Staff, UnlinkedUser, Paginated } from "@/lib/types";

interface StaffFormModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  staff?: Staff | null;
}

type StaffRole = "STAFF" | "TEAM_LEAD";

const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  STAFF: "Personel",
  TEAM_LEAD: "Ekip Lideri",
};

export function StaffFormModal({ open, onClose, onSaved, staff }: StaffFormModalProps) {
  const [staffRole, setStaffRole] = useState<StaffRole>("STAFF");
  const [userId, setUserId] = useState("");
  const [position, setPosition] = useState("");
  const [salaryBase, setSalaryBase] = useState("");
  const [supervisorId, setSupervisorId] = useState("");
  const [unlinkedUsers, setUnlinkedUsers] = useState<UnlinkedUser[]>([]);
  const [teamLeads, setTeamLeads] = useState<Staff[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setStaffRole("STAFF");
      setUserId(staff?.userId ?? "");
      setPosition(staff?.position ?? "");
      setSalaryBase(staff ? String(staff.salaryBase) : "");
      setSupervisorId(staff?.supervisorId ?? "");
      setError(null);

      api
        .get<Paginated<Staff>>("/staff?role=TEAM_LEAD&limit=100")
        .then((res) => setTeamLeads(res.data))
        .catch(() => setTeamLeads([]));

      if (!staff) {
        setUsersLoading(true);
        api
          .get<{ data: UnlinkedUser[] }>("/users?role=STAFF")
          .then((res) => setUnlinkedUsers(res.data))
          .catch(() => setUnlinkedUsers([]))
          .finally(() => setUsersLoading(false));
      }
    }
  }, [open, staff]);

  useEffect(() => {
    if (!open || staff) return;
    setUserId("");
    setUsersLoading(true);
    api
      .get<{ data: UnlinkedUser[] }>(`/users?role=${staffRole}`)
      .then((res) => setUnlinkedUsers(res.data))
      .catch(() => setUnlinkedUsers([]))
      .finally(() => setUsersLoading(false));
  }, [staffRole, open, staff]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      if (staff) {
        await api.patch(`/staff/${staff.id}`, {
          position,
          salaryBase: Number(salaryBase),
          supervisorId: supervisorId || null,
        });
      } else {
        await api.post("/staff", { userId, position, salaryBase: Number(salaryBase), supervisorId: supervisorId || undefined });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kaydedilemedi, tekrar deneyin");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={staff ? "Personeli Düzenle" : "Yeni Personel"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {!staff && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Rol</label>
            <select value={staffRole} onChange={(e) => setStaffRole(e.target.value as StaffRole)} className="input">
              {(Object.keys(STAFF_ROLE_LABELS) as StaffRole[]).map((r) => (
                <option key={r} value={r}>
                  {STAFF_ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
        )}

        {!staff && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Kullanıcı</label>
            <select required value={userId} onChange={(e) => setUserId(e.target.value)} className="input" disabled={usersLoading}>
              <option value="" disabled>
                {usersLoading ? "Yükleniyor..." : "Seçin"}
              </option>
              {unlinkedUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName} ({u.email})
                </option>
              ))}
            </select>
            {!usersLoading && unlinkedUsers.length === 0 && (
              <p className="text-xs text-text-faint">
                Bağlanabilecek {STAFF_ROLE_LABELS[staffRole]} rolünde kullanıcı yok. Önce bu rolle bir kullanıcı hesabı oluşturulmalı.
              </p>
            )}
          </div>
        )}

        {staff && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Kullanıcı</label>
            <p className="rounded-2xl bg-white/5 px-4 py-3 text-sm text-text-secondary">
              {staff.user.fullName} ({staff.user.email})
            </p>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Pozisyon</label>
          <input required value={position} onChange={(e) => setPosition(e.target.value)} className="input" placeholder="Örn. İlaçlama Teknisyeni" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Taban Maaş (₺)</label>
          <input
            required
            type="number"
            min={0}
            step="0.01"
            value={salaryBase}
            onChange={(e) => setSalaryBase(e.target.value)}
            className="input"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Şef (opsiyonel)</label>
          <select value={supervisorId} onChange={(e) => setSupervisorId(e.target.value)} className="input">
            <option value="">Yok</option>
            {teamLeads
              .filter((lead) => lead.id !== staff?.id)
              .map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.user.fullName}
                </option>
              ))}
          </select>
        </div>

        {error && <p className="rounded-2xl bg-primary-red/10 px-4 py-3 text-sm text-primary-redLight">{error}</p>}

        <div className="mt-2 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-2xl px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:bg-white/5">
            Vazgeç
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-2xl bg-gradient-to-r from-primary-green to-primary-green/90 px-4 py-2.5 text-sm font-semibold text-white transition hover:shadow-[0_0_20px_rgba(212,174,61,0.22)] disabled:opacity-60"
          >
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

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
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [dailyJobCapacity, setDailyJobCapacity] = useState("");
  // Bölüm AH (7. tur): yıllık izin hakkı.
  const [annualLeaveQuotaDays, setAnnualLeaveQuotaDays] = useState("14");
  const [unlinkedUsers, setUnlinkedUsers] = useState<UnlinkedUser[]>([]);
  const [teamLeads, setTeamLeads] = useState<Staff[]>([]);
  // Organizasyon zinciri STAFF → TEAM_LEAD → MANAGER → OWNER: MANAGER'ın
  // kendi Staff kaydı yok (yalnızca User), bu yüzden ayrı bir uçtan
  // (/users?role=MANAGER) çekilip "Şef" seçicisine ikinci bir grup olarak
  // ekleniyor — backend/src/lib/access.ts:resolveSupervisorInfo bu iki
  // kaynaktan (Staff.id veya User.id) gelen supervisorId'yi çözüyor.
  const [managers, setManagers] = useState<UnlinkedUser[]>([]);
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
      setVehiclePlate(staff?.vehiclePlate ?? "");
      setDailyJobCapacity(staff?.dailyJobCapacity != null ? String(staff.dailyJobCapacity) : "");
      setAnnualLeaveQuotaDays(staff?.annualLeaveQuotaDays != null ? String(staff.annualLeaveQuotaDays) : "14");
      setError(null);

      api
        .get<Paginated<Staff>>("/staff?role=TEAM_LEAD&limit=100")
        .then((res) => setTeamLeads(res.data))
        .catch(() => setTeamLeads([]));

      api
        .get<{ data: UnlinkedUser[] }>("/users?role=MANAGER")
        .then((res) => setManagers(res.data))
        .catch(() => setManagers([]));

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
          vehiclePlate: vehiclePlate.trim() || null,
          dailyJobCapacity: dailyJobCapacity ? Number(dailyJobCapacity) : null,
          annualLeaveQuotaDays: annualLeaveQuotaDays ? Number(annualLeaveQuotaDays) : undefined,
        });
      } else {
        await api.post("/staff", {
          userId,
          position,
          salaryBase: Number(salaryBase),
          supervisorId: supervisorId || undefined,
          vehiclePlate: vehiclePlate.trim() || undefined,
          dailyJobCapacity: dailyJobCapacity ? Number(dailyJobCapacity) : undefined,
          annualLeaveQuotaDays: annualLeaveQuotaDays ? Number(annualLeaveQuotaDays) : undefined,
        });
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
            <p className="rounded-2xl bg-surface-subtle px-4 py-3 text-sm text-text-secondary">
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

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Araç Plakası (opsiyonel)</label>
            <input
              value={vehiclePlate}
              onChange={(e) => setVehiclePlate(e.target.value)}
              className="input"
              placeholder="16 ABC 123"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Günlük İş Kapasitesi</label>
            <input
              type="number"
              min={1}
              value={dailyJobCapacity}
              onChange={(e) => setDailyJobCapacity(e.target.value)}
              className="input"
              placeholder="Örn. 6"
            />
            <p className="text-xs text-text-faint">Boş bırakılırsa doluluk yüzdesi gösterilmez.</p>
          </div>
        </div>

        {/* Bölüm AH (7. tur): yıllık izin hakkı */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Yıllık İzin Hakkı (gün)</label>
          <input type="number" min={0} max={365} value={annualLeaveQuotaDays} onChange={(e) => setAnnualLeaveQuotaDays(e.target.value)} className="input" />
          <p className="text-xs text-text-faint">Türkiye asgari 14 gün. Bakiye takvim yılına göre hesaplanır.</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Şef (opsiyonel)</label>
          <select value={supervisorId} onChange={(e) => setSupervisorId(e.target.value)} className="input">
            <option value="">Yok</option>
            {teamLeads.filter((lead) => lead.id !== staff?.id).length > 0 && (
              <optgroup label="Ekip Liderleri">
                {teamLeads
                  .filter((lead) => lead.id !== staff?.id)
                  .map((lead) => (
                    <option key={lead.id} value={lead.id}>
                      {lead.user.fullName}
                    </option>
                  ))}
              </optgroup>
            )}
            {managers.length > 0 && (
              <optgroup label="Müdürler">
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.fullName}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        {error && <p className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-500">{error}</p>}

        <div className="mt-2 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-2xl px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:bg-surface-subtle">
            Vazgeç
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-2xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition hover:bg-primary-700 disabled:opacity-60"
          >
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

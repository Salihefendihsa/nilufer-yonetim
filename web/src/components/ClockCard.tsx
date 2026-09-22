"use client";

import { useCallback, useEffect, useState } from "react";
import { SectionTitle } from "@/components/SectionTitle";
import { LogIn, LogOut, Timer } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/lib/ToastProvider";
import { formatTime } from "@/lib/format";
import type { AttendanceRecord } from "@/lib/types";

/**
 * Bölüm AR (9. tur): STAFF/TEAM_LEAD Ana Sayfa — "Giriş Yap"/"Çıkış Yap" + bugünkü
 * durum. Gün başına tek kayıt: giriş sonra çıkış; ikisi de yapılmışsa kilitli.
 * (POST /staff/me/clock-in | clock-out, GET /staff/me/attendance/today)
 */
export function ClockCard() {
  const { showToast } = useToast();
  const [record, setRecord] = useState<AttendanceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ record: AttendanceRecord | null }>("/staff/me/attendance/today");
      setRecord(res.record);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Puantaj yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(kind: "clock-in" | "clock-out") {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<AttendanceRecord>(`/staff/me/${kind}`, {});
      setRecord(res);
      showToast(kind === "clock-in" ? "Giriş kaydedildi. İyi çalışmalar!" : "Çıkış kaydedildi.");
    } catch (err) {
      // 409 (zaten giriş/çıkış var): bugünkü kaydı yeniden çekip güncel durumu göster.
      if (err instanceof ApiError && err.status === 409) await load();
      setError(err instanceof ApiError ? err.message : "İşlem tamamlanamadı");
    } finally {
      setBusy(false);
    }
  }

  const clockedIn = !!record?.clockInAt;
  const clockedOut = !!record?.clockOutAt;

  return (
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface-card p-5 shadow-card">
      <div className="flex items-center gap-3">
        <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ring-1 ${clockedIn && !clockedOut ? "bg-success-50 text-success-600 ring-success-100" : "bg-primary-50 text-primary-600 ring-primary-100"}`}>
          <Timer size={20} strokeWidth={1.75} />
        </span>
        <div>
          <SectionTitle size="sm">Puantaj</SectionTitle>
          <p className="text-xs text-text-secondary">
            {loading
              ? "Yükleniyor..."
              : !clockedIn
                ? "Bugün henüz giriş yapmadınız."
                : clockedOut
                  ? `Giriş ${formatTime(record!.clockInAt)} · Çıkış ${formatTime(record!.clockOutAt)} · ${record!.workedHours ?? 0} saat`
                  : `Giriş ${formatTime(record!.clockInAt)} — mesai devam ediyor`}
          </p>
          {error && <p className="mt-1 text-xs text-danger-500">{error}</p>}
        </div>
      </div>
      {!loading && !clockedIn && (
        <button type="button" disabled={busy} onClick={() => act("clock-in")} className="flex items-center gap-2 rounded-2xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition hover:bg-primary-700 disabled:opacity-60">
          <LogIn size={16} strokeWidth={2} />
          Giriş Yap
        </button>
      )}
      {!loading && clockedIn && !clockedOut && (
        <button type="button" disabled={busy} onClick={() => act("clock-out")} className="flex items-center gap-2 rounded-2xl border border-danger-100 bg-danger-50 px-4 py-2.5 text-sm font-semibold text-danger-500 transition hover:bg-danger-100 disabled:opacity-60">
          <LogOut size={16} strokeWidth={2} />
          Çıkış Yap
        </button>
      )}
      {!loading && clockedIn && clockedOut && (
        <span className="rounded-full border border-success-100 bg-success-50 px-3 py-1.5 text-xs font-semibold text-success-600">Bugün tamamlandı</span>
      )}
    </section>
  );
}

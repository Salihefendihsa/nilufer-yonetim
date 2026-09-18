import type { Request, Response } from "express";
import { JobStatus, Role, StaffStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getTeamStaffIds } from "../lib/access";

/**
 * Şef (TEAM_LEAD) uçları.
 *
 * Buradaki HER sorgu `getTeamStaffIds` ile sınırlanır — yani yalnızca şefin
 * KENDİSİ ve DOĞRUDAN raporlayanları (tek seviye, `Staff.supervisorId`).
 * Şirket geneli sayılar (`/dashboard/summary`) OWNER/MANAGER'a kısıtlı kalır;
 * bu uçlar onun yerine geçmez, ekip kapsamlı ayrı bir görünüm sunar.
 *
 * OWNER/MANAGER de bu uçları çağırabilir (bir ekip liderinin gördüğünü
 * görebilmek için), ancak o durumda kapsam yine çağıranın kendi ekibidir;
 * ekip kaydı olmayan bir OWNER için boş küme döner.
 */

function dayBounds(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

async function resolveTeam(req: Request) {
  const teamIds = await getTeamStaffIds(req.user!.sub);
  return teamIds;
}

/**
 * Şef ana sayfası — Stitch "Bugün 6 İş / %67 Tamamlandı / 4 Teknisyen /
 * Ekip İş Yükü" bloklarının veri kaynağı. Tümü BUGÜN ve YALNIZCA ekip içi.
 */
export async function getTeamSummary(req: Request, res: Response) {
  const teamIds = await resolveTeam(req);
  return res.json(await computeTeamSummary(teamIds));
}

const EMPTY_TEAM_SUMMARY = {
  teamSize: 0,
  todaysJobsCount: 0,
  todaysJobsByStatus: {} as Record<JobStatus, number>,
  completedTodayCount: 0,
  completionRateToday: null as number | null,
  activeTechnicianCount: 0,
  staffByStatus: {} as Record<StaffStatus, number>,
  workload: [] as TeamWorkloadRow[],
};

export interface TeamWorkloadRow {
  staffId: string;
  fullName: string;
  position: string;
  status: StaffStatus;
  vehiclePlate: string | null;
  dailyJobCapacity: number | null;
  todaysJobsCount: number;
}

/**
 * /team/summary'nin saf hesabı — Bölüm M (4. tur) günlük brifingi de aynı
 * fonksiyonu kullanır (kopya yok).
 */
export async function computeTeamSummary(teamIds: string[]) {
  if (teamIds.length === 0) {
    return EMPTY_TEAM_SUMMARY;
  }

  const { start, end } = dayBounds(new Date());

  const [statusGrouped, perStaffGrouped, staffList, staffStatusGrouped] = await Promise.all([
    prisma.job.groupBy({
      by: ["status"],
      _count: { _all: true },
      where: { assignedStaffId: { in: teamIds }, scheduledAt: { gte: start, lte: end } },
    }),
    prisma.job.groupBy({
      by: ["assignedStaffId"],
      _count: { _all: true },
      where: { assignedStaffId: { in: teamIds }, scheduledAt: { gte: start, lte: end } },
    }),
    prisma.staff.findMany({
      where: { id: { in: teamIds } },
      select: {
        id: true,
        position: true,
        status: true,
        dailyJobCapacity: true,
        vehiclePlate: true,
        user: { select: { fullName: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.staff.groupBy({
      by: ["status"],
      _count: { _all: true },
      where: { id: { in: teamIds } },
    }),
  ]);

  const todaysJobsByStatus = Object.fromEntries(
    Object.values(JobStatus).map((status) => [
      status,
      statusGrouped.find((g) => g.status === status)?._count._all ?? 0,
    ])
  ) as Record<JobStatus, number>;

  const todaysJobsCount = statusGrouped.reduce((sum, g) => sum + g._count._all, 0);
  const completedTodayCount = todaysJobsByStatus[JobStatus.COMPLETED] ?? 0;

  const staffByStatus = Object.fromEntries(
    Object.values(StaffStatus).map((status) => [
      status,
      staffStatusGrouped.find((g) => g.status === status)?._count._all ?? 0,
    ])
  ) as Record<StaffStatus, number>;

  const workload = staffList.map((staff) => ({
    staffId: staff.id,
    fullName: staff.user.fullName,
    position: staff.position,
    status: staff.status,
    vehiclePlate: staff.vehiclePlate,
    dailyJobCapacity: staff.dailyJobCapacity,
    todaysJobsCount: perStaffGrouped.find((g) => g.assignedStaffId === staff.id)?._count._all ?? 0,
  }));

  return {
    teamSize: teamIds.length,
    todaysJobsCount,
    todaysJobsByStatus,
    completedTodayCount,
    /**
     * Bugün planlanan işlerin kaçının tamamlandığı. Bugün hiç iş yoksa `null`
     * döner — arayüz yüzdeyi hiç göstermez, "%0" uydurulmaz.
     */
    completionRateToday: todaysJobsCount > 0 ? (completedTodayCount / todaysJobsCount) * 100 : null,
    /** Sahada aktif sayılan personel: ON_JOB veya AVAILABLE. */
    activeTechnicianCount:
      (staffByStatus[StaffStatus.ON_JOB] ?? 0) + (staffByStatus[StaffStatus.AVAILABLE] ?? 0),
    staffByStatus,
    workload,
  };
}

/**
 * Bölüm M (4. tur): Şef için "Bugün Ekibim" brifingi. computeTeamSummary'nin
 * bugünkü iş dağılımı + kişi başı yük verisi, bugün için ONAYLI izinler
 * (LeaveRequest) ve müsait-olmama işaretleri (StaffUnavailability, Bölüm K)
 * ile birleştirilir; her üye tek satırda: anlık durum (Staff.status), bugünkü
 * iş sayısı, izinli mi, müsait değil mi (tüm gün / saat aralıkları).
 */
export async function getTeamDailyBriefing(req: Request, res: Response) {
  const teamIds = await resolveTeam(req);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayDateOnly = new Date(Date.UTC(todayStart.getFullYear(), todayStart.getMonth(), todayStart.getDate()));

  const [summary, leaves, unavailabilities] = await Promise.all([
    computeTeamSummary(teamIds),
    teamIds.length === 0
      ? Promise.resolve([])
      : prisma.leaveRequest.findMany({
          where: { staffId: { in: teamIds }, status: "APPROVED", startDate: { lte: todayStart }, endDate: { gte: todayStart } },
          select: { staffId: true, reason: true, endDate: true },
        }),
    teamIds.length === 0
      ? Promise.resolve([])
      : prisma.staffUnavailability.findMany({
          where: { staffId: { in: teamIds }, date: todayDateOnly },
          select: { staffId: true, startTime: true, endTime: true, reason: true },
          orderBy: { startTime: "asc" },
        }),
  ]);

  const members = summary.workload.map((row) => {
    const leave = leaves.find((l) => l.staffId === row.staffId) ?? null;
    const marks = unavailabilities.filter((u) => u.staffId === row.staffId);
    const allDay = marks.some((m) => !m.startTime || !m.endTime);
    return {
      ...row,
      isSelf: false,
      onLeave: leave !== null,
      leaveUntil: leave?.endDate ?? null,
      unavailable: marks.length > 0,
      unavailableAllDay: allDay,
      unavailableRanges: marks.filter((m) => m.startTime && m.endTime).map((m) => `${m.startTime}–${m.endTime}`),
      unavailableReason: marks.find((m) => m.reason)?.reason ?? leave?.reason ?? null,
    };
  });

  // Şefin kendi satırı işaretlenir — arayüz ayrı gösterebilsin.
  const ownStaffId = teamIds[0] ?? null; // getTeamStaffIds ilk sırada şefin kendi kaydını döner
  for (const m of members) m.isSelf = m.staffId === ownStaffId;

  const available = members.filter((m) => !m.onLeave && !m.unavailableAllDay && m.status === StaffStatus.AVAILABLE).length;

  return res.json({
    date: `${todayStart.getFullYear()}-${String(todayStart.getMonth() + 1).padStart(2, "0")}-${String(todayStart.getDate()).padStart(2, "0")}`,
    teamSize: summary.teamSize,
    todaysJobsCount: summary.todaysJobsCount,
    completedTodayCount: summary.completedTodayCount,
    completionRateToday: summary.completionRateToday,
    staffByStatus: summary.staffByStatus,
    availableNowCount: available,
    onLeaveCount: members.filter((m) => m.onLeave).length,
    unavailableCount: members.filter((m) => m.unavailable && !m.onLeave).length,
    members,
  });
}

/**
 * Şef takvimi — Stitch "Operasyon Takvimi": aylık yoğunluk ısı haritası,
 * bu haftanın kapasite doluluğu, en yoğun gün ve bugünkü slot durumu.
 *
 * Kapasite = ekip üyelerinin `Staff.dailyJobCapacity` toplamı. Hiçbir üyede
 * kapasite tanımlı değilse `capacity` alanları `null` döner ve arayüz doluluk
 * yüzdesini GÖSTERMEZ (varsayılan bir kapasite uydurulmaz).
 */
export async function getTeamCalendar(req: Request, res: Response) {
  const teamIds = await resolveTeam(req);

  const monthParam = typeof req.query.month === "string" ? req.query.month : "";
  const base = /^\d{4}-\d{2}$/.test(monthParam) ? new Date(`${monthParam}-01T00:00:00`) : new Date();
  const monthStart = new Date(base.getFullYear(), base.getMonth(), 1);
  const monthEnd = new Date(base.getFullYear(), base.getMonth() + 1, 1);

  if (teamIds.length === 0) {
    return res.json({
      month: `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}`,
      days: [],
      dailyCapacity: null,
      today: { jobCount: 0, capacity: null },
      thisWeek: { jobCount: 0, capacity: null },
      busiestDay: null,
    });
  }

  const [jobs, staffList] = await Promise.all([
    prisma.job.findMany({
      where: {
        assignedStaffId: { in: teamIds },
        scheduledAt: { gte: monthStart, lt: monthEnd },
      },
      select: { scheduledAt: true },
    }),
    prisma.staff.findMany({
      where: { id: { in: teamIds } },
      select: { dailyJobCapacity: true },
    }),
  ]);

  const capacities = staffList
    .map((s) => s.dailyJobCapacity)
    .filter((c): c is number => c !== null && c > 0);
  const dailyCapacity = capacities.length > 0 ? capacities.reduce((a, b) => a + b, 0) : null;

  const counts = new Map<string, number>();
  for (const job of jobs) {
    if (!job.scheduledAt) continue;
    const key = job.scheduledAt.toISOString().slice(0, 10);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const days = [...counts.entries()]
    .map(([date, jobCount]) => ({ date, jobCount }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const busiestDay = days.reduce<{ date: string; jobCount: number } | null>(
    (best, d) => (best === null || d.jobCount > best.jobCount ? d : best),
    null
  );

  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);

  // Pazartesi başlangıçlı hafta (TR takvimi).
  const weekStart = new Date(now);
  const weekday = (weekStart.getDay() + 6) % 7;
  weekStart.setDate(weekStart.getDate() - weekday);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const weekJobCount = days
    .filter((d) => {
      const date = new Date(`${d.date}T00:00:00`);
      return date >= weekStart && date < weekEnd;
    })
    .reduce((sum, d) => sum + d.jobCount, 0);

  return res.json({
    month: `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}`,
    days,
    dailyCapacity,
    today: {
      jobCount: counts.get(todayKey) ?? 0,
      capacity: dailyCapacity,
    },
    thisWeek: {
      jobCount: weekJobCount,
      /** 7 günlük kapasite; günlük kapasite tanımsızsa null. */
      capacity: dailyCapacity !== null ? dailyCapacity * 7 : null,
    },
    busiestDay,
  });
}

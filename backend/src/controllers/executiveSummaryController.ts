import type { Request, Response } from "express";
import {
  AdvanceStatus,
  EvaluationStatus,
  JobStatus,
  LeaveRequestStatus,
  StaffBonusStatus,
  StaffStatus,
} from "@prisma/client";
import { prisma } from "../lib/prisma";
import { computePaymentsSummary, canUserViewFinance } from "./paymentsController";
import { computeDashboardSummary } from "./dashboardController";
import { findLowStockProducts } from "./productsController";
import { findOverdueRecurringContracts } from "./contractsController";
import { expiringCertificationsWhere } from "./staffCertificationsController";
import { contractRenewalWindowWhere } from "../lib/reminders";

/**
 * Bölüm G (2. tur): Yönetici Özet Paneli.
 *
 * Bu controller HİÇBİR iş mantığı hesaplamaz — yalnızca mevcut hesaplama
 * fonksiyonlarını (computePaymentsSummary, computeDashboardSummary,
 * findLowStockProducts, findOverdueRecurringContracts, ...) tek bir
 * Promise.all içinde PARALEL çağırıp KPI kartlarına derler. Böylece
 * "/payments/summary'deki net kâr" ile buradaki net kâr her zaman aynı
 * fonksiyondan çıkar; iki yerde ayrı formül yaşamaz.
 *
 * Her KPI bir `drillDown` hedefi taşır: web tarafında `href` (sayfa +
 * query filtresi), mobil tarafında `route` — kart tıklanınca ilgili
 * ekrana gidilir.
 */

export type ExecutiveRange = "today" | "week" | "month";

const RANGES: ExecutiveRange[] = ["today", "week", "month"];

export function parseRange(raw: unknown): ExecutiveRange {
  return typeof raw === "string" && (RANGES as string[]).includes(raw) ? (raw as ExecutiveRange) : "today";
}

/** Seçilen aralığın [start, end) sınırları. Hafta pazartesi başlar (TR). */
export function rangeBounds(range: ExecutiveRange, now = new Date()): { start: Date; end: Date } {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);

  if (range === "today") {
    end.setDate(end.getDate() + 1);
  } else if (range === "week") {
    const dayOfWeek = (start.getDay() + 6) % 7; // Pazartesi = 0
    start.setDate(start.getDate() - dayOfWeek);
    end.setTime(start.getTime());
    end.setDate(end.getDate() + 7);
  } else {
    start.setDate(1);
    end.setTime(start.getTime());
    end.setMonth(end.getMonth() + 1);
  }

  return { start, end };
}

export interface KpiDrillDown {
  /** Web hedefi — sayfa + opsiyonel query filtresi (örn. "/stok?filter=critical"). */
  href: string;
  /** Mobil hedefi — mantıksal ekran anahtarı; uygulama kendi route'una çevirir. */
  route: string;
  /** Mobil ekrana taşınacak opsiyonel filtre. */
  filter?: string;
}

export interface ExecutiveKpi {
  key: string;
  label: string;
  value: number | null;
  /** "currency" | "count" | "percent" | "score" — arayüz biçimlendirmesi için. */
  format: "currency" | "count" | "percent" | "score";
  /** Kartın vurgu tonu: uyarı kartları kırmızı/turuncu, finans yeşil vb. */
  tone: "neutral" | "success" | "warning" | "danger" | "info";
  /** Kısa alt açıklama (örn. "geçen ay: 12.000₺"). */
  hint?: string;
  drillDown: KpiDrillDown;
}

export interface ExecutiveSummary {
  range: ExecutiveRange;
  rangeStart: string;
  rangeEnd: string;
  generatedAt: string;
  sections: {
    finance: ExecutiveKpi[];
    operations: ExecutiveKpi[];
    staff: ExecutiveKpi[];
    customers: ExecutiveKpi[];
    alerts: ExecutiveKpi[];
  };
  /** Tüm bekleyen onayların kırılımı — birleşik kartın ardındaki detay. */
  pendingApprovalsBreakdown: {
    quotes: number;
    advances: number;
    leaveRequests: number;
    expiringContracts: number;
    jobReports: number;
    staffBonuses: number;
  };
}

const RANGE_LABEL: Record<ExecutiveRange, string> = {
  today: "bugün",
  week: "bu hafta",
  month: "bu ay",
};

export async function computeExecutiveSummary(
  range: ExecutiveRange,
  canViewFinance: boolean
): Promise<ExecutiveSummary> {
  const now = new Date();
  const { start, end } = rangeBounds(range, now);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  // Bu endpoint çok sayıda alt sorgu birleştirir — hepsi tek Promise.all
  // içinde PARALEL çalışır; sıralı await zinciri yok.
  const [
    payments,
    dashboard,
    lowStockProducts,
    overdueContracts,
    renewalDueCount,
    expiringCertCount,
    jobsInRange,
    completedInRange,
    cancelledInRange,
    pendingQuotes,
    pendingAdvances,
    pendingLeave,
    expiringContracts30d,
    pendingBonusesAgg,
    activeStaffCount,
    onLeaveStaffCount,
    evalScoreAgg,
    totalCustomers,
    newCustomersThisMonth,
    customerRatingAgg,
  ] = await Promise.all([
    computePaymentsSummary(canViewFinance),
    computeDashboardSummary(),
    findLowStockProducts(),
    findOverdueRecurringContracts(now),
    prisma.contract.count({ where: contractRenewalWindowWhere(now) }),
    prisma.staffCertification.count({ where: expiringCertificationsWhere(now) }),
    prisma.job.count({ where: { scheduledAt: { gte: start, lt: end } } }),
    prisma.job.count({ where: { status: JobStatus.COMPLETED, completedAt: { gte: start, lt: end } } }),
    prisma.job.count({ where: { status: JobStatus.CANCELLED, cancelledAt: { gte: start, lt: end } } }),
    prisma.quoteRequest.count({ where: { status: "NEW" } }),
    prisma.advanceRequest.count({ where: { status: AdvanceStatus.PENDING } }),
    prisma.leaveRequest.count({ where: { status: LeaveRequestStatus.PENDING } }),
    // "Bekleyen Onaylar" sayfasıyla aynı tanım: 30 gün içinde bitecek sözleşmeler
    // yenileme kararı bekliyor sayılır (bkz. /contracts/expiring).
    prisma.contract.count({
      where: { endDate: { gte: now, lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) } },
    }),
    prisma.staffBonus.aggregate({ _sum: { amount: true }, _count: true, where: { status: StaffBonusStatus.PENDING } }),
    prisma.staff.count({ where: { archivedAt: null } }),
    prisma.staff.count({ where: { archivedAt: null, status: StaffStatus.ON_LEAVE } }),
    // Ortalama değerlendirme puanı: yalnızca gönderilmiş/kilitli değerlendirmelerin
    // kriter puanları (taslaklar sayılmaz) — evaluationsController.computeAverage
    // ile aynı 1-20 ölçeği.
    prisma.evaluationScore.aggregate({
      _avg: { score: true },
      where: { evaluation: { status: { in: [EvaluationStatus.SUBMITTED, EvaluationStatus.LOCKED] } } },
    }),
    prisma.customer.count(),
    prisma.customer.count({ where: { createdAt: { gte: startOfMonth, lt: startOfNextMonth } } }),
    prisma.job.aggregate({ _avg: { rating: true }, where: { rating: { not: null } } }),
  ]);

  const rangeLabel = RANGE_LABEL[range];
  const completionRate =
    completedInRange + cancelledInRange > 0
      ? (completedInRange / (completedInRange + cancelledInRange)) * 100
      : null;

  const pendingApprovalsBreakdown = {
    quotes: pendingQuotes,
    advances: pendingAdvances,
    leaveRequests: pendingLeave,
    expiringContracts: expiringContracts30d,
    jobReports: dashboard.pendingReportApprovals,
    staffBonuses: pendingBonusesAgg._count,
  };
  const pendingApprovalsTotal = Object.values(pendingApprovalsBreakdown).reduce((a, b) => a + b, 0);

  const thisMonthTotal = payments.thisMonthTotal as number;
  const lastMonthTotal = payments.lastMonthTotal as number;

  const finance: ExecutiveKpi[] = [
    {
      key: "revenueThisMonth",
      label: "Bu Ay Ciro",
      value: thisMonthTotal,
      format: "currency",
      tone: "success",
      hint: `Geçen ay: ${lastMonthTotal.toLocaleString("tr-TR")}₺`,
      drillDown: { href: "/para?tab=payments", route: "finance", filter: "payments" },
    },
    {
      key: "revenueLastMonth",
      label: "Geçen Ay Ciro",
      value: lastMonthTotal,
      format: "currency",
      tone: "neutral",
      hint:
        payments.monthOverMonthChangePercent === null
          ? undefined
          : `Değişim: %${(payments.monthOverMonthChangePercent as number).toFixed(1)}`,
      drillDown: { href: "/raporlar", route: "reports" },
    },
    {
      key: "netProfitThisMonth",
      label: "Net Kâr (Bu Ay)",
      // view_finance izni olmayan MANAGER'a null döner — /payments/summary ile aynı kural.
      value: canViewFinance ? (payments.netProfitThisMonth as number) : null,
      format: "currency",
      tone: canViewFinance && (payments.netProfitThisMonth as number) < 0 ? "danger" : "success",
      hint: canViewFinance
        ? `Gider: ${(payments.totalExpensesThisMonth as number).toLocaleString("tr-TR")}₺ dahil`
        : "Finans görüntüleme izni gerekli",
      drillDown: { href: "/para?tab=expenses", route: "finance", filter: "expenses" },
    },
    {
      key: "outstandingBalance",
      label: "Bekleyen Bakiye",
      value: payments.totalOutstandingBalance as number,
      format: "currency",
      tone: (payments.totalOutstandingBalance as number) > 0 ? "warning" : "neutral",
      drillDown: { href: "/musteriler?filter=debt", route: "customers", filter: "debt" },
    },
    {
      key: "pendingBonuses",
      label: "Bekleyen Prim",
      value: Number(pendingBonusesAgg._sum.amount ?? 0),
      format: "currency",
      tone: pendingBonusesAgg._count > 0 ? "info" : "neutral",
      hint: `${pendingBonusesAgg._count} öneri`,
      drillDown: { href: "/performans?tab=bonuses", route: "performance", filter: "bonuses" },
    },
  ];

  const operations: ExecutiveKpi[] = [
    {
      key: "jobsInRange",
      label: `İş Sayısı (${rangeLabel})`,
      value: jobsInRange,
      format: "count",
      tone: "info",
      drillDown: { href: "/isler", route: "jobs", filter: range },
    },
    {
      key: "completionRate",
      label: `Tamamlanma Oranı (${rangeLabel})`,
      value: completionRate,
      format: "percent",
      tone: completionRate !== null && completionRate < 80 ? "warning" : "success",
      hint: `${completedInRange} tamamlandı / ${cancelledInRange} iptal`,
      drillDown: { href: "/isler?status=COMPLETED", route: "jobs", filter: "COMPLETED" },
    },
    {
      key: "pendingApprovals",
      label: "Bekleyen Onay",
      value: pendingApprovalsTotal,
      format: "count",
      tone: pendingApprovalsTotal > 0 ? "warning" : "success",
      hint: `${pendingQuotes} teklif · ${pendingAdvances} avans · ${pendingLeave} izin · ${expiringContracts30d} sözleşme`,
      drillDown: { href: "/bekleyen-onaylar", route: "approvals" },
    },
  ];

  const staff: ExecutiveKpi[] = [
    {
      key: "activeStaff",
      label: "Aktif Personel",
      value: activeStaffCount,
      format: "count",
      tone: "info",
      hint: `${dashboard.staffOnJobCount} sahada`,
      drillDown: { href: "/personel", route: "staff" },
    },
    {
      key: "avgEvaluationScore",
      label: "Ort. Değerlendirme Puanı",
      value: evalScoreAgg._avg.score === null ? null : Number(evalScoreAgg._avg.score),
      format: "score",
      tone: "neutral",
      hint: "1-20 ölçeği",
      drillDown: { href: "/performans?tab=evaluations", route: "performance", filter: "evaluations" },
    },
    {
      key: "staffOnLeave",
      label: "İzinli Personel",
      value: onLeaveStaffCount,
      format: "count",
      tone: "neutral",
      drillDown: { href: "/personel?filter=on_leave", route: "staff", filter: "on_leave" },
    },
    {
      key: "expiringCertifications",
      label: "Süresi Yaklaşan Sertifika",
      value: expiringCertCount,
      format: "count",
      tone: expiringCertCount > 0 ? "warning" : "success",
      hint: "30 gün içinde",
      drillDown: { href: "/personel?filter=expiring_certs", route: "staff", filter: "expiring_certs" },
    },
  ];

  const customers: ExecutiveKpi[] = [
    {
      key: "totalCustomers",
      label: "Toplam Müşteri",
      value: totalCustomers,
      format: "count",
      tone: "info",
      drillDown: { href: "/musteriler", route: "customers" },
    },
    {
      key: "newCustomersThisMonth",
      label: "Bu Ay Yeni Müşteri",
      value: newCustomersThisMonth,
      format: "count",
      tone: "success",
      drillDown: { href: "/musteriler?filter=new", route: "customers", filter: "new" },
    },
    {
      key: "avgCustomerRating",
      label: "Ort. Müşteri Puanı",
      value: customerRatingAgg._avg.rating === null ? null : Number(customerRatingAgg._avg.rating),
      format: "score",
      tone: "neutral",
      hint: "1-5 ölçeği",
      drillDown: { href: "/isler?status=COMPLETED", route: "jobs", filter: "COMPLETED" },
    },
  ];

  const alerts: ExecutiveKpi[] = [
    {
      key: "criticalStock",
      label: "Kritik Stok",
      value: lowStockProducts.length,
      format: "count",
      tone: lowStockProducts.length > 0 ? "danger" : "success",
      drillDown: { href: "/stok?filter=critical", route: "stock", filter: "critical" },
    },
    {
      key: "contractsRenewalDue",
      label: "Yenileme Yaklaşan Sözleşme",
      value: renewalDueCount,
      format: "count",
      tone: renewalDueCount > 0 ? "warning" : "success",
      hint: "7 gün içinde",
      drillDown: { href: "/sozlesmeler?filter=renewal", route: "contracts", filter: "renewal" },
    },
    {
      key: "contractsAutomationOverdue",
      label: "Gecikmiş Sözleşme Otomasyonu",
      value: overdueContracts.length,
      format: "count",
      tone: overdueContracts.length > 0 ? "danger" : "success",
      drillDown: { href: "/sozlesmeler?filter=overdue", route: "contracts", filter: "overdue" },
    },
  ];

  return {
    range,
    rangeStart: start.toISOString(),
    rangeEnd: end.toISOString(),
    generatedAt: now.toISOString(),
    sections: { finance, operations, staff, customers, alerts },
    pendingApprovalsBreakdown,
  };
}

export async function getExecutiveSummary(req: Request, res: Response) {
  const range = parseRange(req.query.range);
  const canViewFinance = await canUserViewFinance(req.user!.sub, req.user!.role);
  return res.json(await computeExecutiveSummary(range, canViewFinance));
}

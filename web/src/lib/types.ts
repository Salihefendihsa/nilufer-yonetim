import type { Role } from "./auth";

/**
 * Prisma `Decimal` alanları JSON'a **string** olarak serileşir
 * (`"currentStock": "-8"`), `Int`/`Float` alanları ise sayı olarak gelir.
 * Sayısal karşılaştırma yapmadan önce `decimalValue()` (bkz. lib/format.ts)
 * ile dönüştürün — ham `<=` karşılaştırması string sıralaması yapar ve
 * `"13" <= "4"` gibi yanlış sonuç verir.
 */
export type ApiDecimal = number | string;

export type JobStatus = "PENDING" | "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export interface Customer {
  id: string;
  userId: string | null;
  fullName: string;
  phone: string;
  email: string | null;
  address: string | null;
  district: string | null;
  createdAt: string;
}

export interface Job {
  id: string;
  customerId: string;
  assignedStaffId: string | null;
  serviceType: string;
  status: JobStatus;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  notes: string | null;
  price: number | null;
  rating: number | null;
  ratingComment: string | null;
  createdAt: string;
  calendarLink: string | null;
  sequenceNo: number;
  scheduledEndAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  /** Liste/detay yanıtına gömülü — ayrıca /customers veya /staff çağırmaya gerek bırakmaz. */
  customer?: { fullName: string };
  assignedStaff?: { user: { fullName: string } } | null;
}

export interface Payment {
  id: string;
  customerId: string;
  amount: number;
  paymentType: string;
  receiptUrl: string | null;
  referenceNo: string | null;
  collectedByStaffId: string | null;
  createdAt: string;
  customer?: { id: string; fullName: string };
  collectedByStaff?: { id: string; user: { fullName: string } } | null;
}

export interface Contract {
  id: string;
  customerId: string;
  startDate: string;
  endDate: string;
  durationMonths: number;
  status: string;
  serviceType: string | null;
  amount: number | null;
  pdfUrl: string | null;
  recurrenceType: RecurrenceType | null;
  nextGenerationDate: string | null;
  createdAt: string;
  customer?: { id: string; fullName: string; district: string | null };
}

export interface ContractsSummary {
  byStatus: Record<string, number>;
  totalCount: number;
  activeCount: number;
  expiringIn30DaysCount: number;
  /** Periyodu aylığa normalize edilmiş tekrarlayan gelir. */
  monthlyRecurringRevenue: number;
  activeContractValueTotal: number;
}

export interface JobReport {
  id: string;
  jobId: string;
  staffId: string;
  productId: string | null;
  quantity: number | null;
  productsUsed: string | null;
  dosage: string;
  notes: string | null;
  signatureUrl: string | null;
  pdfUrl: string | null;
  createdAt: string;
  approvedAt: string | null;
  approvedByUserId: string | null;
  approvedBy?: { fullName: string } | null;
}

export interface CustomerListItem extends Customer {
  jobCount: number;
  lastJobDate: string | null;
  activeContractCount: number;
  outstandingBalance: number;
}

export interface CustomerDetail extends Customer {
  jobs: Job[];
  payments: Payment[];
  contracts: Contract[];
  outstandingBalance: number;
}

export interface StaffUser {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: string;
}

export interface UnlinkedUser {
  id: string;
  email: string;
  fullName: string;
}

export type StaffStatus = "AVAILABLE" | "ON_JOB" | "ON_BREAK" | "ON_LEAVE" | "OFFLINE";

export interface Staff {
  id: string;
  userId: string;
  position: string;
  salaryBase: number;
  supervisorId: string | null;
  status: StaffStatus;
  statusUntil: string | null;
  createdAt: string;
  user: StaffUser;
  vehiclePlate: string | null;
  dailyJobCapacity: number | null;
  /** Liste yanıtında sunucu tarafında hesaplanır (personel başına ek istek yok). */
  todaysJobsCount?: number;
  expiringCertificationCount?: number;
  averageRating?: number | null;
  ratedJobsCount?: number;
  /** backend/src/lib/access.ts:resolveSupervisorInfo — supervisorId bir
   * Staff.id (TEAM_LEAD) veya User.id (MANAGER/OWNER) olabilir, ikisi de
   * burada tek bir tutarlı şekle çözülür. */
  supervisor?: { userId: string; fullName: string; role: "TEAM_LEAD" | "MANAGER" | "OWNER" } | null;
  /** Dolu ise bu kayıt arşivlenmiş (terfi/işten çıkarma) — GET /staff?includeArchived=true dışında hiçbir listede görünmez. */
  archivedAt?: string | null;
}

export interface StaffDetail extends Staff {
  todaysJobs: Job[];
}

export type AdvanceStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface AdvanceRequest {
  id: string;
  staffId: string;
  amount: number;
  reason: string;
  status: AdvanceStatus;
  createdAt: string;
  staff?: { user: { fullName: string } };
}

export type LeaveRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface LeaveRequest {
  id: string;
  staffId: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: LeaveRequestStatus;
  requestedAt: string;
  decidedAt: string | null;
  decidedByUserId: string | null;
  decisionNote: string | null;
  staff?: { user: { fullName: string } };
}

export interface QuoteRequest {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  propertyType: string;
  serviceType: string;
  address: string | null;
  district: string | null;
  amount: number | null;
  status: string;
  note: string | null;
  surveyAt: string | null;
  convertedAt: string | null;
  createdAt: string;
}

/** GET /quotes/:id/history — yalnızca bu teklife ait denetim kayıtları. */
export interface QuoteHistoryEntry {
  id: string;
  action: string;
  detail: string | null;
  createdAt: string;
  actor: { fullName: string };
}

export interface QuotesSummary {
  byStatus: Record<string, number>;
  totalCount: number;
  openAmountTotal: number;
  convertedAmountTotal: number;
  /** CONVERTED / (CONVERTED + REJECTED); hiç sonuçlanmamışsa null. */
  conversionRate: number | null;
}

export interface ConversationParticipant {
  id: string;
  fullName: string;
  role: string;
}

export interface MessageItem {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  readAt: string | null;
  createdAt: string;
  /** Saha fotoğrafı eki (göreli /uploads yolu). */
  attachmentUrl: string | null;
  attachmentType: string | null;
}

export interface ConversationSummary {
  id: string;
  participant: ConversationParticipant;
  lastMessage: MessageItem | null;
  unreadCount: number;
  updatedAt: string;
}

export interface AllConversationSummary {
  id: string;
  participantA: ConversationParticipant;
  participantB: ConversationParticipant;
  lastMessage: MessageItem | null;
  messageCount: number;
  updatedAt: string;
}

export interface ObserverAccessGrant {
  id: string;
  requestedByUserId: string;
  reason: string;
  expiresAt: string | null;
  isEmergency: boolean;
  createdAt: string;
}

export interface AvailableContact {
  id: string;
  fullName: string;
  email: string;
  role: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  body: string | null;
  type: string | null;
  relatedType: string | null;
  relatedId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  actorUserId: string;
  action: string;
  targetUserId: string;
  targetType: string | null;
  targetId: string | null;
  detail: string | null;
  createdAt: string;
  actor: { id: string; fullName: string; email: string };
  target: { id: string; fullName: string; email: string };
}

export interface ActivityEvent {
  timestamp: string;
  text: string;
}

export interface SystemHealth {
  database: "healthy" | "down";
  api: "healthy" | "down";
  uptimeSeconds: number;
  totalRequestsToday: number;
  errorCount24h: number;
  emailConfigured: boolean;
}

export type ProductCategory = "BIOCIDAL" | "CONSUMABLE" | "EQUIPMENT" | "DISINFECTANT";

export type StockMovementType = "IN" | "OUT";

export interface StockMovement {
  id: string;
  productId: string;
  type: StockMovementType;
  quantity: ApiDecimal;
  note: string | null;
  createdAt: string;
}

export interface Product {
  id: string;
  code: string | null;
  name: string;
  unit: string;
  description: string | null;
  category: ProductCategory;
  currentStock: ApiDecimal;
  criticalThreshold: ApiDecimal;
  createdAt: string;
  /** Liste yanıtında sunucu tarafında eklenir. */
  lastMovement?: Pick<StockMovement, "type" | "quantity" | "note" | "createdAt"> | null;
  pendingPurchaseQuantity?: number;
}

export type PurchaseRequestStatus = "PENDING" | "RECEIVED" | "CANCELLED";

export interface StockPurchaseRequest {
  id: string;
  productId: string;
  quantity: ApiDecimal;
  status: PurchaseRequestStatus;
  note: string | null;
  requestedByUserId: string;
  receivedAt: string | null;
  receivedByUserId: string | null;
  createdAt: string;
  product?: { id: string; name: string; unit: string; code: string | null };
  requestedBy?: { fullName: string };
}

export type RecurrenceType = "MONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL";

export type LeaderboardPeriod = "this_month" | "last_month" | "this_year";

export interface StaffLeaderboardEntry {
  staffId: string;
  fullName: string;
  position: string;
  completedJobsThisMonth: number;
  completedJobsLastMonth: number;
  /** Seçili döneme ait tamamlanan iş sayısı. */
  completedJobsInPeriod: number;
  completedJobsPreviousPeriod: number;
  averageRating: number | null;
  ratedJobsCount: number;
  /**
   * Zamanında tamamlama oranı. Kural: `scheduledEndAt` varsa ona göre, yoksa
   * `scheduledAt` ile aynı gün. Planı olmayan iş ölçüme dahil edilmez;
   * ölçülebilir iş yoksa null döner.
   */
  onTimeRate: number | null;
  onTimeMeasuredJobs: number;
  /** Aylık iş hedefi tanımlı değilse null. */
  targetCompletionPercent: number | null;
}

export interface StaffLeaderboardSummary {
  totalCompletedThisMonth: number;
  totalCompletedLastMonth: number;
  totalCompletedInPeriod: number;
  totalCompletedPreviousPeriod: number;
  staffCount: number;
  averageRating: number | null;
  ratedJobsCount: number;
  onTimeRate: number | null;
  jobsPerStaff: number;
}

export interface SearchResults {
  customers: { id: string; label: string; sublabel: string }[];
  staff: { id: string; label: string; sublabel: string }[];
  jobs: { id: string; label: string; sublabel: string }[];
}

export interface ServiceType {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
}

export interface District {
  id: string;
  name: string;
  isActive: boolean;
}

export type JobPhotoType = "BEFORE" | "AFTER";

export interface OrgChartNode {
  id: string;
  userId: string;
  fullName: string;
  role: Role;
  position: string | null;
  status: StaffStatus | null;
  assignedCustomers: { id: string; fullName: string }[];
  children: OrgChartNode[];
}

export interface OrgChartResponse {
  tree: OrgChartNode[];
  unassigned: Omit<OrgChartNode, "children">[];
}

export interface EvaluationCriterion {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface EvaluationPeriod {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  isLocked: boolean;
  createdAt: string;
}

export type EvaluationStatus = "DRAFT" | "SUBMITTED" | "LOCKED";

export interface EvaluationScoreItem {
  id: string;
  criterionId: string;
  score: number;
  criterion: EvaluationCriterion;
}

export interface Evaluation {
  id: string;
  /** OWNER/MANAGER için dolu; STAFF/TEAM_LEAD kendi kaydını görürken backend bu alanları hiç döndürmez. */
  evaluatorUserId?: string;
  evaluator?: { id: string; fullName: string };
  targetStaffId: string;
  periodId: string;
  status: EvaluationStatus;
  comment: string | null;
  managerScore: number | null;
  submittedAt: string | null;
  lockedAt: string | null;
  createdAt: string;
  updatedAt: string;
  scores: EvaluationScoreItem[];
  averageScore: number | null;
}

export interface JobPhoto {
  id: string;
  jobId: string;
  url: string;
  type: JobPhotoType;
  uploadedByUserId: string;
  createdAt: string;
}

export interface StaffCertification {
  id: string;
  staffId: string;
  name: string;
  issuedDate: string;
  expiryDate: string;
  documentUrl: string | null;
  createdAt: string;
}

export interface ExpiringCertification extends StaffCertification {
  staff: { user: { fullName: string } };
}

export interface RevenueTrendPoint {
  label: string;
  total: number;
}

export interface ServiceBreakdownEntry {
  serviceType: string;
  count: number;
  percentage: number;
}

export interface TopDistrictEntry {
  district: string;
  count: number;
}

export interface CustomerRetention {
  newCustomers: number;
  returningCustomers: number;
}

export interface SessionReportEntry {
  userId: string;
  fullName: string;
  role: string;
  totalSessions: number;
  averageDurationMinutes: number;
  lastLoginAt: string;
  isApproximate: boolean;
}

export type SettingsMap = Record<string, string>;

export interface NotificationPreference {
  id: string;
  userId: string;
  emailEnabled: boolean;
  dailyDigestEnabled: boolean;
  updatedAt: string;
}

export interface DashboardSummary {
  todaysJobsCount: number;
  thisMonthPaymentsTotal: number;
  newQuoteRequestsCount: number;
  activeStaffCount: number;
  completedJobsThisMonth: number;
  todaysJobsByStatus: Record<JobStatus, number>;
  todaysServiceBreakdown: { serviceType: string; count: number }[];
  staffByStatus: Record<StaffStatus, number>;
  staffOnJobCount: number;
  completedJobsLastMonth: number;
  cancelledJobsThisMonth: number;
  /** tamamlanan / (tamamlanan + iptal); hiç sonuçlanan iş yoksa null. */
  completionRateThisMonth: number | null;
  pendingReportApprovals: number;
}

export interface PaymentsSummary {
  thisMonthTotal: number;
  thisMonthPaymentCount: number;
  allTimeTotal: number;
  totalOutstandingBalance: number;
  pendingAdvancesTotal: number;
  pendingAdvancesCount: number;
  lastMonthTotal: number;
  monthOverMonthChangePercent: number | null;
  paymentTypeBreakdown: { paymentType: string; total: number; count: number }[];
  /** OWNER ayarlarından gelir; tanımsızsa null (varsayılan uydurulmaz). */
  monthlyRevenueTarget: number | null;
  revenueTargetCompletionPercent: number | null;
  /** Yalnızca OWNER veya view_finance yetkisi olanlara döner. */
  netProfitThisMonth?: number;
  profitMargin?: number | null;
}

/** GET /team/summary — şef ana sayfası (yalnızca doğrudan ekip kapsamı). */
export interface TeamSummary {
  teamSize: number;
  todaysJobsCount: number;
  todaysJobsByStatus: Record<JobStatus, number>;
  completedTodayCount: number;
  /** Bugün hiç iş yoksa null — "%0" uydurulmaz. */
  completionRateToday: number | null;
  activeTechnicianCount: number;
  staffByStatus: Record<StaffStatus, number>;
  workload: TeamWorkloadEntry[];
}

export interface TeamWorkloadEntry {
  staffId: string;
  fullName: string;
  position: string;
  status: StaffStatus;
  vehiclePlate: string | null;
  /** Tanımlı değilse doluluk yüzdesi gösterilmez. */
  dailyJobCapacity: number | null;
  todaysJobsCount: number;
}

/** GET /team/calendar — aylık yoğunluk + kapasite. */
export interface TeamCalendar {
  month: string;
  days: { date: string; jobCount: number }[];
  /** Ekip üyelerinin `dailyJobCapacity` toplamı; hiçbiri tanımlı değilse null. */
  dailyCapacity: number | null;
  today: { jobCount: number; capacity: number | null };
  thisWeek: { jobCount: number; capacity: number | null };
  busiestDay: { date: string; jobCount: number } | null;
}

/** GET /notifications/summary */
export interface NotificationSummary {
  total: number;
  unread: number;
  today: number;
  byCategory: Record<string, number>;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  pagination: Pagination;
}

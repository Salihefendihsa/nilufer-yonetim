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

/** Bölüm AB (6. tur): müşteri belgesi (GET /customers/:id/documents). */
export interface CustomerDocument {
  id: string;
  customerId: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
  uploadedBy?: { id: string; fullName: string } | null;
}

/** Bölüm X (6. tur): müşteri etiketi (GET /customer-tags). */
export interface CustomerTag {
  id: string;
  name: string;
  /** #RRGGBB */
  color: string;
  isActive: boolean;
  createdAt?: string;
  /** Yalnızca /customer-tags listesinde. */
  customerCount?: number;
}

export interface Customer {
  id: string;
  userId: string | null;
  fullName: string;
  phone: string;
  email: string | null;
  address: string | null;
  district: string | null;
  createdAt: string;
  /** Bölüm X: liste/detay yanıtında düz etiket listesi. */
  tags?: Pick<CustomerTag, "id" | "name" | "color">[];
}

export interface JobChecklistEntry {
  item: string;
  isChecked: boolean;
  checkedAt: string | null;
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
  /** Bölüm S (5. tur): yapılandırılmış geri bildirim (genel puandan bağımsız, bir kez). */
  serviceQualityScore?: number | null;
  punctualityScore?: number | null;
  staffProfessionalismScore?: number | null;
  wouldRecommend?: boolean | null;
  feedbackComment?: string | null;
  feedbackSubmittedAt?: string | null;
  /** Bölüm Y (6. tur): garanti bitişi — tamamlanınca hesaplanır; türde tanımlı değilse null. */
  warrantyExpiresAt?: string | null;
  createdAt: string;
  calendarLink: string | null;
  /** Bölüm N (4. tur): iş öncesi kontrol listesi (GET /jobs/:id her zaman tam şablonu döner). */
  checklist?: JobChecklistEntry[];
  sequenceNo: number;
  scheduledEndAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  /** Liste/detay yanıtına gömülü — ayrıca /customers veya /staff çağırmaya gerek bırakmaz. */
  customer?: { fullName: string; phone?: string; address?: string | null; district?: string | null };
  assignedStaff?: { user: { fullName: string } } | null;
}

/**
 * Bölüm O (4. tur): "Yol Tarifi" — müşteri adresi (+ semt) için Google Maps
 * arama linki. Adres yoksa null (buton gizlenir).
 */
export function directionsUrl(customer?: { address?: string | null; district?: string | null } | null): string | null {
  const query = [customer?.address, customer?.district].filter((x) => x && x.trim()).join(", ");
  if (!query) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
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
  /** Bölüm Q (4. tur): müşteri duraklattı — otomatik iş üretimi durur. */
  isPaused?: boolean;
  pausedAt?: string | null;
  createdAt: string;
  customer?: { id: string; fullName: string; district: string | null };
}

/** Bölüm E (2. tur) — GET /contracts/health-check. */
export interface ContractHealthCheckItem {
  id: string;
  customerId: string;
  customerName: string;
  serviceType: string | null;
  recurrenceType: RecurrenceType | null;
  nextGenerationDate: string;
  daysOverdue: number;
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

/** Bölüm Q (4. tur): personel başarı kademesi (leaderboard / evaluation). */
export type AchievementTier = "GOLD" | "SILVER" | "BRONZE";

export interface CustomerListItem extends Customer {
  /** Bölüm Q: tamamlanmış iş sayısı ve "Sadık Müşteri" rozeti (backend hesaplar). */
  completedJobCount?: number;
  isLoyal?: boolean;
  jobCount: number;
  lastJobDate: string | null;
  activeContractCount: number;
  outstandingBalance: number;
}

export interface CustomerDetail extends Customer {
  completedJobCount?: number;
  isLoyal?: boolean;
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

/** Bölüm K (3. tur): personelin hafif "müsait değilim" işareti (startTime/endTime null = tüm gün). */
export interface StaffUnavailability {
  id: string;
  staffId: string;
  /** YYYY-MM-DD */
  date: string;
  startTime: string | null;
  endTime: string | null;
  reason: string | null;
  createdAt: string;
}

/** Bölüm P (4. tur): GET /customers/me/referral */
export interface CustomerReferral {
  referralCode: string;
  inviteLink: string;
  referredCount: number;
  referred: { id: string; fullName: string; createdAt: string }[];
}

/** Bölüm J (3. tur): giriş yapmış müşterinin kendi randevu talebi. */
export type AppointmentRequestStatus = "PENDING" | "SCHEDULED" | "DECLINED";

export interface AppointmentRequest {
  id: string;
  customerId: string;
  serviceTypeId: string;
  preferredDateStart: string;
  preferredDateEnd: string;
  note: string | null;
  status: AppointmentRequestStatus;
  respondedByUserId: string | null;
  respondedAt: string | null;
  declineReason: string | null;
  resultingJobId: string | null;
  createdAt: string;
  customer?: { id: string; fullName: string; phone: string };
  serviceType?: { id: string; name: string };
  respondedByUser?: { id: string; fullName: string } | null;
  resultingJob?: { id: string; sequenceNo: number; scheduledAt: string | null; status: JobStatus } | null;
  /** Bölüm Y: yönetim listesinde, aynı hizmet türünde geçerli garanti varsa. */
  activeWarranty?: ActiveWarranty | null;
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
  /** Bölüm W (5. tur): son 30 gün OUT kullanımına göre tükenme tahmini; veri yoksa alanlar null. */
  forecast?: StockForecast;
}

export interface StockForecast {
  windowDays: number;
  usedInWindow: number;
  dailyAverageUsage: number | null;
  estimatedDaysRemaining: number | null;
  estimatedDepletionDate: string | null;
  note: string | null;
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
  supplierId: string | null;
  orderTrackingNumber: string | null;
  product?: { id: string; name: string; unit: string; code: string | null };
  requestedBy?: { fullName: string };
  supplier?: { id: string; name: string } | null;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  isActive: boolean;
  createdAt: string;
}

export type RecurrenceType = "MONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL";

export type LeaderboardPeriod = "this_month" | "last_month" | "this_year";

export interface StaffLeaderboardEntry {
  staffId: string;
  fullName: string;
  position: string;
  /** Bölüm Q: gönderilmiş değerlendirmelerin kriter ortalaması (1–20) ve kademe. */
  evaluationAverageScore?: number | null;
  achievementTier?: AchievementTier | null;
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

/** Bölüm I (3. tur): GET /search — tüm varlık türleri tek normalize listede. */
export type SearchResultType = "customer" | "job" | "staff" | "contract" | "quote";

export interface SearchResult {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle: string;
  route: string;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
}

/** Bölüm V (5. tur): GET /evaluations/staff/:staffId/history */
export interface EvaluationHistoryPoint {
  evaluationId: string;
  periodId: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  submittedAt: string | null;
  averageScore: number | null;
  achievementTier: AchievementTier | null;
  /** Yalnızca OWNER/MANAGER'a döner. */
  evaluatorUserId?: string;
  evaluator?: { id: string; fullName: string };
}

export interface EvaluationHistory {
  staffId: string;
  staffName: string;
  data: EvaluationHistoryPoint[];
  overallAverage: number | null;
  lastDelta: number | null;
}

/** Bölüm U (5. tur): işe alım kontrol listesi (GET /staff/:id/onboarding). */
export interface OnboardingItem {
  id: string;
  staffId: string;
  item: string;
  sortOrder: number;
  isCompleted: boolean;
  completedAt: string | null;
  completedByUserId: string | null;
  completedBy?: { id: string; fullName: string } | null;
}

export interface OnboardingChecklist {
  staffId: string;
  items: OnboardingItem[];
  progress: { total: number; completed: number; percent: number; isComplete: boolean };
}

/** Bölüm T (5. tur): iş şablonu (GET /job-templates). */
export interface JobTemplate {
  id: string;
  name: string;
  serviceType: string;
  defaultPrice: number | string | null;
  defaultDurationMinutes: number | null;
  defaultNotes: string | null;
  isActive: boolean;
  createdAt: string;
}

/** Bölüm Z (6. tur): GET /jobs/suggest-staff satırı — öneri, otomatik atama değil. */
export interface StaffSuggestion {
  staffId: string;
  fullName: string;
  position: string;
  status: StaffStatus;
  todayJobCount: number;
  isUnavailable: boolean;
  unavailableReason: string | null;
  isRecommended: boolean;
}

/** Bölüm Y (6. tur): GET /customers/:id/active-warranties satırı. */
export interface ActiveWarranty {
  jobId: string;
  serviceType: string;
  completedAt: string | null;
  warrantyExpiresAt: string;
  daysLeft: number;
}

export interface ServiceType {
  id: string;
  name: string;
  isActive: boolean;
  /** Bölüm Y: varsayılan garanti (gün); null → takip yok. */
  defaultWarrantyDays?: number | null;
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
  /** Bölüm C (2. tur) — ikisi de doluysa dönem kilitlenirken otomatik prim önerisi üretilir. */
  bonusThreshold: number | null;
  bonusAmount: number | null;
}

export type StaffBonusStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface StaffBonus {
  id: string;
  staffId: string;
  evaluationPeriodId: string;
  evaluationId: string;
  amount: number;
  status: StaffBonusStatus;
  approvedByUserId: string | null;
  approvedAt: string | null;
  createdAt: string;
  staff?: { user: { id: string; fullName: string } };
  evaluationPeriod?: { id: string; label: string };
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

/** Bölüm AA (6. tur): GET /analytics/year-over-year satırı. */
export interface YearOverYearPoint {
  month: string;
  thisYearLabel: string;
  lastYearLabel: string;
  thisYear: number;
  lastYear: number;
  changePercent: number | null;
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

/** Bölüm S (5. tur): GET /analytics/feedback-summary */
export interface FeedbackSummary {
  responseCount: number;
  serviceQualityAvg: number | null;
  punctualityAvg: number | null;
  staffProfessionalismAvg: number | null;
  recommendRate: number | null;
  recommendAnswered: number;
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
  totalExpensesThisMonth?: number;
}

export type ExpenseCategory = "FUEL" | "CHEMICALS" | "EQUIPMENT" | "RENT" | "UTILITIES" | "OTHER";

export interface Expense {
  id: string;
  category: ExpenseCategory;
  amount: number;
  description: string | null;
  date: string;
  recordedByUserId: string;
  receiptUrl: string | null;
  createdAt: string;
  recordedByUser?: { fullName: string };
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

/** Bölüm M (4. tur): GET /team/daily-briefing */
export interface TeamBriefingMember extends TeamWorkloadEntry {
  isSelf: boolean;
  onLeave: boolean;
  leaveUntil: string | null;
  unavailable: boolean;
  unavailableAllDay: boolean;
  unavailableRanges: string[];
  unavailableReason: string | null;
}

export interface TeamDailyBriefing {
  date: string;
  teamSize: number;
  todaysJobsCount: number;
  completedTodayCount: number;
  completionRateToday: number | null;
  staffByStatus: Record<StaffStatus, number>;
  availableNowCount: number;
  onLeaveCount: number;
  unavailableCount: number;
  members: TeamBriefingMember[];
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

// --- Bölüm G (2. tur): Yönetici Özet Paneli ---

export type ExecutiveRange = "today" | "week" | "month";

export interface ExecutiveKpi {
  key: string;
  label: string;
  value: number | null;
  format: "currency" | "count" | "percent" | "score";
  tone: "neutral" | "success" | "warning" | "danger" | "info";
  hint?: string;
  drillDown: { href: string; route: string; filter?: string };
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
  pendingApprovalsBreakdown: {
    quotes: number;
    advances: number;
    leaveRequests: number;
    expiringContracts: number;
    jobReports: number;
    staffBonuses: number;
  };
}

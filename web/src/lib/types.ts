export type JobStatus = "PENDING" | "SCHEDULED" | "COMPLETED" | "CANCELLED";

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
  completedAt: string | null;
  notes: string | null;
  price: number | null;
  rating: number | null;
  ratingComment: string | null;
  createdAt: string;
  calendarLink: string | null;
}

export interface Payment {
  id: string;
  customerId: string;
  amount: number;
  paymentType: string;
  receiptUrl: string | null;
  createdAt: string;
}

export interface Contract {
  id: string;
  customerId: string;
  startDate: string;
  endDate: string;
  durationMonths: number;
  status: string;
  pdfUrl: string | null;
  recurrenceType: "MONTHLY" | "QUARTERLY" | null;
  nextGenerationDate: string | null;
  createdAt: string;
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

export interface Staff {
  id: string;
  userId: string;
  position: string;
  salaryBase: number;
  supervisorId: string | null;
  createdAt: string;
  user: StaffUser;
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

export interface QuoteRequest {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  propertyType: string;
  serviceType: string;
  address: string | null;
  district: string | null;
  status: string;
  createdAt: string;
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

export interface Product {
  id: string;
  name: string;
  unit: string;
  currentStock: number;
  criticalThreshold: number;
  createdAt: string;
}

export type RecurrenceType = "MONTHLY" | "QUARTERLY";

export interface StaffLeaderboardEntry {
  staffId: string;
  fullName: string;
  position: string;
  completedJobsThisMonth: number;
  averageRating: number | null;
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

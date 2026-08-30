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
  createdAt: string;
}

export interface JobReport {
  id: string;
  jobId: string;
  staffId: string;
  productsUsed: string;
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

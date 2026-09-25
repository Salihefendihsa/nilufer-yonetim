import type { AuditLog } from "@prisma/client";
import { prisma } from "./prisma";
import { PERMISSION_LABELS, isPermissionKey } from "./permissions";

/**
 * Denetim logu → okunabilir Türkçe.
 *
 * AuditLog satırları makine biçiminde yazılır (action: "contract.create",
 * detail: "customerId=<uuid>, amount=…" ya da JSON). Ekranlar önceden bunları
 * olduğu gibi gösteriyordu. Çeviri tek yerde — burada — yapılır; web ve mobil
 * `actionLabel` / `targetLabel` / `detailText` alanlarını gösterir, ham
 * alanlar (action/detail) filtreleme ve geriye dönük uyumluluk için kalır.
 */

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "admin.clear_demo_data": "Demo veriler temizlendi",
  "admin.impersonation_started": "Kullanıcı olarak giriş başlatıldı",
  "admin.impersonation_ended": "Kullanıcı olarak giriş sonlandırıldı",
  "advance.approve": "Avans talebi onaylandı",
  "advance.reject": "Avans talebi reddedildi",
  "advance.status_update": "Avans talebi güncellendi",
  "announcement.create": "Duyuru yayınlandı",
  "announcement.deactivate": "Duyuru kaldırıldı",
  "appointment_request.created": "Randevu talebi oluşturuldu",
  "appointment_request.scheduled": "Randevu talebi planlandı",
  "appointment_request.declined": "Randevu talebi reddedildi",
  "auth.password_reset_by_owner": "Şifre patron tarafından sıfırlandı",
  "complaint.created": "Şikayet kaydedildi",
  "complaint.updated": "Şikayet güncellendi",
  "staff_request.created": "Personel talebi oluşturuldu",
  "staff_request.updated": "Personel talebi yanıtlandı",
  "contract.create": "Sözleşme oluşturuldu",
  "contract.update": "Sözleşme güncellendi",
  "contract.renew": "Sözleşme yenilendi",
  "contract.paused": "Sözleşme duraklatıldı",
  "contract.resumed": "Sözleşme devam ettirildi",
  "conversation.team_broadcast": "Ekibe toplu mesaj gönderildi",
  "customer.delete": "Müşteri silindi",
  "customer.import_csv": "Müşteriler CSV'den içe aktarıldı",
  "customer.data_export": "Müşteri verileri dışa aktarıldı",
  "customer_document.uploaded": "Müşteri belgesi yüklendi",
  "customer_document.deleted": "Müşteri belgesi silindi",
  "customer_tag.deleted": "Müşteri etiketi silindi",
  "data_deletion.requested": "Veri silme talebi (KVKK) oluşturuldu",
  "data_deletion.approved": "Veri silme talebi onaylandı, veriler anonimleştirildi",
  "data_deletion.rejected": "Veri silme talebi reddedildi",
  "evaluation.created": "Personel değerlendirmesi oluşturuldu",
  "evaluation.updated": "Personel değerlendirmesi güncellendi",
  "evaluation.submitted": "Personel değerlendirmesi gönderildi",
  "expense.deleted": "Gider kaydı silindi",
  "job.pending": "İş beklemeye alındı",
  "job.scheduled": "İş planlandı",
  "job.in_progress": "İş başlatıldı",
  "job.completed": "İş tamamlandı",
  "job.cancelled": "İş iptal edildi",
  "job.reassign": "İş başka personele atandı",
  "job.report.approve": "Saha raporu onaylandı",
  "leave_request.created": "İzin talebi oluşturuldu",
  "leave_request.approved": "İzin talebi onaylandı",
  "leave_request.rejected": "İzin talebi reddedildi",
  "observer.access_granted": "Mesaj gözlemci erişimi verildi",
  "observer.emergency_access_granted": "Acil gözlemci erişimi verildi",
  "observer.access_used": "Gözlemci erişimi kullanıldı",
  "onboarding.item_completed": "İşe başlangıç adımı tamamlandı",
  "onboarding.item_reopened": "İşe başlangıç adımı yeniden açıldı",
  "payment.create": "Tahsilat kaydedildi",
  "product.restock": "Stok girişi yapıldı",
  "product.delete": "Ürün silindi",
  "quote.update": "Teklif güncellendi",
  "quote.convert": "Teklif müşteriye dönüştürüldü",
  "staff.update": "Personel bilgileri güncellendi",
  "staff.delete": "Personel silindi",
  "staff.status.update": "Personel durumu değiştirildi",
  "staff.role_changed": "Personel rolü değiştirildi",
  "staff.promoted_to_manager": "Personel müdürlüğe terfi ettirildi",
  "staff.permissions.update": "Personel yetkileri güncellendi",
  "staff.calendar_token.rotate": "Takvim bağlantısı yenilendi",
  "staff_bonus.approved": "Prim onaylandı",
  "staff_bonus.rejected": "Prim reddedildi",
  "stock.count_adjustment": "Stok sayım düzeltmesi yapıldı",
  "stock.purchase_request.create": "Satın alma talebi oluşturuldu",
  "stock.purchase_request.received": "Satın alma talebi teslim alındı",
  "stock.purchase_request.cancelled": "Satın alma talebi iptal edildi",
  "user.2fa_enabled": "İki adımlı doğrulama etkinleştirildi",
  "user.2fa_disabled": "İki adımlı doğrulama kapatıldı",
  "user.terminated": "Kullanıcının işine son verildi",
  "user.reactivated": "Kullanıcı yeniden aktifleştirildi",
  "user.demoted_from_manager": "Müdürlükten personele alındı",
  "vehicle_maintenance.create": "Araç bakım kaydı eklendi",
};

/** Bilinmeyen kodlar için okunur bir yedek: "foo_bar.baz" → "Foo bar baz". */
export function auditActionLabel(action: string): string {
  const known = AUDIT_ACTION_LABELS[action];
  if (known) return known;
  const words = action.replace(/[._]/g, " ").trim();
  return words.charAt(0).toLocaleUpperCase("tr-TR") + words.slice(1);
}

const FIELD_LABELS: Record<string, string> = {
  status: "Durum",
  amount: "Tutar",
  note: "Not",
  surveyAt: "Keşif randevusu",
  position: "Pozisyon",
  salaryBase: "Maaş",
  supervisorId: "Şef",
  vehiclePlate: "Araç plakası",
  dailyJobCapacity: "Günlük iş kapasitesi",
  annualLeaveQuotaDays: "Yıllık izin hakkı (gün)",
  customerId: "Müşteri",
  startDate: "Başlangıç",
  endDate: "Bitiş",
  durationMonths: "Süre (ay)",
  serviceType: "Hizmet",
  pdfUrl: "PDF",
  recurrenceType: "Tekrar",
  statusUntil: "Bitiş zamanı",
  job: "İş",
  isActive: "Aktif",
  price: "Fiyat",
  role: "Rol",
  // admin.clear_demo_data sayaçları
  stockMovements: "Stok hareketi",
  jobReports: "Saha raporu",
  jobs: "İş",
  messages: "Mesaj",
  conversations: "Sohbet",
  advanceRequests: "Avans talebi",
  payments: "Tahsilat",
  contracts: "Sözleşme",
  quoteRequests: "Teklif",
  customers: "Müşteri",
};

const VALUE_LABELS: Record<string, string> = {
  // Teklif
  NEW: "Yeni",
  CONTACTED: "İletişime Geçildi",
  REVISION: "Revize Edilecek",
  CONVERTED: "Dönüştürüldü",
  // Sözleşme
  ACTIVE: "Aktif",
  RENEWED: "Yenilendi",
  EXPIRED: "Süresi Doldu",
  // İş
  PENDING: "Bekliyor",
  SCHEDULED: "Planlandı",
  IN_PROGRESS: "Devam Ediyor",
  COMPLETED: "Tamamlandı",
  CANCELLED: "İptal Edildi",
  // Onay durumları
  APPROVED: "Onaylandı",
  REJECTED: "Reddedildi",
  // Personel durumu
  AVAILABLE: "Müsait",
  ON_JOB: "Görevde",
  ON_BREAK: "Molada",
  ON_LEAVE: "İzinli",
  OFFLINE: "Çevrimdışı",
  // Tekrar
  MONTHLY: "Aylık",
  QUARTERLY: "3 Aylık",
  SEMIANNUAL: "6 Aylık",
  ANNUAL: "Yıllık",
  // Gider kategorisi
  FUEL: "Yakıt",
  CHEMICALS: "Kimyasal/İlaç",
  EQUIPMENT: "Ekipman",
  RENT: "Kira",
  UTILITIES: "Faturalar",
  BONUS: "Prim",
  OTHER: "Diğer",
  // Ödeme türü
  CASH: "Nakit",
  CREDIT_CARD: "Kredi Kartı",
  TRANSFER: "Havale/EFT",
  // Satın alma talebi
  RECEIVED: "Teslim Alındı",
  // Rol
  OWNER: "Patron",
  MANAGER: "Müdür",
  TEAM_LEAD: "Şef",
  STAFF: "Personel",
  CUSTOMER: "Müşteri",
};

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

const dateFmt = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Istanbul",
});
const money = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });

function formatValue(key: string, value: unknown, names: Map<string, string>): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Evet" : "Hayır";
  if (typeof value === "number") return key === "amount" || key === "salaryBase" || key === "price" ? money.format(value) : String(value);
  const s = String(value);
  if (s === "null") return "Atanmamış";
  if (ISO_DATE_RE.test(s)) {
    const d = new Date(s);
    return s.endsWith("T00:00:00.000Z") ? dateFmt.format(d) : dateTimeFmt.format(d);
  }
  if (VALUE_LABELS[s]) return VALUE_LABELS[s];
  return s.replace(UUID_RE, (id) => names.get(id.toLowerCase()) ?? "(silinmiş kayıt)");
}

/**
 * Ham detail → Türkçe cümle. JSON ise "Alan: değer" listesi; "A -> B" geçişleri
 * etiketlenir; metin içindeki UUID'ler çözülen adlarla değiştirilir.
 */
export function humanizeAuditDetail(detail: string | null, names: Map<string, string>): string | null {
  if (!detail) return null;
  const trimmed = detail.trim();

  if (trimmed.startsWith("{")) {
    try {
      const obj = JSON.parse(trimmed) as Record<string, unknown>;
      const parts = Object.entries(obj).map(([k, v]) => {
        if (isPermissionKey(k)) return `${PERMISSION_LABELS[k]}: ${v ? "Evet" : "Hayır"}`;
        return `${FIELD_LABELS[k] ?? k}: ${formatValue(k, v, names)}`;
      });
      return parts.length > 0 ? parts.join(" · ") : null;
    } catch {
      // JSON değilse düz metin olarak devam.
    }
  }

  // "customerId=<uuid>, amount=1200" gibi anahtar=değer dizileri.
  if (/^\w+=/.test(trimmed)) {
    return trimmed
      .split(/,\s*/)
      .map((pair) => {
        const [k, ...rest] = pair.split("=");
        const v = rest.join("=");
        const num = Number(v);
        return `${FIELD_LABELS[k] ?? k}: ${formatValue(k, v !== "" && !Number.isNaN(num) && k === "amount" ? num : v, names)}`;
      })
      .join(" · ");
  }

  // "-> Customer <uuid> (Ad)" (teklif dönüştürme)
  const convert = trimmed.match(/^->\s*Customer\s+\S+\s+\((.+)\)$/);
  if (convert) return `Oluşan müşteri kaydı: ${convert[1]}`;

  // "<eskiId> -> <yeniId> (12 ay)" (sözleşme yenileme): iki uç aynı müşteriye
  // çözüldüğü için yalnızca yeni dönem gösterilir.
  const renew = trimmed.match(/^\S+\s*->\s*\S+\s*\((.+)\)$/);
  if (renew && (trimmed.match(UUID_RE) ?? []).length === 2) return `Yeni dönem: ${renew[1]}`;

  // "ESKİ -> YENİ" geçişleri (iş durumu, yeniden atama)
  const arrow = trimmed.match(/^(\S+)\s*->\s*(\S+)$/);
  if (arrow) return `${formatValue("", arrow[1], names)} → ${formatValue("", arrow[2], names)}`;

  // Serbest metin: UUID'ler adlara, bilinen enum kodları (FUEL, CASH…) Türkçeye.
  return trimmed
    .replace(UUID_RE, (id) => names.get(id.toLowerCase()) ?? "(silinmiş kayıt)")
    .replace(/\b[A-Z][A-Z_]{2,}\b/g, (code) => VALUE_LABELS[code] ?? code);
}

type Resolver = (ids: string[]) => Promise<[string, string][]>;

/** targetType → (id → okunur ad). Yalnızca ekranda anlamlı olan türler. */
const RESOLVERS: Record<string, Resolver> = {
  Customer: async (ids) =>
    (await prisma.customer.findMany({ where: { id: { in: ids } }, select: { id: true, fullName: true } })).map((c) => [c.id, c.fullName]),
  User: async (ids) =>
    (await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, fullName: true } })).map((u) => [u.id, u.fullName]),
  Staff: async (ids) =>
    (await prisma.staff.findMany({ where: { id: { in: ids } }, select: { id: true, user: { select: { fullName: true } } } })).map((s) => [
      s.id,
      s.user.fullName,
    ]),
  Job: async (ids) =>
    (
      await prisma.job.findMany({
        where: { id: { in: ids } },
        select: { id: true, sequenceNo: true, serviceType: true, customer: { select: { fullName: true } } },
      })
    ).map((j) => [j.id, `#${j.sequenceNo} ${j.customer.fullName} · ${j.serviceType}`]),
  Contract: async (ids) =>
    (
      await prisma.contract.findMany({
        where: { id: { in: ids } },
        select: { id: true, serviceType: true, customer: { select: { fullName: true } } },
      })
    ).map((c) => [c.id, `${c.customer.fullName}${c.serviceType ? ` · ${c.serviceType}` : ""}`]),
  QuoteRequest: async (ids) =>
    (await prisma.quoteRequest.findMany({ where: { id: { in: ids } }, select: { id: true, fullName: true } })).map((q) => [q.id, q.fullName]),
  Product: async (ids) =>
    (await prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })).map((p) => [p.id, p.name]),
  CustomerDocument: async (ids) =>
    (await prisma.customerDocument.findMany({ where: { id: { in: ids } }, select: { id: true, fileName: true } })).map((d) => [d.id, d.fileName]),
  CustomerComplaint: async (ids) =>
    (await prisma.customerComplaint.findMany({ where: { id: { in: ids } }, select: { id: true, subject: true } })).map((c) => [c.id, c.subject]),
  StaffRequest: async (ids) =>
    (await prisma.staffRequest.findMany({ where: { id: { in: ids } }, select: { id: true, subject: true } })).map((r) => [r.id, r.subject]),
  Evaluation: async (ids) =>
    (
      await prisma.evaluation.findMany({
        where: { id: { in: ids } },
        select: { id: true, target: { select: { user: { select: { fullName: true } } } }, period: { select: { label: true } } },
      })
    ).map((e) => [e.id, `${e.target.user.fullName} · ${e.period.label}`]),
  EvaluationPeriod: async (ids) =>
    (await prisma.evaluationPeriod.findMany({ where: { id: { in: ids } }, select: { id: true, label: true } })).map((p) => [p.id, p.label]),
  AdvanceRequest: async (ids) =>
    (
      await prisma.advanceRequest.findMany({
        where: { id: { in: ids } },
        select: { id: true, amount: true, staff: { select: { user: { select: { fullName: true } } } } },
      })
    ).map((a) => [a.id, `${a.staff.user.fullName} · ${money.format(Number(a.amount))}`]),
  LeaveRequest: async (ids) =>
    (
      await prisma.leaveRequest.findMany({
        where: { id: { in: ids } },
        select: { id: true, staff: { select: { user: { select: { fullName: true } } } } },
      })
    ).map((l) => [l.id, l.staff.user.fullName]),
  CustomerTag: async (ids) =>
    (await prisma.customerTag.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })).map((t) => [t.id, t.name]),
  Payment: async (ids) =>
    (
      await prisma.payment.findMany({
        where: { id: { in: ids } },
        select: { id: true, amount: true, customer: { select: { fullName: true } } },
      })
    ).map((p) => [p.id, `${p.customer.fullName} · ${money.format(Number(p.amount))}`]),
  DataDeletionRequest: async (ids) =>
    (
      await prisma.dataDeletionRequest.findMany({
        where: { id: { in: ids } },
        select: { id: true, customer: { select: { fullName: true } } },
      })
    ).map((d) => [d.id, d.customer.fullName]),
  AppointmentRequest: async (ids) =>
    (
      await prisma.appointmentRequest.findMany({
        where: { id: { in: ids } },
        select: { id: true, customer: { select: { fullName: true } } },
      })
    ).map((a) => [a.id, a.customer.fullName]),
};

/** Detail içindeki UUID'ler hangi türde olabilir — sırayla denenir. */
const DETAIL_ID_TYPES = ["Customer", "Staff", "User", "Job", "Contract", "EvaluationPeriod", "Product"];

export interface DescribedAuditLog {
  actionLabel: string;
  targetLabel: string | null;
  detailText: string | null;
}

/**
 * Bir log kümesini toplu (tür başına tek sorgu) zenginleştirir.
 */
export async function describeAuditLogs(
  logs: Pick<AuditLog, "action" | "targetType" | "targetId" | "detail">[]
): Promise<DescribedAuditLog[]> {
  const idsByType = new Map<string, Set<string>>();
  const add = (type: string, id: string) => {
    if (!RESOLVERS[type]) return;
    if (!idsByType.has(type)) idsByType.set(type, new Set());
    idsByType.get(type)!.add(id.toLowerCase());
  };
  const detailIds = new Set<string>();
  for (const log of logs) {
    if (log.targetType && log.targetId) add(log.targetType, log.targetId);
    for (const m of log.detail?.match(UUID_RE) ?? []) detailIds.add(m.toLowerCase());
  }
  for (const id of detailIds) for (const t of DETAIL_ID_TYPES) add(t, id);

  // targetType+id → ad; detail UUID'leri için tür bağımsız id → ad.
  const byTypeAndId = new Map<string, string>();
  const byId = new Map<string, string>();
  await Promise.all(
    [...idsByType.entries()].map(async ([type, ids]) => {
      for (const [id, name] of await RESOLVERS[type]([...ids])) {
        byTypeAndId.set(`${type}:${id.toLowerCase()}`, name);
        if (!byId.has(id.toLowerCase())) byId.set(id.toLowerCase(), name);
      }
    })
  );

  return logs.map((log) => ({
    actionLabel: auditActionLabel(log.action),
    targetLabel: log.targetType && log.targetId ? byTypeAndId.get(`${log.targetType}:${log.targetId.toLowerCase()}`) ?? null : null,
    detailText: humanizeAuditDetail(log.detail, byId),
  }));
}

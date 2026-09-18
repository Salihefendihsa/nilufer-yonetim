import type { Request, Response } from "express";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getCustomerIdForUser, getStaffIdForUser, getTeamStaffIds } from "../lib/access";

/**
 * Bölüm I (3. tur): Global arama — tek sorguyla beş varlık türü (müşteri,
 * iş, personel, sözleşme, teklif) paralel aranır, sonuçlar normalize edilmiş
 * `{ type, id, title, subtitle, route }` biçiminde döner. Her türün rol
 * kapsamı ilgili liste ucuyla AYNI kuralı uygular (kopya değil, aynı
 * yardımcılar — getTeamStaffIds/getStaffIdForUser/getCustomerIdForUser):
 *   - Müşteri : OWNER/MANAGER tümü; STAFF yalnızca kendisine atanmış işi olan
 *               müşteriler (bkz. customersController.listCustomers); CUSTOMER
 *               yalnızca kendi kaydı.
 *   - İş      : jobsController.listJobs kapsamı (TEAM_LEAD ekip, STAFF kendi,
 *               CUSTOMER kendi).
 *   - Personel: OWNER/MANAGER tümü (arşivsiz); TEAM_LEAD kendi ekibi; STAFF ve
 *               CUSTOMER göremez (bkz. staffController.listStaff).
 *   - Sözleşme: OWNER/MANAGER; CUSTOMER kendi sözleşmeleri.
 *   - Teklif  : OWNER/MANAGER (QuoteRequest'te müşteri FK'sı yok — ad/telefon
 *               formda yazılan değerlerdir).
 *
 * Performans: en az 2 karakter, tür başına LIMIT 5, Promise.all.
 * Türkçe: PostgreSQL `ILIKE` (Prisma mode: "insensitive") `lower()` üzerinden
 * çalışır; veritabanı collation'ı (en_US.utf8 / C.UTF-8) "İ"→"i̇"
 * dönüşümünü Türkçe kuralına göre yapmaz. Bu yüzden sorgu terimi için hem
 * girildiği hali hem de Türkçe karşılığı (İ↔i, I↔ı) denenir — "İSMAİL"
 * yazan da "ismail" yazan da aynı kaydı bulur.
 */

const MAX_RESULTS = 5;
const MIN_QUERY_LENGTH = 2;

export type SearchResultType = "customer" | "job" | "staff" | "contract" | "quote";

export interface SearchResult {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle: string;
  /** Web panelinde tıklanınca gidilecek yol (mobil kendi rotasını type+id'den türetir). */
  route: string;
}

type AuthUser = { role: Role; sub: string };

/**
 * Türkçe büyük/küçük harf eşleşmesi için terimin varyantları. ILIKE zaten
 * ASCII harfleri duyarsız yapar; yalnızca noktalı/noktasız i ailesi sorun
 * çıkarır (Ş/ş, Ğ/ğ, Ü/ü, Ö/ö, Ç/ç lower() ile doğru eşleşir).
 */
export function turkishVariants(q: string): string[] {
  const variants = new Set<string>([q]);
  variants.add(q.replace(/İ/g, "i").replace(/I/g, "ı"));
  variants.add(q.replace(/i/g, "İ").replace(/ı/g, "I"));
  variants.add(q.toLocaleLowerCase("tr-TR"));
  variants.add(q.toLocaleUpperCase("tr-TR"));
  return [...variants];
}

/** Tek bir metin alanı için tüm Türkçe varyantların `contains` filtreleri (OR içinde kullanılır). */
function containsAny<T>(field: string, q: string): T[] {
  return turkishVariants(q).map((v) => ({ [field]: { contains: v, mode: "insensitive" as const } }) as T);
}

export async function search(req: Request, res: Response) {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const user = req.user!;

  if (q.length < MIN_QUERY_LENGTH) {
    return res.json({ query: q, results: [] });
  }

  const groups = await Promise.all([
    searchCustomers(q, user),
    searchJobs(q, user),
    searchStaff(q, user),
    searchContracts(q, user),
    searchQuotes(q, user),
  ]);

  return res.json({ query: q, results: groups.flat() });
}

async function searchCustomers(q: string, user: AuthUser): Promise<SearchResult[]> {
  const textFilter: Prisma.CustomerWhereInput = {
    OR: [...containsAny<Prisma.CustomerWhereInput>("fullName", q), ...containsAny<Prisma.CustomerWhereInput>("email", q), { phone: { contains: q } }],
  };

  let where: Prisma.CustomerWhereInput = textFilter;
  if (user.role === Role.CUSTOMER) {
    const customerId = await getCustomerIdForUser(user.sub);
    if (!customerId) return [];
    where = { AND: [{ id: customerId }, textFilter] };
  } else if (user.role === Role.STAFF) {
    // listCustomers ile aynı kapsam: yalnızca kendisine atanmış işi olan müşteriler.
    const staffId = await getStaffIdForUser(user.sub);
    if (!staffId) return [];
    where = { AND: [{ jobs: { some: { assignedStaffId: staffId } } }, textFilter] };
  } else if (user.role === Role.TEAM_LEAD) {
    // TEAM_LEAD'in /customers listesine erişimi yok (route yalnızca OWNER/MANAGER/STAFF);
    // ekibinin işlerindeki müşteriler iş sonuçlarında zaten görünür.
    return [];
  }

  const customers = await prisma.customer.findMany({
    where,
    select: { id: true, fullName: true, phone: true, district: true },
    take: MAX_RESULTS,
    orderBy: { createdAt: "desc" },
  });

  return customers.map((c) => ({
    type: "customer",
    id: c.id,
    title: c.fullName,
    subtitle: [c.phone, c.district].filter(Boolean).join(" · "),
    route: `/musteriler?detailId=${c.id}`,
  }));
}

async function searchJobs(q: string, user: AuthUser): Promise<SearchResult[]> {
  const textFilter: Prisma.JobWhereInput = {
    OR: [
      ...containsAny<Prisma.JobWhereInput>("serviceType", q),
      ...turkishVariants(q).map((v) => ({ customer: { fullName: { contains: v, mode: "insensitive" as const } } })),
    ],
  };

  const conditions: Prisma.JobWhereInput[] = [textFilter];
  if (user.role === Role.CUSTOMER) {
    const customerId = await getCustomerIdForUser(user.sub);
    if (!customerId) return [];
    conditions.push({ customerId });
  } else if (user.role === Role.STAFF) {
    const staffId = await getStaffIdForUser(user.sub);
    if (!staffId) return [];
    conditions.push({ assignedStaffId: staffId });
  } else if (user.role === Role.TEAM_LEAD) {
    const teamIds = await getTeamStaffIds(user.sub);
    if (teamIds.length === 0) return [];
    conditions.push({ assignedStaffId: { in: teamIds } });
  }

  const jobs = await prisma.job.findMany({
    where: { AND: conditions },
    select: { id: true, serviceType: true, status: true, scheduledAt: true, customer: { select: { fullName: true } } },
    take: MAX_RESULTS,
    orderBy: { createdAt: "desc" },
  });

  return jobs.map((j) => ({
    type: "job",
    id: j.id,
    title: `${j.serviceType} — ${j.customer.fullName}`,
    subtitle: `${JOB_STATUS_LABELS[j.status] ?? j.status}${j.scheduledAt ? ` · ${formatDate(j.scheduledAt)}` : ""}`,
    route: `/isler?search=${encodeURIComponent(j.customer.fullName)}`,
  }));
}

async function searchStaff(q: string, user: AuthUser): Promise<SearchResult[]> {
  if (user.role === Role.CUSTOMER || user.role === Role.STAFF) return [];

  const textFilter: Prisma.StaffWhereInput = {
    OR: [
      ...containsAny<Prisma.StaffWhereInput>("position", q),
      ...turkishVariants(q).map((v) => ({ user: { is: { fullName: { contains: v, mode: "insensitive" as const } } } })),
    ],
  };

  const conditions: Prisma.StaffWhereInput[] = [{ archivedAt: null }, textFilter];
  if (user.role === Role.TEAM_LEAD) {
    const teamIds = await getTeamStaffIds(user.sub);
    if (teamIds.length === 0) return [];
    conditions.push({ id: { in: teamIds } });
  }

  const staff = await prisma.staff.findMany({
    where: { AND: conditions },
    select: { id: true, position: true, user: { select: { fullName: true } } },
    take: MAX_RESULTS,
    orderBy: { createdAt: "desc" },
  });

  return staff.map((s) => ({
    type: "staff",
    id: s.id,
    title: s.user.fullName,
    subtitle: s.position,
    route: `/personel?highlight=${s.id}`,
  }));
}

async function searchContracts(q: string, user: AuthUser): Promise<SearchResult[]> {
  const conditions: Prisma.ContractWhereInput[] = [
    { OR: turkishVariants(q).map((v) => ({ customer: { fullName: { contains: v, mode: "insensitive" as const } } })) },
  ];

  if (user.role === Role.CUSTOMER) {
    const customerId = await getCustomerIdForUser(user.sub);
    if (!customerId) return [];
    conditions.push({ customerId });
  } else if (user.role !== Role.OWNER && user.role !== Role.MANAGER) {
    return [];
  }

  const contracts = await prisma.contract.findMany({
    where: { AND: conditions },
    select: { id: true, status: true, serviceType: true, endDate: true, customer: { select: { fullName: true } } },
    take: MAX_RESULTS,
    orderBy: { createdAt: "desc" },
  });

  return contracts.map((c) => ({
    type: "contract",
    id: c.id,
    title: c.customer.fullName,
    subtitle: `${c.serviceType ?? "Sözleşme"} · ${CONTRACT_STATUS_LABELS[c.status] ?? c.status} · bitiş ${formatDate(c.endDate)}`,
    route: `/sozlesmeler?highlight=${c.id}`,
  }));
}

async function searchQuotes(q: string, user: AuthUser): Promise<SearchResult[]> {
  if (user.role !== Role.OWNER && user.role !== Role.MANAGER) return [];

  const quotes = await prisma.quoteRequest.findMany({
    where: { OR: [...containsAny<Prisma.QuoteRequestWhereInput>("fullName", q), { phone: { contains: q } }] },
    select: { id: true, fullName: true, phone: true, serviceType: true, status: true },
    take: MAX_RESULTS,
    orderBy: { createdAt: "desc" },
  });

  return quotes.map((qr) => ({
    type: "quote",
    id: qr.id,
    title: qr.fullName,
    subtitle: `${qr.serviceType} · ${qr.phone} · ${QUOTE_STATUS_LABELS[qr.status] ?? qr.status}`,
    route: `/teklifler?highlight=${qr.id}`,
  }));
}

const JOB_STATUS_LABELS: Record<string, string> = {
  PENDING: "Bekliyor",
  SCHEDULED: "Planlandı",
  IN_PROGRESS: "Devam Ediyor",
  COMPLETED: "Tamamlandı",
  CANCELLED: "İptal",
};

const CONTRACT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Aktif",
  RENEWED: "Yenilendi",
  EXPIRED: "Süresi Doldu",
  CANCELLED: "İptal",
};

const QUOTE_STATUS_LABELS: Record<string, string> = {
  NEW: "Yeni",
  CONTACTED: "Arandı",
  QUOTED: "Teklif Verildi",
  ACCEPTED: "Kabul",
  REJECTED: "Red",
  CONVERTED: "Müşteriye Dönüştü",
};

function formatDate(d: Date): string {
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

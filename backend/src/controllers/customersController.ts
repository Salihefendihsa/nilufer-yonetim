import type { Request, Response } from "express";
import { z } from "zod";
import { Role, type Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ensureReferralCode, generateReferralCode, referralInviteLink } from "../lib/referral";
import { isLoyalCustomer, LOYAL_CUSTOMER_THRESHOLD } from "../lib/badges";
import { customerTagSelect } from "./customerTagsController";
import { idParam } from "../lib/params";
import { getPagination, paginatedResponse } from "../lib/pagination";
import { recordAuditLog } from "../lib/auditLog";
import { getCustomerIdForUser, getStaffIdForUser } from "../lib/access";

const createSchema = z.object({
  fullName: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().optional(),
  address: z.string().optional(),
  district: z.string().optional(),
  userId: z.string().uuid().optional(),
});

const updateSchema = createSchema.partial();

export async function listCustomers(req: Request, res: Response) {
  const { skip, take, page, limit } = getPagination(req);
  const search = typeof req.query.search === "string" ? req.query.search : undefined;

  const searchFilter: Prisma.CustomerWhereInput | undefined = search
    ? {
        OR: [
          { fullName: { contains: search, mode: "insensitive" as const } },
          { phone: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
          { district: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : undefined;

  let where: Prisma.CustomerWhereInput = searchFilter ?? {};

  // Bölüm X (6. tur): ?tagId= — yalnızca bu etikete sahip müşteriler.
  if (typeof req.query.tagId === "string" && req.query.tagId) {
    const tagFilter: Prisma.CustomerWhereInput = { tagAssignments: { some: { tagId: req.query.tagId } } };
    where = Object.keys(where).length > 0 ? { AND: [where, tagFilter] } : tagFilter;
  }

  // STAFF finansal ve iletişim bilgilerine toplu erişemesin diye yalnızca
  // kendisine atanmış bir işi olan müşterilerle sınırlanır.
  if (req.user!.role === Role.STAFF) {
    const staffId = await getStaffIdForUser(req.user!.sub);
    const scopeFilter: Prisma.CustomerWhereInput = { jobs: { some: { assignedStaffId: staffId ?? "" } } };
    where = searchFilter ? { AND: [scopeFilter, searchFilter] } : scopeFilter;
  }

  // Stitch Müdür → Müşteriler: "En yeni / İsme göre / Bakiyeye göre" sıralama.
  // Bakiye türetilmiş bir değer olduğu için veritabanında sıralanamaz; sayfa
  // içi sıralama zenginleştirmeden sonra uygulanır (aşağıda).
  const sort = typeof req.query.sort === "string" ? req.query.sort : "newest";
  const orderBy: Prisma.CustomerOrderByWithRelationInput =
    sort === "name" ? { fullName: "asc" } : { createdAt: "desc" };

  const [data, total] = await Promise.all([
    prisma.customer.findMany({ where, skip, take, orderBy, include: { tagAssignments: { include: { tag: { select: customerTagSelect } } } } }),
    prisma.customer.count({ where }),
  ]);
  // Bölüm X: etiketler her satırda düz liste olarak (tagAssignments dışa sızmaz).
  const withTags = data.map(({ tagAssignments, ...c }) => ({ ...c, tags: tagAssignments.map((a) => a.tag) }));

  // STAFF finansal veri görmez (bkz. getCustomer) — bakiye eklenmez.
  if (req.user!.role === Role.STAFF) {
    return res.json(paginatedResponse(withTags, total, page, limit));
  }

  const customerIds = withTags.map((c) => c.id);
  const [jobAgg, paymentAgg, activeContracts, completedAgg] = customerIds.length
    ? await Promise.all([
        prisma.job.groupBy({
          by: ["customerId"],
          _sum: { price: true },
          _count: { _all: true },
          _max: { scheduledAt: true, createdAt: true },
          where: { customerId: { in: customerIds } },
        }),
        prisma.payment.groupBy({
          by: ["customerId"],
          _sum: { amount: true },
          where: { customerId: { in: customerIds } },
        }),
        prisma.contract.groupBy({
          by: ["customerId"],
          _count: { _all: true },
          where: { customerId: { in: customerIds }, status: "ACTIVE" },
        }),
        // Bölüm Q: "Sadık Müşteri" rozeti — tamamlanmış iş sayısı.
        prisma.job.groupBy({
          by: ["customerId"],
          _count: { _all: true },
          where: { customerId: { in: customerIds }, status: "COMPLETED" },
        }),
      ])
    : [[], [], [], []];

  const enriched = withTags.map((customer) => {
    const jobs = jobAgg.find((j) => j.customerId === customer.id);
    const priced = Number(jobs?._sum.price ?? 0);
    const paid = Number(paymentAgg.find((p) => p.customerId === customer.id)?._sum.amount ?? 0);
    const completedJobCount = completedAgg.find((c) => c.customerId === customer.id)?._count._all ?? 0;
    return {
      ...customer,
      completedJobCount,
      isLoyal: isLoyalCustomer(completedJobCount),
      jobCount: jobs?._count._all ?? 0,
      lastJobDate: jobs?._max.scheduledAt ?? jobs?._max.createdAt ?? null,
      activeContractCount: activeContracts.find((c) => c.customerId === customer.id)?._count._all ?? 0,
      outstandingBalance: priced - paid,
    };
  });

  if (sort === "balance") {
    enriched.sort((a, b) => b.outstandingBalance - a.outstandingBalance);
  }

  return res.json(paginatedResponse(enriched, total, page, limit));
}

export async function getCustomer(req: Request, res: Response) {
  const customerRow = await prisma.customer.findUnique({
    where: { id: idParam(req) },
    include: {
      jobs: { orderBy: { createdAt: "desc" } },
      payments: { orderBy: { createdAt: "desc" } },
      contracts: { orderBy: { createdAt: "desc" } },
      tagAssignments: { include: { tag: { select: customerTagSelect } } },
    },
  });

  if (!customerRow) {
    return res.status(404).json({ error: "Müşteri bulunamadı" });
  }
  // Bölüm X: etiketler düz liste olarak.
  const { tagAssignments, ...customer } = customerRow;
  const tags = tagAssignments.map((a) => a.tag);

  if (req.user!.role === Role.STAFF) {
    const staffId = await getStaffIdForUser(req.user!.sub);
    const isAssigned = staffId !== null && customer.jobs.some((job) => job.assignedStaffId === staffId);
    if (!isAssigned) {
      return res.status(403).json({ error: "Bu işlem için yetkiniz yok" });
    }

    // Finansal veriler (ödemeler, bakiye) yalnızca OWNER/MANAGER'a görünür.
    const { payments: _payments, ...customerWithoutPayments } = customer;
    return res.json({ ...customerWithoutPayments, tags });
  }

  const completedJobCount = customer.jobs.filter((j) => j.status === "COMPLETED").length;
  const totalPriced = customer.jobs.reduce((sum, job) => sum + Number(job.price ?? 0), 0);
  const totalPaid = customer.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const outstandingBalance = totalPriced - totalPaid;

  return res.json({ ...customer, tags, outstandingBalance, completedJobCount, isLoyal: isLoyalCustomer(completedJobCount) });
}

export async function createCustomer(req: Request, res: Response) {
  const data = createSchema.parse(req.body);
  // Bölüm P: her yeni müşteri doğar doğmaz bir davet kodu alır.
  const customer = await prisma.customer.create({ data: { ...data, referralCode: generateReferralCode() } });
  return res.status(201).json(customer);
}

/**
 * Bölüm Q (4. tur): Müşterinin kendi rozet bilgisi — "Sadık Müşteri"
 * (tamamlanmış iş ≥ LOYAL_CUSTOMER_THRESHOLD). Yalnızca görsel.
 */
export async function getMyBadges(req: Request, res: Response) {
  const customerId = await getCustomerIdForUser(req.user!.sub);
  if (!customerId) {
    return res.status(400).json({ error: "Bu hesaba bağlı bir müşteri kaydı yok" });
  }
  const completedJobCount = await prisma.job.count({ where: { customerId, status: "COMPLETED" } });
  return res.json({ completedJobCount, isLoyal: isLoyalCustomer(completedJobCount), loyalThreshold: LOYAL_CUSTOMER_THRESHOLD });
}

/**
 * Bölüm P (4. tur): Müşterinin "Arkadaşını Davet Et" kartı — kendi davet
 * kodu, paylaşılabilir link ve davet ettiği (referredByCustomerId = kendi
 * id'si) müşteri sayısı. Eski kayıtlarda kod yoksa burada üretilir.
 * İndirim/ödül yok — yalnızca takip.
 */
export async function getMyReferral(req: Request, res: Response) {
  const customerId = await getCustomerIdForUser(req.user!.sub);
  if (!customerId) {
    return res.status(400).json({ error: "Bu hesaba bağlı bir müşteri kaydı yok" });
  }
  const referralCode = await ensureReferralCode(customerId);
  const [referredCount, referred] = await Promise.all([
    prisma.customer.count({ where: { referredByCustomerId: customerId } }),
    prisma.customer.findMany({
      where: { referredByCustomerId: customerId },
      select: { id: true, fullName: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);
  return res.json({ referralCode, inviteLink: referralInviteLink(referralCode), referredCount, referred });
}

export async function updateCustomer(req: Request, res: Response) {
  const data = updateSchema.parse(req.body);

  const existing = await prisma.customer.findUnique({ where: { id: idParam(req) } });
  if (!existing) {
    return res.status(404).json({ error: "Müşteri bulunamadı" });
  }

  const customer = await prisma.customer.update({ where: { id: idParam(req) }, data });
  return res.json(customer);
}

export async function deleteCustomer(req: Request, res: Response) {
  const existing = await prisma.customer.findUnique({ where: { id: idParam(req) } });
  if (!existing) {
    return res.status(404).json({ error: "Müşteri bulunamadı" });
  }

  await prisma.customer.delete({ where: { id: idParam(req) } });

  // Only logged when the customer has a linked account — an audit entry always needs an
  // unambiguous target user, and a walk-in customer without a User record has none.
  await recordAuditLog({
    actorUserId: req.user!.sub,
    action: "customer.delete",
    targetUserId: existing.userId,
    targetType: "Customer",
    targetId: existing.id,
    detail: existing.fullName,
  });

  return res.status(204).send();
}

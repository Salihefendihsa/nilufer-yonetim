import type { Request, Response } from "express";
import { z } from "zod";
import { JobStatus, Role, StockMovementType, type Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getPagination, paginatedResponse } from "../lib/pagination";
import { getCustomerIdForUser, getStaffIdForUser, getTeamStaffIds, canAccessJob, resolveSupervisorInfo } from "../lib/access";
import { idParam } from "../lib/params";
import { notifyUser, notifyManagement } from "../lib/notify";
import { buildGoogleCalendarLink } from "../lib/googleCalendar";
import { checkLowStockAndNotify } from "../lib/reminders";
import { saveBase64Image } from "../lib/upload";
import { recordAuditLog } from "../lib/auditLog";
import { checklistUpdateSchema, mergeChecklist, normalizeChecklist } from "../lib/checklist";

const MANAGEMENT_ROLES: Role[] = [Role.OWNER, Role.MANAGER];

// Liste/detay sorgularına gömülen minimal ilişki verisi — web tarafı bu sayede
// müşteri/personel adını göstermek için ayrıca /customers veya /staff çağırmak
// zorunda kalmıyor (STAFF/CUSTOMER zaten bu uçlara tam erişemiyor).
// customer.phone/address/district: Stitch Personel → Ana Sayfa/İşler'deki
// "Ara" ve "Yol Tarifi" aksiyonları için gerekli — yalnızca işin kendisine
// erişimi olan kullanıcıya (STAFF: kendi işi, CUSTOMER: kendi kaydı,
// TEAM_LEAD: ekibinin işi, yönetim: hepsi) gösterilir, canAccessJob/where
// zaten bu kapsamı daraltıyor.
const JOB_NAME_INCLUDE = {
  customer: { select: { fullName: true, phone: true, address: true, district: true } },
  assignedStaff: { select: { user: { select: { fullName: true } } } },
} satisfies Prisma.JobInclude;

function withCalendarLink<T extends { serviceType: string; scheduledAt: Date | null; notes: string | null }>(
  job: T
): T & { calendarLink: string | null } {
  return { ...job, calendarLink: buildGoogleCalendarLink(job) };
}

/**
 * İş durumu geçiş kuralları — hem backend hem web/Flutter aynı tabloyu esas
 * almalı (bkz. web/src/app/(dashboard)/isler/page.tsx, mobile/lib/models/job.dart).
 * COMPLETED/CANCELLED nihai durumlardır: yalnızca kendine (aynı isteğin
 * tekrarı — idempotent no-op) geçiş kabul edilir, başka bir duruma dönüş
 * ayrı, denetimi olan bir "yeniden aç" akışı gerektirir (bkz. açık sorular).
 */
const VALID_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  [JobStatus.PENDING]: [JobStatus.PENDING, JobStatus.SCHEDULED, JobStatus.IN_PROGRESS, JobStatus.CANCELLED],
  [JobStatus.SCHEDULED]: [JobStatus.SCHEDULED, JobStatus.PENDING, JobStatus.IN_PROGRESS, JobStatus.CANCELLED],
  [JobStatus.IN_PROGRESS]: [JobStatus.IN_PROGRESS, JobStatus.COMPLETED, JobStatus.CANCELLED],
  [JobStatus.COMPLETED]: [JobStatus.COMPLETED],
  [JobStatus.CANCELLED]: [JobStatus.CANCELLED],
};

function isValidStatusTransition(from: JobStatus, to: JobStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

/**
 * Yalnızca GERÇEK bir durum değişikliğinde zaman damgası basar:
 * - ...→IN_PROGRESS: startedAt = şimdi (yalnızca bu geçiş anında, geriye dönük doldurulmaz).
 * - ...→COMPLETED: completedAt = şimdi; startedAt hiç ayarlanmamışsa BOŞ bırakılır
 *   (sıfıra yakın sahte süre üretmemek için — bkz. docs/STITCH_FEATURE_MATRIX.md §3).
 * - Aynı duruma tekrar geçiş (idempotent resubmit) hiçbir zaman damgası
 *   üretmez ve dolayısıyla ikinci bir "iş tamamlandı" bildirimi tetiklemez.
 */
function timestampsForTransition(
  from: JobStatus,
  to: JobStatus | undefined
): { startedAt?: Date; completedAt?: Date; cancelledAt?: Date } {
  if (!to || to === from) return {};
  const result: { startedAt?: Date; completedAt?: Date; cancelledAt?: Date } = {};
  if (to === JobStatus.IN_PROGRESS) {
    result.startedAt = new Date();
  }
  if (to === JobStatus.COMPLETED) {
    result.completedAt = new Date();
  }
  if (to === JobStatus.CANCELLED) {
    result.cancelledAt = new Date();
  }
  return result;
}

const createSchema = z.object({
  customerId: z.string().uuid(),
  assignedStaffId: z.string().uuid().optional(),
  serviceType: z.string().min(1),
  scheduledAt: z.coerce.date().optional(),
  scheduledEndAt: z.coerce.date().optional(),
  notes: z.string().optional(),
  price: z.number().nonnegative().optional(),
});

const managementUpdateSchema = z.object({
  customerId: z.string().uuid().optional(),
  assignedStaffId: z.string().uuid().nullable().optional(),
  serviceType: z.string().min(1).optional(),
  status: z.enum(JobStatus).optional(),
  scheduledAt: z.coerce.date().optional(),
  scheduledEndAt: z.coerce.date().nullable().optional(),
  notes: z.string().optional(),
  price: z.number().nonnegative().optional(),
  /// İptal gerekçesi — yalnızca CANCELLED geçişinde anlamlıdır.
  cancellationReason: z.string().min(1).optional(),
});

const staffUpdateSchema = z.object({
  status: z.enum(JobStatus),
  cancellationReason: z.string().min(1).optional(),
});

const teamLeadUpdateSchema = z.object({
  assignedStaffId: z.string().uuid(),
});

const reportSchema = z.object({
  // Eski tekli-ürün alanları — geriye dönük uyumluluk için (bkz. web
  // JobReportModal öncesi sürümler). Yeni istemciler `products` gönderir.
  productId: z.string().uuid().optional(),
  quantity: z.number().positive().optional(),
  // Stitch Personel → İşler: "Kullanılan Ürünler (Stoktan Düşüm)" — birden
  // fazla ürün, her biri kendi miktarıyla. Aynı ürün iki kez gönderilemez
  // (stepper'lar toplanmaz, tek satır olarak girilmesi beklenir).
  products: z
    .array(z.object({ productId: z.string().uuid(), quantity: z.number().positive() }))
    .optional(),
  productsUsed: z.string().min(1).optional(),
  dosage: z.string().min(1),
  notes: z.string().optional(),
  signatureUrl: z.string().optional(),
  signatureBase64: z.string().optional(),
  pdfUrl: z.string().optional(),
});

const rateSchema = z.object({
  rating: z.number().int().min(1).max(5),
  ratingComment: z.string().optional(),
});

// Bölüm S (5. tur): yapılandırılmış geri bildirim — 3 kriter + öneri + yorum.
const feedbackSchema = z.object({
  serviceQualityScore: z.number().int().min(1).max(5),
  punctualityScore: z.number().int().min(1).max(5),
  staffProfessionalismScore: z.number().int().min(1).max(5),
  wouldRecommend: z.boolean().optional(),
  feedbackComment: z.string().trim().max(2000).optional(),
});

export async function listJobs(req: Request, res: Response) {
  const { skip, take, page, limit } = getPagination(req);
  const user = req.user!;

  const where: Prisma.JobWhereInput = {};

  if (MANAGEMENT_ROLES.includes(user.role)) {
    if (typeof req.query.staffId === "string") where.assignedStaffId = req.query.staffId;
    if (typeof req.query.customerId === "string") where.customerId = req.query.customerId;
  } else if (user.role === Role.TEAM_LEAD) {
    const teamIds = await getTeamStaffIds(user.sub);
    if (teamIds.length === 0) {
      return res.json(paginatedResponse([], 0, page, limit));
    }
    where.assignedStaffId = { in: teamIds };
  } else if (user.role === Role.STAFF) {
    const staffId = await getStaffIdForUser(user.sub);
    if (!staffId) {
      return res.json(paginatedResponse([], 0, page, limit));
    }
    where.assignedStaffId = staffId;
  } else {
    const customerId = await getCustomerIdForUser(user.sub);
    if (!customerId) {
      return res.json(paginatedResponse([], 0, page, limit));
    }
    where.customerId = customerId;
  }

  if (typeof req.query.status === "string") {
    where.status = req.query.status as JobStatus;
  }

  if (typeof req.query.date === "string") {
    const day = new Date(req.query.date);
    if (!Number.isNaN(day.getTime())) {
      const start = new Date(day);
      start.setHours(0, 0, 0, 0);
      const end = new Date(day);
      end.setHours(23, 59, 59, 999);
      where.scheduledAt = { gte: start, lte: end };
    }
  } else if (typeof req.query.from === "string" || typeof req.query.to === "string") {
    const range: { gte?: Date; lte?: Date } = {};
    if (typeof req.query.from === "string") {
      const from = new Date(req.query.from);
      if (!Number.isNaN(from.getTime())) range.gte = from;
    }
    if (typeof req.query.to === "string") {
      const to = new Date(req.query.to);
      if (!Number.isNaN(to.getTime())) range.lte = to;
    }
    if (range.gte || range.lte) where.scheduledAt = range;
  }

  // Stitch "İşler" ekranındaki arama kutusu karşılığı — müşteri adı veya
  // hizmet türünde arar. Diğer alanlarla (assignedStaffId/status/tarih)
  // birlikte AND'lenir; yalnızca bu ikisi arasında OR uygulanır.
  if (typeof req.query.search === "string" && req.query.search.trim()) {
    const search = req.query.search.trim();
    // Stitch Şef → İşler: "İş no, müşteri veya adres ara..." — sayısal bir
    // terim iş numarası (sequenceNo) olarak da denenir.
    const asNumber = Number(search.replace(/^#/, ""));
    where.OR = [
      { serviceType: { contains: search, mode: "insensitive" } },
      { customer: { fullName: { contains: search, mode: "insensitive" } } },
      { customer: { address: { contains: search, mode: "insensitive" } } },
      { customer: { district: { contains: search, mode: "insensitive" } } },
      ...(Number.isInteger(asNumber) && asNumber > 0 ? [{ sequenceNo: asNumber }] : []),
    ];
  }

  // Onay bekleyen saha raporları — Stitch Müdür → "Bekleyen Onaylar" ekranı.
  // Yalnızca yönetim rolleri için anlamlıdır; diğer roller kendi kapsamlarını
  // zaten yukarıdaki filtrelerle sınırlandırdığı için ayrıca engellenmez.
  const pendingReportOnly = req.query.pendingReportApproval === "true";
  if (pendingReportOnly) {
    where.jobReports = { some: { approvedAt: null } };
  }

  const [data, total] = await Promise.all([
    prisma.job.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: pendingReportOnly
        ? {
            ...JOB_NAME_INCLUDE,
            jobReports: {
              where: { approvedAt: null },
              select: { id: true, createdAt: true, dosage: true, notes: true },
            },
          }
        : JOB_NAME_INCLUDE,
    }),
    prisma.job.count({ where }),
  ]);

  return res.json(paginatedResponse(data.map(withCalendarLink), total, page, limit));
}

export async function getJob(req: Request, res: Response) {
  const job = await prisma.job.findUnique({ where: { id: idParam(req) }, include: JOB_NAME_INCLUDE });
  if (!job) {
    return res.status(404).json({ error: "İş bulunamadı" });
  }

  if (!(await canAccessJob(req.user!, job))) {
    return res.status(403).json({ error: "Bu işlem için yetkiniz yok" });
  }

  // Bölüm N: kontrol listesi her zaman tam şablon olarak döner (null → hepsi işaretsiz).
  return res.json({ ...withCalendarLink(job), checklist: normalizeChecklist(job.checklist) });
}

/**
 * Bölüm N (4. tur): Personel, kendi işinin günlük kontrol listesini işaretler.
 * Şablon sabittir (lib/checklist.ts); gelen öğeler şablonla eşleşmeli.
 * Tamamlanmamış liste raporu ENGELLEMEZ — eksikler görünür kalır.
 */
export async function updateJobChecklist(req: Request, res: Response) {
  const job = await prisma.job.findUnique({ where: { id: idParam(req) }, select: { id: true, assignedStaffId: true, checklist: true } });
  if (!job) {
    return res.status(404).json({ error: "İş bulunamadı" });
  }
  const staffId = await getStaffIdForUser(req.user!.sub);
  if (!staffId || staffId !== job.assignedStaffId) {
    return res.status(403).json({ error: "Bu işlem için yetkiniz yok" });
  }

  const { items } = checklistUpdateSchema.parse(req.body);
  const checklist = mergeChecklist(job.checklist, items);
  await prisma.job.update({ where: { id: job.id }, data: { checklist: checklist as unknown as Prisma.InputJsonValue } });
  return res.json({ jobId: job.id, checklist, isComplete: checklist.every((c) => c.isChecked) });
}

/**
 * Bir işe atanan personelin ekip liderini bilgilendirir
 * (Stitch Şef → Bildirimler: "Yeni İş Ekibinize Atandı").
 *
 * Personelin `supervisorId`'si yoksa (doğrudan yönetime bağlıysa) hiçbir
 * bildirim yazılmaz. Bildirim, atamayı YAPAN kişiye gönderilmez — kendi
 * yaptığı atamayı kendine haber vermek gürültüdür.
 */
async function notifySupervisorOfAssignment(
  jobId: string,
  assignedStaffId: string,
  actorUserId: string
): Promise<void> {
  const staff = await prisma.staff.findUnique({
    where: { id: assignedStaffId },
    select: {
      supervisorId: true,
      user: { select: { fullName: true } },
    },
  });

  const supervisor = await resolveSupervisorInfo(staff?.supervisorId);
  const supervisorUserId = supervisor?.userId;
  if (!supervisorUserId || supervisorUserId === actorUserId) return;

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { serviceType: true, customer: { select: { fullName: true } } },
  });

  await notifyUser(
    supervisorUserId,
    "Ekibinize yeni iş atandı",
    `${job?.customer.fullName ?? "Müşteri"} · ${job?.serviceType ?? "İş"} → ${staff?.user.fullName ?? "Personel"}`,
    { type: "job_assigned", relatedType: "Job", relatedId: jobId }
  );
}

export async function createJob(req: Request, res: Response) {
  const data = createSchema.parse(req.body);
  const job = await prisma.job.create({ data });

  if (job.assignedStaffId) {
    await notifySupervisorOfAssignment(job.id, job.assignedStaffId, req.user!.sub);
  }

  return res.status(201).json(withCalendarLink(job));
}

/**
 * Durum alanını WHERE koşuluna da katarak yazan iyimser eşzamanlılık kilidi:
 * iki eşzamanlı "tamamla" isteği aynı anda gelirse yalnızca biri `count > 0`
 * döner (durumu o an gerçekten değiştiren istek); diğeri geç kalır ve
 * zaman damgası/tamamlanma bildirimi yalnızca kazanan istek için üretilir.
 */
async function applyJobUpdate(
  jobId: string,
  fromStatus: JobStatus,
  data: Record<string, unknown>
): Promise<{ applied: boolean; job: Awaited<ReturnType<typeof prisma.job.findUniqueOrThrow>> }> {
  const result = await prisma.job.updateMany({ where: { id: jobId, status: fromStatus }, data });
  const job = await prisma.job.findUniqueOrThrow({ where: { id: jobId } });
  return { applied: result.count > 0, job };
}

/** Sadece assignedStaff'ı olan işler için loglanır — audit log targetUserId zorunlu tutuyor (bkz. lib/auditLog.ts). */
async function recordJobStatusAuditLog(actorUserId: string, jobId: string, assignedStaffId: string | null, action: string, detail: string) {
  if (!assignedStaffId) return;
  const staff = await prisma.staff.findUnique({ where: { id: assignedStaffId }, select: { userId: true } });
  if (!staff) return;
  await recordAuditLog({ actorUserId, action, targetUserId: staff.userId, targetType: "Job", targetId: jobId, detail });
}

async function notifyJobCompleted(jobId: string, customerId: string) {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (customer?.userId) {
    await notifyUser(
      customer.userId,
      "İşiniz tamamlandı",
      "Uygulama tamamlandı, geçmiş işlemler bölümünden değerlendirebilirsiniz.",
      { type: "job_completed", relatedType: "Job", relatedId: jobId }
    );
  }
}

export async function updateJob(req: Request, res: Response) {
  const existing = await prisma.job.findUnique({ where: { id: idParam(req) } });
  if (!existing) {
    return res.status(404).json({ error: "İş bulunamadı" });
  }

  const user = req.user!;

  if (MANAGEMENT_ROLES.includes(user.role)) {
    const data = managementUpdateSchema.parse(req.body);

    // Durum değişikliği istenmiyorsa eşzamanlılık kilidine gerek yok — düz güncelle.
    if (!data.status) {
      const job = await prisma.job.update({ where: { id: existing.id }, data });
      // Atama değiştiyse yeni personelin ekip lideri haberdar edilir.
      if (job.assignedStaffId && job.assignedStaffId !== existing.assignedStaffId) {
        await notifySupervisorOfAssignment(job.id, job.assignedStaffId, user.sub);
      }
      return res.json(withCalendarLink(job));
    }

    if (!isValidStatusTransition(existing.status, data.status)) {
      return res.status(400).json({
        error: `İş durumu "${existing.status}" iken "${data.status}" durumuna geçilemez`,
      });
    }

    const timestamps = timestampsForTransition(existing.status, data.status);
    const { applied, job } = await applyJobUpdate(existing.id, existing.status, { ...data, ...timestamps });

    if (!applied && job.status !== data.status) {
      return res.status(409).json({ error: "İş durumu başka bir istekle değişti, lütfen tekrar deneyin" });
    }

    if (applied && timestamps.completedAt) await notifyJobCompleted(job.id, job.customerId);
    if (applied && (data.status === JobStatus.COMPLETED || data.status === JobStatus.CANCELLED)) {
      await recordJobStatusAuditLog(user.sub, job.id, job.assignedStaffId, `job.${data.status.toLowerCase()}`, `${existing.status} -> ${data.status}`);
    }
    return res.json(withCalendarLink(job));
  }

  if (user.role === Role.TEAM_LEAD) {
    const teamIds = await getTeamStaffIds(user.sub);
    if (!existing.assignedStaffId || !teamIds.includes(existing.assignedStaffId)) {
      return res.status(403).json({ error: "Bu işlem için yetkiniz yok" });
    }
    const data = teamLeadUpdateSchema.parse(req.body);
    if (!teamIds.includes(data.assignedStaffId)) {
      return res.status(400).json({ error: "Sadece kendi ekibinizden birine atama yapabilirsiniz" });
    }

    if (data.assignedStaffId === existing.assignedStaffId) {
      // Aynı kişiye yeniden atama: hiçbir şey değişmez, bildirim/denetim kaydı
      // üretilmez (idempotent no-op).
      return res.json(withCalendarLink(existing));
    }

    // İyimser kilit: iki şef (veya şef + yönetim) aynı anda atama yaparsa
    // yalnızca biri uygulanır; ikincisi 409 alır ve sessizce ezmez
    // (aynı desen: applyJobUpdate, adjustProductCount).
    const guarded = await prisma.job.updateMany({
      where: { id: existing.id, assignedStaffId: existing.assignedStaffId },
      data,
    });
    if (guarded.count === 0) {
      return res.status(409).json({ error: "İşin ataması başka bir istekle değişti, lütfen tekrar deneyin" });
    }

    const job = await prisma.job.findUniqueOrThrow({ where: { id: existing.id } });

    const [newStaff, customer] = await Promise.all([
      prisma.staff.findUnique({
        where: { id: data.assignedStaffId },
        select: { user: { select: { id: true, fullName: true } } },
      }),
      prisma.customer.findUnique({ where: { id: job.customerId }, select: { fullName: true } }),
    ]);

    if (newStaff) {
      await notifyUser(
        newStaff.user.id,
        "Size yeni bir iş atandı",
        `${customer?.fullName ?? "Müşteri"} · ${job.serviceType}`,
        { type: "job_assigned", relatedType: "Job", relatedId: job.id }
      );
    }

    await recordAuditLog({
      actorUserId: user.sub,
      action: "job.reassign",
      targetUserId: newStaff?.user.id ?? user.sub,
      targetType: "Job",
      targetId: job.id,
      detail: `${existing.assignedStaffId} -> ${data.assignedStaffId}`,
    });

    return res.json(withCalendarLink(job));
  }

  if (user.role === Role.STAFF) {
    const staffId = await getStaffIdForUser(user.sub);
    if (!staffId || staffId !== existing.assignedStaffId) {
      return res.status(403).json({ error: "Bu işlem için yetkiniz yok" });
    }
    const data = staffUpdateSchema.parse(req.body);

    if (!isValidStatusTransition(existing.status, data.status)) {
      return res.status(400).json({
        error: `İş durumu "${existing.status}" iken "${data.status}" durumuna geçilemez`,
      });
    }

    const timestamps = timestampsForTransition(existing.status, data.status);
    const { applied, job } = await applyJobUpdate(existing.id, existing.status, { ...data, ...timestamps });

    if (!applied && job.status !== data.status) {
      return res.status(409).json({ error: "İş durumu başka bir istekle değişti, lütfen tekrar deneyin" });
    }

    if (applied && timestamps.completedAt) await notifyJobCompleted(job.id, job.customerId);
    if (applied && (data.status === JobStatus.COMPLETED || data.status === JobStatus.CANCELLED)) {
      await recordJobStatusAuditLog(user.sub, job.id, job.assignedStaffId, `job.${data.status.toLowerCase()}`, `${existing.status} -> ${data.status}`);
    }
    return res.json(withCalendarLink(job));
  }

  return res.status(403).json({ error: "Bu işlem için yetkiniz yok" });
}

export async function deleteJob(req: Request, res: Response) {
  const existing = await prisma.job.findUnique({ where: { id: idParam(req) } });
  if (!existing) {
    return res.status(404).json({ error: "İş bulunamadı" });
  }

  await prisma.job.delete({ where: { id: idParam(req) } });
  return res.status(204).send();
}

export async function createJobReport(req: Request, res: Response) {
  const user = req.user!;
  const job = await prisma.job.findUnique({ where: { id: idParam(req) } });
  if (!job) {
    return res.status(404).json({ error: "İş bulunamadı" });
  }

  const staffId = await getStaffIdForUser(user.sub);
  if (!staffId || staffId !== job.assignedStaffId) {
    return res.status(403).json({ error: "Bu işlem için yetkiniz yok" });
  }

  const { signatureBase64, products, ...data } = reportSchema.parse(req.body);

  if (data.productId && !data.quantity) {
    return res.status(400).json({ error: "Ürün seçildiğinde miktar zorunludur" });
  }

  const productIds = [
    ...(data.productId ? [data.productId] : []),
    ...(products?.map((p) => p.productId) ?? []),
  ];
  if (new Set(productIds).size !== productIds.length) {
    return res.status(400).json({ error: "Aynı ürün raporda birden fazla kez seçilemez" });
  }

  if (productIds.length > 0) {
    const found = await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true } });
    const foundIds = new Set(found.map((p) => p.id));
    const missing = productIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      return res.status(404).json({ error: "Ürün bulunamadı" });
    }
  }

  if (signatureBase64) {
    data.signatureUrl = saveBase64Image(signatureBase64, "imza");
  }

  const report = await prisma.$transaction(async (tx) => {
    const created = await tx.jobReport.create({
      // Bölüm N: rapor anındaki kontrol listesi rapora kopyalanır.
      data: { ...data, jobId: job.id, staffId, checklist: normalizeChecklist(job.checklist) as unknown as Prisma.InputJsonValue },
    });

    if (data.productId && data.quantity) {
      await tx.product.update({
        where: { id: data.productId },
        data: { currentStock: { decrement: data.quantity } },
      });
      await tx.stockMovement.create({
        data: {
          productId: data.productId,
          type: StockMovementType.OUT,
          quantity: data.quantity,
          relatedJobReportId: created.id,
          note: `İş raporu: ${job.serviceType}`,
        },
      });
    }

    for (const p of products ?? []) {
      const line = await tx.jobReportProduct.create({
        data: { jobReportId: created.id, productId: p.productId, quantity: p.quantity },
      });
      await tx.product.update({
        where: { id: p.productId },
        data: { currentStock: { decrement: p.quantity } },
      });
      await tx.stockMovement.create({
        data: {
          productId: p.productId,
          type: StockMovementType.OUT,
          quantity: p.quantity,
          relatedJobReportProductId: line.id,
          note: `İş raporu: ${job.serviceType}`,
        },
      });
    }

    return created;
  });

  for (const productId of productIds) {
    await checkLowStockAndNotify(productId);
  }

  // Müdür/patron panelinde "Saha Raporu Onay Bekliyor" akışını besler.
  const customer = await prisma.customer.findUnique({ where: { id: job.customerId }, select: { fullName: true } });
  await notifyManagement(
    "Saha raporu onay bekliyor",
    `${customer?.fullName ?? "Müşteri"} · ${job.serviceType} işinin raporu tamamlandı.`,
    { type: "job_report_pending", relatedType: "Job", relatedId: job.id }
  );

  return res.status(201).json(report);
}

export async function getJobReport(req: Request, res: Response) {
  const job = await prisma.job.findUnique({ where: { id: idParam(req) } });
  if (!job) {
    return res.status(404).json({ error: "İş bulunamadı" });
  }

  if (!(await canAccessJob(req.user!, job))) {
    return res.status(403).json({ error: "Bu işlem için yetkiniz yok" });
  }

  const report = await prisma.jobReport.findFirst({
    where: { jobId: job.id },
    include: {
      approvedBy: { select: { fullName: true } },
      products: { include: { product: { select: { name: true, unit: true } } } },
    },
  });
  if (!report) {
    return res.status(404).json({ error: "İş raporu bulunamadı" });
  }

  return res.json(report);
}

/**
 * Saha raporunu müdür/patron onaylar (Stitch Müdür → İşler → "Raporu Onayla",
 * Bildirimler → "Raporu İncele & Onayla").
 *
 * Mükerrer onaya karşı iyimser kilit: `approvedAt: null` koşulu WHERE'de
 * olduğu için iki eşzamanlı onaydan yalnızca biri uygulanır; ikincisi 409
 * alır ve ikinci bir bildirim/audit kaydı üretilmez.
 */
export async function approveJobReport(req: Request, res: Response) {
  const user = req.user!;
  const job = await prisma.job.findUnique({ where: { id: idParam(req) } });
  if (!job) {
    return res.status(404).json({ error: "İş bulunamadı" });
  }

  const report = await prisma.jobReport.findFirst({ where: { jobId: job.id } });
  if (!report) {
    return res.status(404).json({ error: "İş raporu bulunamadı" });
  }
  if (report.approvedAt) {
    return res.status(409).json({ error: "Bu rapor zaten onaylanmış" });
  }

  const applied = await prisma.jobReport.updateMany({
    where: { id: report.id, approvedAt: null },
    data: { approvedAt: new Date(), approvedByUserId: user.sub },
  });

  if (applied.count === 0) {
    return res.status(409).json({ error: "Bu rapor başka bir istekle onaylandı" });
  }

  const staff = await prisma.staff.findUnique({ where: { id: report.staffId }, select: { userId: true } });
  if (staff) {
    await notifyUser(staff.userId, "Saha raporunuz onaylandı", `${job.serviceType} işinin raporu yönetim tarafından onaylandı.`, {
      type: "job_report_approved",
      relatedType: "Job",
      relatedId: job.id,
    });
    await recordAuditLog({
      actorUserId: user.sub,
      action: "job.report.approve",
      targetUserId: staff.userId,
      targetType: "JobReport",
      targetId: report.id,
      detail: `Job ${job.sequenceNo}`,
    });
  }

  const updated = await prisma.jobReport.findUnique({
    where: { id: report.id },
    include: { approvedBy: { select: { fullName: true } } },
  });
  return res.json(updated);
}

export async function rateJob(req: Request, res: Response) {
  const user = req.user!;
  const job = await prisma.job.findUnique({ where: { id: idParam(req) } });
  if (!job) {
    return res.status(404).json({ error: "İş bulunamadı" });
  }

  const customerId = await getCustomerIdForUser(user.sub);
  if (!customerId || customerId !== job.customerId) {
    return res.status(403).json({ error: "Bu işlem için yetkiniz yok" });
  }

  if (job.status !== JobStatus.COMPLETED) {
    return res.status(400).json({ error: "Sadece tamamlanmış işler değerlendirilebilir" });
  }

  const data = rateSchema.parse(req.body);
  const updated = await prisma.job.update({ where: { id: job.id }, data });
  return res.json(updated);
}

/**
 * Bölüm S (5. tur): Müşterinin tamamlanmış işine yapılandırılmış geri bildirimi
 * (hizmet kalitesi / dakiklik / personel profesyonelliği + öneri + yorum).
 * Genel puan (rating) akışından bağımsızdır; bir kez verilir (409).
 */
export async function submitJobFeedback(req: Request, res: Response) {
  const user = req.user!;
  const job = await prisma.job.findUnique({ where: { id: idParam(req) } });
  if (!job) {
    return res.status(404).json({ error: "İş bulunamadı" });
  }

  const customerId = await getCustomerIdForUser(user.sub);
  if (!customerId || customerId !== job.customerId) {
    return res.status(403).json({ error: "Bu işlem için yetkiniz yok" });
  }

  if (job.status !== JobStatus.COMPLETED) {
    return res.status(400).json({ error: "Sadece tamamlanmış işler için geri bildirim verilebilir" });
  }

  if (job.feedbackSubmittedAt) {
    return res.status(409).json({ error: "Bu iş için geri bildirim zaten gönderilmiş" });
  }

  const data = feedbackSchema.parse(req.body);
  // İyimser kilit: aynı anda iki gönderimden yalnızca biri yazar.
  const result = await prisma.job.updateMany({
    where: { id: job.id, feedbackSubmittedAt: null },
    data: { ...data, feedbackComment: data.feedbackComment || null, feedbackSubmittedAt: new Date() },
  });
  if (result.count === 0) {
    return res.status(409).json({ error: "Bu iş için geri bildirim zaten gönderilmiş" });
  }
  const updated = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });
  return res.json(updated);
}

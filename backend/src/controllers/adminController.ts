import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import { randomInt } from "crypto";
import { z } from "zod";
import { Role, type Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { recordAuditLog } from "../lib/auditLog";
import { signToken } from "../lib/jwt";
import { idParam } from "../lib/params";

const SALT_ROUNDS = 10;
const TEMP_PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";

/** Kriptografik olarak güvenli, insan tarafından okunabilir bir geçici şifre üretir. */
function generateTemporaryPassword(length = 12): string {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += TEMP_PASSWORD_ALPHABET[randomInt(TEMP_PASSWORD_ALPHABET.length)];
  }
  return result;
}

/**
 * OWNER, bir kullanıcının GERÇEK şifresini asla görmez/saklamaz — bunun
 * yerine rastgele bir geçici şifre üretilir, hash'lenip kaydedilir, ve
 * yalnızca bu API yanıtında bir kereliğine (loglanmadan) döner. Kullanıcı
 * bir sonraki girişinde mustChangePassword nedeniyle zorunlu şifre
 * değiştirme ekranına düşer (bkz. middleware/auth.ts).
 */
export async function resetUserPassword(req: Request, res: Response) {
  const target = await prisma.user.findUnique({ where: { id: idParam(req) } });
  if (!target) {
    return res.status(404).json({ error: "Kullanıcı bulunamadı" });
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, SALT_ROUNDS);

  await prisma.user.update({
    where: { id: target.id },
    data: { passwordHash, mustChangePassword: true, tokenVersion: { increment: 1 } },
  });

  await recordAuditLog({
    actorUserId: req.user!.sub,
    action: "auth.password_reset_by_owner",
    targetUserId: target.id,
    targetType: "User",
    targetId: target.id,
    detail: `${target.email} için OWNER tarafından şifre sıfırlandı`,
  });

  return res.json({ temporaryPassword });
}

const impersonateSchema = z.object({
  targetUserId: z.string().uuid(),
  reason: z.string().min(1, "Gerekçe zorunludur"),
});

/**
 * Hedef bir OWNER OLAMAZ — hesap verebilirlik zinciri OWNER'ın OWNER'ı
 * impersonate edip iz bırakmadan işlem yapmasını engellemek için kasıtlı.
 * Token 1 saatte sona erer (bkz. lib/jwt.ts:signToken) ve /admin/impersonate/end
 * ile hemen (süresinden önce) de geçersiz kılınabilir.
 */
export async function startImpersonation(req: Request, res: Response) {
  const { targetUserId, reason } = impersonateSchema.parse(req.body);
  const ownerUserId = req.user!.sub;

  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target) {
    return res.status(404).json({ error: "Kullanıcı bulunamadı" });
  }
  if (target.role === Role.OWNER) {
    return res.status(403).json({ error: "Bir OWNER hesabı impersonate edilemez" });
  }

  const session = await prisma.impersonationSession.create({
    data: { ownerUserId, targetUserId, reason },
  });

  await recordAuditLog({
    actorUserId: ownerUserId,
    action: "admin.impersonation_started",
    targetUserId: target.id,
    targetType: "ImpersonationSession",
    targetId: session.id,
    detail: `Gerekçe: ${reason}`,
  });

  const token = signToken({
    sub: target.id,
    role: target.role,
    email: target.email,
    tokenVersion: target.tokenVersion,
    impersonatedBy: ownerUserId,
    impersonationSessionId: session.id,
  });

  return res.status(201).json({
    token,
    user: { id: target.id, email: target.email, fullName: target.fullName, role: target.role },
    impersonation: { sessionId: session.id, reason, targetFullName: target.fullName },
  });
}

/** Yalnızca requireAuth gerekir — bu istek gelirken req.user zaten hedef kullanıcıdır (OWNER değil). */
export async function endImpersonation(req: Request, res: Response) {
  const sessionId = req.user!.impersonationSessionId;
  const ownerUserId = req.user!.impersonatedBy;
  if (!sessionId || !ownerUserId) {
    return res.status(400).json({ error: "Aktif bir impersonation oturumu yok" });
  }

  const session = await prisma.impersonationSession.update({
    where: { id: sessionId },
    data: { endedAt: new Date() },
  });

  await recordAuditLog({
    actorUserId: ownerUserId,
    action: "admin.impersonation_ended",
    targetUserId: session.targetUserId,
    targetType: "ImpersonationSession",
    targetId: session.id,
  });

  return res.json({ ok: true });
}

const clearDemoDataSchema = z.object({
  confirm: z.literal("TEMIZLE"),
});

export async function clearDemoData(req: Request, res: Response) {
  const parsed = clearDemoDataSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Bu işlemi onaylamak için gövdede confirm: \"TEMIZLE\" göndermelisiniz" });
  }

  const result = await prisma.$transaction(async (tx) => {
    const stockMovements = await tx.stockMovement.deleteMany({});
    const jobReports = await tx.jobReport.deleteMany({});
    const jobs = await tx.job.deleteMany({});
    const messages = await tx.message.deleteMany({});
    const conversations = await tx.conversation.deleteMany({});
    const advanceRequests = await tx.advanceRequest.deleteMany({});
    const payments = await tx.payment.deleteMany({});
    const contracts = await tx.contract.deleteMany({});
    const quoteRequests = await tx.quoteRequest.deleteMany({});
    const customers = await tx.customer.deleteMany({});

    return {
      stockMovements: stockMovements.count,
      jobReports: jobReports.count,
      jobs: jobs.count,
      messages: messages.count,
      conversations: conversations.count,
      advanceRequests: advanceRequests.count,
      payments: payments.count,
      contracts: contracts.count,
      quoteRequests: quoteRequests.count,
      customers: customers.count,
    };
  });

  await recordAuditLog({
    actorUserId: req.user!.sub,
    action: "admin.clear_demo_data",
    targetUserId: req.user!.sub,
    detail: JSON.stringify(result),
  });

  return res.json({ message: "Demo veriler silindi, kullanıcı hesapları korundu", deleted: result });
}

/**
 * Veri dışa aktarımına giren alanlar AÇIK allowlist ile seçilir: şemaya sonradan
 * eklenen bir alan (yeni bir sır dahil) bilinçli olarak eklenmedikçe çıkmaz.
 * Çıkmayanlar — User: passwordHash, tokenVersion, twoFactorSecret/-Enabled,
 * mustChangePassword, fcmTokens; Staff: calendarToken (takvim beslemesinde
 * kimlik doğrulama görevi görür). Oturum (UserSession) tabloları hiç okunmaz.
 */
const USER_EXPORT_SELECT = {
  id: true,
  email: true,
  role: true,
  fullName: true,
  phone: true,
  isActive: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

const STAFF_EXPORT_SELECT = {
  id: true,
  userId: true,
  position: true,
  salaryBase: true,
  supervisorId: true,
  status: true,
  statusUntil: true,
  vehiclePlate: true,
  dailyJobCapacity: true,
  annualLeaveQuotaDays: true,
  createdAt: true,
  archivedAt: true,
} satisfies Prisma.StaffSelect;

/**
 * Setting serbest anahtar/değer deposudur (PATCH /settings herhangi bir anahtarı kabul eder),
 * bu yüzden ad deseniyle sır aramak güvenli değildir. Yalnızca uygulamanın kendisinin
 * tanımladığı, sır olmadığı bilinen iş yapılandırması anahtarları AÇIK allowlist ile
 * dışa aktarılır (kaynak: prisma/seed.ts, web ayarlar sayfası, mobil audit_settings_screen,
 * lib/targets.ts). Listede olmayan hiçbir anahtar — adı zararsız görünse bile — çıkmaz.
 */
const EXPORTABLE_SETTING_KEYS: ReadonlySet<string> = new Set([
  "company_name",
  "company_phone",
  "company_email",
  "company_address",
  "monthly_job_target",
  "monthly_revenue_target",
  "contract_expiry_reminder_days",
]);

/** Dışa aktarıma giren tablolar — "tam yedek" değildir, bkz. `meta` (şemada çok daha fazla model var). */
const EXPORTED_COLLECTIONS = [
  "users",
  "customers",
  "staff",
  "permissions",
  "advanceRequests",
  "jobs",
  "jobReports",
  "products",
  "stockMovements",
  "contracts",
  "payments",
  "conversations",
  "messages",
  "quoteRequests",
  "notifications",
  "auditLogs",
  "settings",
  "serviceTypes",
  "districts",
] as const;

/**
 * GET /admin/backup — yol, mevcut istemciler (web Ayarlar → "Veri Dışa Aktarımı") için
 * korunur; ancak çıktı bir KISMİ veri dökümüdür: geri yükleme (restore) yolu YOKTUR,
 * kimlik doğrulama sırları içermez ve yalnızca `meta.collections` tablolarını kapsar.
 */
export async function getBackup(_req: Request, res: Response) {
  const [
    users,
    customers,
    staff,
    permissions,
    advanceRequests,
    jobs,
    jobReports,
    products,
    stockMovements,
    contracts,
    payments,
    conversations,
    messages,
    quoteRequests,
    notifications,
    auditLogs,
    allSettings,
    serviceTypes,
    districts,
  ] = await Promise.all([
    prisma.user.findMany({ select: USER_EXPORT_SELECT }),
    prisma.customer.findMany(),
    prisma.staff.findMany({ select: STAFF_EXPORT_SELECT }),
    prisma.permission.findMany(),
    prisma.advanceRequest.findMany(),
    prisma.job.findMany(),
    prisma.jobReport.findMany(),
    prisma.product.findMany(),
    prisma.stockMovement.findMany(),
    prisma.contract.findMany(),
    prisma.payment.findMany(),
    prisma.conversation.findMany(),
    prisma.message.findMany(),
    prisma.quoteRequest.findMany(),
    prisma.notification.findMany(),
    prisma.auditLog.findMany(),
    prisma.setting.findMany(),
    prisma.serviceType.findMany(),
    prisma.district.findMany(),
  ]);
  const settings = allSettings.filter((s) => EXPORTABLE_SETTING_KEYS.has(s.key));

  const generatedAt = new Date().toISOString();
  const backup = {
    generatedAt,
    meta: {
      kind: "partial-data-export",
      restorable: false,
      note:
        "Bu dosya kısmi bir veri dışa aktarımıdır: yalnızca listelenen tablolar vardır, kimlik doğrulama bilgileri " +
        "(şifre özeti, 2FA sırrı, token'lar) içermez ve bu dosyadan geri yükleme yapılamaz.",
      collections: EXPORTED_COLLECTIONS,
      // settings yalnızca bilinen iş yapılandırması anahtarlarıyla sınırlıdır; diğer anahtarlar dökümde yoktur.
      settingsKeys: [...EXPORTABLE_SETTING_KEYS],
    },
    users,
    customers,
    staff,
    permissions,
    advanceRequests,
    jobs,
    jobReports,
    products,
    stockMovements,
    contracts,
    payments,
    conversations,
    messages,
    quoteRequests,
    notifications,
    auditLogs,
    settings,
    serviceTypes,
    districts,
  };

  const dateStr = generatedAt.slice(0, 10);
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="nilufer-veri-dokumu-${dateStr}.json"`);
  return res.send(JSON.stringify(backup, null, 2));
}

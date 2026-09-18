import { randomUUID } from "crypto";
import bcrypt from "bcrypt";
import request from "supertest";
import { Role, type Prisma } from "@prisma/client";
import app from "../../src/app";
import { prisma } from "../../src/lib/prisma";
import { signToken } from "../../src/lib/jwt";

/**
 * Bölüm H (2. tur): test fixture'ları ve ID bazlı otomatik temizlik.
 *
 * Strateji (bkz. docs/NEW_FEATURES_TOUR_2.md Bölüm H): Prisma'nın
 * interactive transaction'ı HTTP katmanını (supertest → Express → global
 * prisma client) sarmalayamadığı için "her test bir transaction, sonunda
 * rollback" yaklaşımı uygulanamadı. Bunun yerine bugüne kadar manuel
 * yürütülen disiplin otomatikleştirildi: her test dosyası bir `TestContext`
 * açar, ürettiği HER kaydı benzersiz (uuid önekli) verilerle oluşturur ve
 * `ctx.cleanup()` bunları — yan etkiyle oluşan bildirim/denetim logu/oturum
 * satırları dahil — ID bazlı siler. Gerçek dev veritabanına kalıcı hiçbir
 * şey yazılmaz.
 */

export const TEST_PASSWORD = "TestSifre123!";
/** Test verisini dev verisinden ayırt eden önek — e-posta ve isimlerde geçer. */
export const TEST_PREFIX = "vt_";

export const api = () => request(app);

/** Her test dosyası için benzersiz kısa kimlik — aynı anda iki dosya çakışmasın. */
export function uid(): string {
  return randomUUID().slice(0, 8);
}

export function testEmail(tag: string): string {
  return `${TEST_PREFIX}${tag}_${uid()}@test.local`;
}

let cachedHash: string | null = null;
/** bcrypt(10 tur) pahalı — tüm test kullanıcıları aynı şifreyi paylaşır, hash bir kez üretilir. */
export async function passwordHash(): Promise<string> {
  if (!cachedHash) cachedHash = await bcrypt.hash(TEST_PASSWORD, 10);
  return cachedHash;
}

export interface TestUser {
  id: string;
  email: string;
  role: Role;
  tokenVersion: number;
  staffId?: string;
}

interface Tracked {
  model: string;
  id: string;
}

export class TestContext {
  readonly userIds: string[] = [];
  readonly staffIds: string[] = [];
  readonly customerIds: string[] = [];
  private readonly tracked: Tracked[] = [];

  /** Test içinde doğrudan prisma ile üretilen kaydı temizlik listesine ekler. */
  track(model: keyof typeof prisma & string, id: string): void {
    this.tracked.push({ model, id });
  }

  async createUser(
    role: Role,
    opts: { tag?: string; mustChangePassword?: boolean; isActive?: boolean; fullName?: string } = {}
  ): Promise<TestUser> {
    const email = testEmail(opts.tag ?? role.toLowerCase());
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await passwordHash(),
        fullName: opts.fullName ?? `${TEST_PREFIX}${role} ${uid()}`,
        role,
        mustChangePassword: opts.mustChangePassword ?? false,
        isActive: opts.isActive ?? true,
      },
    });
    this.userIds.push(user.id);
    return { id: user.id, email: user.email, role: user.role, tokenVersion: user.tokenVersion };
  }

  /** User + Staff kaydı birlikte (STAFF/TEAM_LEAD için). */
  async createStaffUser(
    role: typeof Role.STAFF | typeof Role.TEAM_LEAD,
    opts: { salaryBase?: number; supervisorId?: string | null; position?: string; tag?: string } = {}
  ): Promise<TestUser> {
    const user = await this.createUser(role, { tag: opts.tag });
    const staff = await prisma.staff.create({
      data: {
        userId: user.id,
        position: opts.position ?? `${TEST_PREFIX}pozisyon`,
        salaryBase: opts.salaryBase ?? 10000,
        supervisorId: opts.supervisorId ?? null,
      },
    });
    this.staffIds.push(staff.id);
    return { ...user, staffId: staff.id };
  }

  async createCustomer(opts: { userId?: string; fullName?: string } = {}) {
    const customer = await prisma.customer.create({
      data: {
        fullName: opts.fullName ?? `${TEST_PREFIX}Müşteri ${uid()}`,
        phone: `05${Math.floor(Math.random() * 1e9).toString().padStart(9, "0")}`,
        userId: opts.userId,
      },
    });
    this.customerIds.push(customer.id);
    return customer;
  }

  async createJob(data: Partial<Prisma.JobUncheckedCreateInput> & { customerId: string }) {
    const job = await prisma.job.create({
      data: { serviceType: `${TEST_PREFIX}hizmet`, ...data },
    });
    this.track("job", job.id);
    return job;
  }

  /**
   * Gerçek login akışını atlayıp doğrudan JWT üretir — RBAC testlerinde her
   * istek için bcrypt/login turu gereksiz. Login davranışının kendisi
   * auth.test.ts'te ayrıca gerçek uçla test edilir.
   */
  async tokenFor(user: TestUser): Promise<string> {
    const fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { tokenVersion: true, role: true } });
    return signToken({ sub: user.id, role: fresh.role, email: user.email, tokenVersion: fresh.tokenVersion });
  }

  /** Gerçek POST /auth/login (web yolu; setup.ts reCAPTCHA'yı kapattı). */
  async login(email: string, password = TEST_PASSWORD) {
    return api().post("/auth/login").send({ email, password });
  }

  /**
   * ID bazlı temizlik — FK sırasına göre. Test kullanıcılarına/personeline
   * bağlı yan etki satırları (bildirim, denetim logu, oturum, gider, …) da
   * burada süpürülür; açıkça `track` edilenler önce ve ters sırada silinir.
   */
  async cleanup(): Promise<void> {
    await this.sweepByOwners();
    // Açıkça track edilenler (dönem, kriter, gider…) EN SONDA ve ters sırada —
    // onlara bağlı değerlendirme/prim satırları yukarıdaki süpürmede
    // silinmiş olmalı ki FK engeline takılmasınlar.
    for (const { model, id } of [...this.tracked].reverse()) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const delegate = (prisma as any)[model];
      try {
        await delegate.delete({ where: { id } });
      } catch {
        /* zaten silinmiş (cascade/önceki adım) — sorun değil */
      }
    }
    this.tracked.length = 0;
  }

  private async sweepByOwners(): Promise<void> {
    const userIds = this.userIds;
    const staffIds = this.staffIds;
    const customerIds = this.customerIds;
    if (userIds.length === 0 && customerIds.length === 0) return;

    const jobs = await prisma.job.findMany({
      where: { OR: [{ customerId: { in: customerIds } }, { assignedStaffId: { in: staffIds } }] },
      select: { id: true },
    });
    const jobIds = jobs.map((j) => j.id);

    // Evaluation → (cascade) EvaluationScore; StaffBonus → Evaluation'a bağlı.
    await prisma.staffBonus.deleteMany({
      where: { OR: [{ staffId: { in: staffIds } }, { approvedByUserId: { in: userIds } }] },
    });
    await prisma.evaluation.deleteMany({
      where: { OR: [{ evaluatorUserId: { in: userIds } }, { targetStaffId: { in: staffIds } }] },
    });

    const reports = await prisma.jobReport.findMany({
      where: { OR: [{ jobId: { in: jobIds } }, { staffId: { in: staffIds } }] },
      select: { id: true },
    });
    const reportIds = reports.map((r) => r.id);
    await prisma.stockMovement.deleteMany({ where: { relatedJobReportId: { in: reportIds } } });
    await prisma.jobReportProduct.deleteMany({ where: { jobReportId: { in: reportIds } } });
    await prisma.jobReport.deleteMany({ where: { id: { in: reportIds } } });
    await prisma.jobPhoto.deleteMany({ where: { OR: [{ jobId: { in: jobIds } }, { uploadedByUserId: { in: userIds } }] } });
    await prisma.payment.deleteMany({ where: { OR: [{ customerId: { in: customerIds } }, { collectedByStaffId: { in: staffIds } }] } });
    // Bölüm J: randevu talepleri Job'a (resultingJobId) ve Customer'a bağlı — ikisinden önce.
    await prisma.appointmentRequest.deleteMany({
      where: { OR: [{ customerId: { in: customerIds } }, { resultingJobId: { in: jobIds } }, { respondedByUserId: { in: userIds } }] },
    });
    await prisma.job.deleteMany({ where: { id: { in: jobIds } } });
    await prisma.contract.deleteMany({ where: { customerId: { in: customerIds } } });
    await prisma.dataDeletionRequest.deleteMany({ where: { OR: [{ customerId: { in: customerIds } }, { processedByUserId: { in: userIds } }] } });
    // Bölüm AB: belge kaydı (Cascade var ama açıkça; disk dosyasını testler kendisi siler).
    await prisma.customerDocument.deleteMany({ where: { OR: [{ customerId: { in: customerIds } }, { uploadedByUserId: { in: userIds } }] } });

    await prisma.permission.deleteMany({ where: { staffId: { in: staffIds } } });
    await prisma.advanceRequest.deleteMany({ where: { staffId: { in: staffIds } } });
    await prisma.leaveRequest.deleteMany({ where: { OR: [{ staffId: { in: staffIds } }, { decidedByUserId: { in: userIds } }] } });
    await prisma.staffCertification.deleteMany({ where: { staffId: { in: staffIds } } });
    await prisma.staffUnavailability.deleteMany({ where: { staffId: { in: staffIds } } });
    await prisma.onboardingChecklistItem.deleteMany({ where: { OR: [{ staffId: { in: staffIds } }, { completedByUserId: { in: userIds } }] } });
    await prisma.stockPurchaseRequest.deleteMany({
      where: { OR: [{ requestedByUserId: { in: userIds } }, { receivedByUserId: { in: userIds } }] },
    });

    await prisma.message.deleteMany({ where: { senderId: { in: userIds } } });
    await prisma.conversation.deleteMany({
      where: { OR: [{ participantAId: { in: userIds } }, { participantBId: { in: userIds } }] },
    });
    await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.notificationPreference.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.auditLog.deleteMany({ where: { OR: [{ actorUserId: { in: userIds } }, { targetUserId: { in: userIds } }] } });
    await prisma.userSession.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.passwordResetToken.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.twoFactorChallenge.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.twoFactorRecoveryCode.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.impersonationSession.deleteMany({
      where: { OR: [{ ownerUserId: { in: userIds } }, { targetUserId: { in: userIds } }] },
    });
    await prisma.expense.deleteMany({ where: { recordedByUserId: { in: userIds } } });
    await prisma.observerAccessGrant.deleteMany({ where: { requestedByUserId: { in: userIds } } });

    // supervisorId FK değil ama test personeline işaret eden satır kalmasın.
    await prisma.staff.updateMany({ where: { supervisorId: { in: [...staffIds, ...userIds] } }, data: { supervisorId: null } });
    await prisma.staff.deleteMany({ where: { OR: [{ id: { in: staffIds } }, { userId: { in: userIds } }] } });
    await prisma.customer.deleteMany({ where: { OR: [{ id: { in: customerIds } }, { userId: { in: userIds } }] } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });

    this.userIds.length = 0;
    this.staffIds.length = 0;
    this.customerIds.length = 0;
  }
}

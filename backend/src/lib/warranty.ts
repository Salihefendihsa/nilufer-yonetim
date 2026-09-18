import { JobStatus } from "@prisma/client";
import { prisma } from "./prisma";

/**
 * Bölüm Y (6. tur): Hizmet garantisi.
 * - İş COMPLETED olduğunda `warrantyExpiresAt = completedAt + ServiceType.defaultWarrantyDays`
 *   (hizmet türü adıyla eşleşir — Job.serviceType serbest metin; eşleşme yoksa
 *   veya tür için gün tanımlı değilse null → garanti takibi yok).
 * - Yönetim, aynı müşteri için yeni iş/randevu planlarken geçerli garantiyi
 *   BİLGİ olarak görür; otomatik ücretsizlik uygulanmaz.
 */
export async function warrantyFieldsFor(serviceType: string, completedAt: Date): Promise<{ warrantyExpiresAt: Date | null }> {
  const type = await prisma.serviceType.findUnique({ where: { name: serviceType }, select: { defaultWarrantyDays: true } });
  const days = type?.defaultWarrantyDays ?? null;
  if (!days || days <= 0) return { warrantyExpiresAt: null };
  return { warrantyExpiresAt: new Date(completedAt.getTime() + days * 24 * 3600 * 1000) };
}

export interface ActiveWarranty {
  jobId: string;
  serviceType: string;
  completedAt: Date | null;
  warrantyExpiresAt: Date;
  daysLeft: number;
}

/** Müşterinin garantisi hâlâ geçerli tamamlanmış işleri (opsiyonel hizmet türü filtresi). */
export async function findActiveWarranties(customerId: string, serviceType?: string, now = new Date()): Promise<ActiveWarranty[]> {
  const jobs = await prisma.job.findMany({
    where: {
      customerId,
      status: JobStatus.COMPLETED,
      warrantyExpiresAt: { gt: now },
      ...(serviceType ? { serviceType } : {}),
    },
    select: { id: true, serviceType: true, completedAt: true, warrantyExpiresAt: true },
    orderBy: { warrantyExpiresAt: "desc" },
  });
  return jobs.map((j) => ({
    jobId: j.id,
    serviceType: j.serviceType,
    completedAt: j.completedAt,
    warrantyExpiresAt: j.warrantyExpiresAt!,
    daysLeft: Math.max(0, Math.ceil((j.warrantyExpiresAt!.getTime() - now.getTime()) / (24 * 3600 * 1000))),
  }));
}

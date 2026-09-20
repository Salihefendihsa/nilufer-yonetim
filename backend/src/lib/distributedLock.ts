import { prisma } from "./prisma";

/**
 * Postgres advisory lock — backend API tek instance çalışırken hiçbir etkisi
 * yok (kilit hep boş), ama yatay ölçeklendiğinde (2+ instance) aynı cron'un
 * her instance'ta ayrı ayrı tetiklenip işi/e-postayı N kez üretmesini engeller:
 * yalnızca kilidi ALABİLEN instance işi çalıştırır, diğerleri no-op geçer.
 *
 * `pg_try_advisory_lock` oturum (session) kapsamlıdır; Prisma'nın bağlantı
 * havuzundaki farklı bağlantılar arasında paylaşılmaz olma riskine karşı
 * tek bir `$transaction` içinde alınıp bırakılır — aynı DB bağlantısı kilit
 * alımı ile serbest bırakma arasında garanti edilir.
 */
export async function withCronLock(lockName: string, fn: () => Promise<unknown>): Promise<void> {
  const lockKey = hashLockName(lockName);

  await prisma.$transaction(async (tx) => {
    const [{ locked }] = await tx.$queryRaw<[{ locked: boolean }]>`SELECT pg_try_advisory_xact_lock(${lockKey}) AS locked`;
    if (!locked) return;
    await fn();
  });
}

/** node-cron isimlerini (string) bigint'e sığan sabit bir int4'e indirger. */
function hashLockName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return hash;
}

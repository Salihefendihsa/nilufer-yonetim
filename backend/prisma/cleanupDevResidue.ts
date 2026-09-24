/**
 * Geliştirme veritabanındaki test artıklarını temizler (HEALTH_AUDIT V-1/V-2).
 *
 *   npm run db:cleanup-residue            → yalnızca listeler (kuru çalıştırma)
 *   npm run db:cleanup-residue -- --apply → siler
 *
 * Hedefler:
 * 1. Test hesapları: `…_<10 hane>@nilufer.com` (eski elle/E2E denemeleri) ve
 *    `…@test.local` (yarıda kalmış vitest koşuları). Demo hesaplar
 *    (seed.ts/seedDemo.ts) bu kalıplara uymaz ve ayrıca açıkça korunur.
 * 2. Yetim bildirimler: işaret ettiği kayıt artık var olmayanlar.
 *
 * Güvenlik: test hesaplarına bağlı her FK şemadan (Prisma DMMF) bulunur.
 * Yalnızca aşağıdaki "hesaba ait" tablolar silinir; başka bir tabloda
 * (ör. bir işe atanmış test personeli) bağımlılık varsa hiçbir şey silinmez
 * ve script durur — demo veri asla zincirleme silinmez.
 */
import { Prisma, PrismaClient } from "@prisma/client";
import { findOrphanNotificationIds } from "../src/lib/orphanNotifications";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const TEST_EMAIL = [/_\d{10}@nilufer\.com$/i, /@test\.local$/i];
const PROTECTED_EMAIL = /^(owner|manager|ekiplideri\d*|personel\d+|musteri\d+)@nilufer\.com$/i;

/** Bu tablolardaki bağımlı satırlar hesapla birlikte silinebilir. */
const DELETABLE = new Set([
  "Notification",
  "NotificationPreference",
  "UserSession",
  "AuditLog",
  "Permission",
  "PasswordResetToken",
  "TwoFactorRecoveryCode",
  "TwoFactorChallenge",
  "Staff",
]);

type OwnerIds = { User: string[]; Staff: string[]; Customer: string[] };
type Dep = { model: string; column: string; target: keyof OwnerIds; count: number };

function delegate(model: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (prisma as any)[model[0].toLowerCase() + model.slice(1)];
}

async function findDeps(ids: OwnerIds): Promise<Dep[]> {
  const deps: Dep[] = [];
  for (const model of Prisma.dmmf.datamodel.models) {
    for (const f of model.fields) {
      if (f.kind !== "object" || !f.relationFromFields?.length) continue;
      const target = f.type as keyof OwnerIds;
      if (!(target in ids) || ids[target].length === 0) continue;
      const column = f.relationFromFields[0];
      // Staff'ın kendisi (Staff.userId) hedef tablo, bağımlılık değil.
      if (model.name === "Staff" && column === "userId") continue;
      const count = await delegate(model.name).count({ where: { [column]: { in: ids[target] } } });
      if (count > 0) deps.push({ model: model.name, column, target, count });
    }
  }
  return deps;
}

async function main() {
  const users = (await prisma.user.findMany({ select: { id: true, email: true, fullName: true, role: true, createdAt: true } }))
    .filter((u) => TEST_EMAIL.some((re) => re.test(u.email)) && !PROTECTED_EMAIL.test(u.email))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const ids: OwnerIds = {
    User: users.map((u) => u.id),
    Staff: (await prisma.staff.findMany({ where: { userId: { in: users.map((u) => u.id) } }, select: { id: true } })).map((s) => s.id),
    Customer: (await prisma.customer.findMany({ where: { userId: { in: users.map((u) => u.id) } }, select: { id: true } })).map((c) => c.id),
  };

  console.log(`\nTest hesapları (${users.length}):`);
  for (const u of users) console.log(`  ${u.role.padEnd(9)} ${u.email.padEnd(38)} ${u.fullName}`);
  console.log(`  → bağlı Staff: ${ids.Staff.length}, Customer: ${ids.Customer.length}`);

  const deps = await findDeps(ids);
  console.log("\nBağımlı kayıtlar:");
  for (const d of deps) console.log(`  ${d.model}.${d.column} → ${d.target}: ${d.count}${DELETABLE.has(d.model) ? "" : "  ← SİLİNEMEZ"}`);
  const blocking = deps.filter((d) => !DELETABLE.has(d.model));
  if (blocking.length > 0) {
    console.error("\nDURDURULDU: yukarıdaki bağımlılıklar hesaba ait değil (demo veriye dokunabilir). Elle inceleyin.");
    process.exitCode = 1;
    return;
  }

  // Test hesapları silindikten sonra yetim kalacak bildirimler de dahil edilsin diye
  // yetim taraması, kuru çalıştırmada hesap bildirimleri hariç tutularak sayılır.
  const orphanBefore = await findOrphanNotificationIds();
  const accountNotifs = await prisma.notification.count({ where: { userId: { in: ids.User } } });
  console.log(`\nSilinecek bildirim: test hesaplarına ait ${accountNotifs}, yetim (kaydı silinmiş) ${orphanBefore.length}`);

  if (!APPLY) {
    console.log("\nKuru çalıştırma — hiçbir şey silinmedi. Silmek için: npm run db:cleanup-residue -- --apply\n");
    return;
  }

  const counts: Record<string, number> = {};
  await prisma.$transaction(async (tx) => {
    const del = async (label: string, p: Promise<{ count: number }>) => { counts[label] = (await p).count; };
    await del("Notification", tx.notification.deleteMany({ where: { userId: { in: ids.User } } }));
    await del("NotificationPreference", tx.notificationPreference.deleteMany({ where: { userId: { in: ids.User } } }));
    await del("UserSession", tx.userSession.deleteMany({ where: { userId: { in: ids.User } } }));
    await del("AuditLog", tx.auditLog.deleteMany({ where: { OR: [{ actorUserId: { in: ids.User } }, { targetUserId: { in: ids.User } }] } }));
    await del("PasswordResetToken", tx.passwordResetToken.deleteMany({ where: { userId: { in: ids.User } } }));
    await del("TwoFactorRecoveryCode", tx.twoFactorRecoveryCode.deleteMany({ where: { userId: { in: ids.User } } }));
    await del("TwoFactorChallenge", tx.twoFactorChallenge.deleteMany({ where: { userId: { in: ids.User } } }));
    await del("Permission", tx.permission.deleteMany({ where: { staffId: { in: ids.Staff } } }));
    await del("Staff", tx.staff.deleteMany({ where: { id: { in: ids.Staff } } }));
    await del("User", tx.user.deleteMany({ where: { id: { in: ids.User } } }));
  });
  const orphanIds = await findOrphanNotificationIds();
  counts["Notification (yetim)"] = orphanIds.length
    ? (await prisma.notification.deleteMany({ where: { id: { in: orphanIds } } })).count
    : 0;

  console.log("\nSilinen:");
  for (const [k, v] of Object.entries(counts)) if (v) console.log(`  ${k}: ${v}`);
  console.log("");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

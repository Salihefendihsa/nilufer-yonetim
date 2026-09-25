import { Role } from "@prisma/client";
import { prisma } from "./prisma";
import { isPushConfigured, sendPushToTokens } from "./push";

/** Lets the client deep-link a notification to the record it's about (e.g. tap → open Job #id). */
export interface NotificationLink {
  type: string;
  relatedType: string;
  relatedId: string;
}

/**
 * Uygulama içi bildirimin yanında, Firebase yapılandırılmışsa ve
 * kullanıcının kayıtlı cihazı varsa push da gönderir — sendEmail ile aynı
 * "yapılandırılmamışsa sessizce atla" prensibi (bkz. lib/push.ts).
 * Geçersiz token'lar burada DB'den temizlenir.
 */
async function pushToUsers(userIds: string[], title: string, body: string | undefined, link?: NotificationLink) {
  if (!isPushConfigured() || userIds.length === 0) return;

  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, fcmTokens: { isEmpty: false } },
    select: { id: true, fcmTokens: true },
  });
  if (users.length === 0) return;

  const data = link ? { type: link.type, relatedType: link.relatedType, relatedId: link.relatedId } : undefined;

  await Promise.all(
    users.map(async (u) => {
      const { invalidTokens } = await sendPushToTokens(u.fcmTokens, title, body, data);
      if (invalidTokens.length > 0) {
        await prisma.user.update({
          where: { id: u.id },
          data: { fcmTokens: u.fcmTokens.filter((t) => !invalidTokens.includes(t)) },
        });
      }
    })
  );
}

export async function notifyUser(userId: string, title: string, body?: string, link?: NotificationLink): Promise<void> {
  await prisma.notification.create({ data: { userId, title, body, ...link } });
  await pushToUsers([userId], title, body, link);
}

export async function notifyUsers(userIds: string[], title: string, body?: string, link?: NotificationLink): Promise<void> {
  if (userIds.length === 0) return;
  await prisma.notification.createMany({
    data: userIds.map((userId) => ({ userId, title, body, ...link })),
  });
  await pushToUsers(userIds, title, body, link);
}

/** Yalnızca aktif OWNER'lar — işlemi yalnızca Patron'un yapabildiği bildirimler için
 * (KVKK veri silme, personel talepleri); Müdür'e tıklayınca açamayacağı bildirim gitmesin. */
export async function notifyOwners(title: string, body?: string, link?: NotificationLink): Promise<void> {
  const owners = await prisma.user.findMany({ where: { role: Role.OWNER, isActive: true }, select: { id: true } });
  await notifyUsers(owners.map((o) => o.id), title, body, link);
}

/** Notifies everyone who runs the business (OWNER + MANAGER). */
export async function notifyManagement(title: string, body?: string, link?: NotificationLink): Promise<void> {
  const managers = await prisma.user.findMany({
    where: { role: { in: [Role.OWNER, Role.MANAGER] } },
    select: { id: true },
  });
  await notifyUsers(managers.map((m) => m.id), title, body, link);
}

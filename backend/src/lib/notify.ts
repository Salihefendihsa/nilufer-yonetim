import { Role } from "@prisma/client";
import { prisma } from "./prisma";

/** Lets the client deep-link a notification to the record it's about (e.g. tap → open Job #id). */
export interface NotificationLink {
  type: string;
  relatedType: string;
  relatedId: string;
}

export async function notifyUser(userId: string, title: string, body?: string, link?: NotificationLink): Promise<void> {
  await prisma.notification.create({ data: { userId, title, body, ...link } });
}

export async function notifyUsers(userIds: string[], title: string, body?: string, link?: NotificationLink): Promise<void> {
  if (userIds.length === 0) return;
  await prisma.notification.createMany({
    data: userIds.map((userId) => ({ userId, title, body, ...link })),
  });
}

/** Notifies everyone who runs the business (OWNER + MANAGER). */
export async function notifyManagement(title: string, body?: string, link?: NotificationLink): Promise<void> {
  const managers = await prisma.user.findMany({
    where: { role: { in: [Role.OWNER, Role.MANAGER] } },
    select: { id: true },
  });
  await notifyUsers(managers.map((m) => m.id), title, body, link);
}

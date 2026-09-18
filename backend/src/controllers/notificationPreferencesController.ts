import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

const updateSchema = z.object({
  emailEnabled: z.boolean().optional(),
  dailyDigestEnabled: z.boolean().optional(),
  weeklyDigestEnabled: z.boolean().optional(),
});

export async function getMyNotificationPreferences(req: Request, res: Response) {
  const preference = await prisma.notificationPreference.upsert({
    where: { userId: req.user!.sub },
    update: {},
    create: { userId: req.user!.sub },
  });

  return res.json(preference);
}

export async function updateMyNotificationPreferences(req: Request, res: Response) {
  const data = updateSchema.parse(req.body);

  const preference = await prisma.notificationPreference.upsert({
    where: { userId: req.user!.sub },
    update: data,
    create: { userId: req.user!.sub, ...data },
  });

  return res.json(preference);
}

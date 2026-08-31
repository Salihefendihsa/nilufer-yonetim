import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";

export async function getSessionsReport(req: Request, res: Response) {
  const days = req.query.days ? Number(req.query.days) : 30;
  const since = new Date();
  since.setDate(since.getDate() - (Number.isFinite(days) && days > 0 ? days : 30));

  const where: { loginAt: { gte: Date }; userId?: string } = { loginAt: { gte: since } };
  if (typeof req.query.userId === "string") {
    where.userId = req.query.userId;
  }

  const sessions = await prisma.userSession.findMany({
    where,
    include: { user: { select: { id: true, fullName: true, role: true } } },
    orderBy: { loginAt: "desc" },
  });

  const byUser = new Map<string, typeof sessions>();
  for (const session of sessions) {
    const list = byUser.get(session.userId) ?? [];
    list.push(session);
    byUser.set(session.userId, list);
  }

  const data = Array.from(byUser.entries()).map(([userId, userSessions]) => {
    const user = userSessions[0].user;

    let totalMinutes = 0;
    let anyApproximate = false;

    for (const session of userSessions) {
      const end = session.logoutAt ?? session.lastActiveAt;
      if (!session.logoutAt) anyApproximate = true;
      const minutes = Math.max(0, (end.getTime() - session.loginAt.getTime()) / 60000);
      totalMinutes += minutes;
    }

    const averageDurationMinutes = userSessions.length > 0 ? Math.round(totalMinutes / userSessions.length) : 0;
    const lastLoginAt = userSessions[0].loginAt;

    return {
      userId,
      fullName: user.fullName,
      role: user.role,
      totalSessions: userSessions.length,
      averageDurationMinutes,
      lastLoginAt,
      isApproximate: anyApproximate,
    };
  });

  data.sort((a, b) => new Date(b.lastLoginAt).getTime() - new Date(a.lastLoginAt).getTime());

  return res.json({ data });
}

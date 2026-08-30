import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { getPagination, paginatedResponse } from "../lib/pagination";
import { idParam } from "../lib/params";
import { canUsersMessage, orderedPair } from "../lib/messaging";
import { notifyUser } from "../lib/notify";

const participantSelect = { id: true, fullName: true, role: true } as const;

function otherParticipant<
  T extends { participantAId: string; participantA: unknown; participantB: unknown }
>(conversation: T, userId: string) {
  return conversation.participantAId === userId ? conversation.participantB : conversation.participantA;
}

export async function listConversations(req: Request, res: Response) {
  const userId = req.user!.sub;

  const conversations = await prisma.conversation.findMany({
    where: { OR: [{ participantAId: userId }, { participantBId: userId }] },
    include: {
      participantA: { select: participantSelect },
      participantB: { select: participantSelect },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  const result = await Promise.all(
    conversations.map(async (c) => {
      const lastMessage = c.messages[0] ?? null;
      const unreadCount = await prisma.message.count({
        where: { conversationId: c.id, senderId: { not: userId }, readAt: null },
      });

      return {
        id: c.id,
        participant: otherParticipant(c, userId),
        lastMessage,
        unreadCount,
        updatedAt: lastMessage?.createdAt ?? c.createdAt,
      };
    })
  );

  result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return res.json({ data: result });
}

export async function getMessages(req: Request, res: Response) {
  const userId = req.user!.sub;
  const conversation = await prisma.conversation.findUnique({ where: { id: idParam(req) } });
  if (!conversation) {
    return res.status(404).json({ error: "Conversation not found" });
  }
  if (conversation.participantAId !== userId && conversation.participantBId !== userId) {
    return res.status(403).json({ error: "Insufficient permissions" });
  }

  const { skip, take, page, limit } = getPagination(req);
  const [data, total] = await Promise.all([
    prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "asc" },
      skip,
      take,
    }),
    prisma.message.count({ where: { conversationId: conversation.id } }),
  ]);

  return res.json(paginatedResponse(data, total, page, limit));
}

const createConversationSchema = z.object({ participantId: z.string().uuid() });

export async function createConversation(req: Request, res: Response) {
  const me = req.user!;
  const { participantId } = createConversationSchema.parse(req.body);

  if (participantId === me.sub) {
    return res.status(400).json({ error: "Cannot start a conversation with yourself" });
  }

  const targetUser = await prisma.user.findUnique({ where: { id: participantId } });
  if (!targetUser) {
    return res.status(404).json({ error: "User not found" });
  }

  const allowed = await canUsersMessage({ id: me.sub, role: me.role }, { id: targetUser.id, role: targetUser.role });
  if (!allowed) {
    return res.status(403).json({ error: "You are not allowed to message this user" });
  }

  const [participantAId, participantBId] = orderedPair(me.sub, participantId);

  const conversation = await prisma.conversation.upsert({
    where: { participantAId_participantBId: { participantAId, participantBId } },
    create: { participantAId, participantBId },
    update: {},
    include: {
      participantA: { select: participantSelect },
      participantB: { select: participantSelect },
    },
  });

  return res.status(201).json({
    id: conversation.id,
    participant: otherParticipant(conversation, me.sub),
  });
}

const sendMessageSchema = z.object({ content: z.string().min(1) });

export async function sendMessage(req: Request, res: Response) {
  const userId = req.user!.sub;
  const conversation = await prisma.conversation.findUnique({ where: { id: idParam(req) } });
  if (!conversation) {
    return res.status(404).json({ error: "Conversation not found" });
  }
  if (conversation.participantAId !== userId && conversation.participantBId !== userId) {
    return res.status(403).json({ error: "Insufficient permissions" });
  }

  const { content } = sendMessageSchema.parse(req.body);
  const message = await prisma.message.create({
    data: { conversationId: conversation.id, senderId: userId, content },
  });

  const recipientId = conversation.participantAId === userId ? conversation.participantBId : conversation.participantAId;
  const sender = await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true } });
  await notifyUser(recipientId, `Yeni mesaj: ${sender?.fullName ?? "Kullanıcı"}`, content);

  return res.status(201).json(message);
}

export async function markConversationRead(req: Request, res: Response) {
  const userId = req.user!.sub;
  const conversation = await prisma.conversation.findUnique({ where: { id: idParam(req) } });
  if (!conversation) {
    return res.status(404).json({ error: "Conversation not found" });
  }
  if (conversation.participantAId !== userId && conversation.participantBId !== userId) {
    return res.status(403).json({ error: "Insufficient permissions" });
  }

  await prisma.message.updateMany({
    where: { conversationId: conversation.id, senderId: { not: userId }, readAt: null },
    data: { readAt: new Date() },
  });

  return res.json({ ok: true });
}

export async function listAvailableContacts(req: Request, res: Response) {
  const me = req.user!;

  const candidates = await prisma.user.findMany({
    where: { id: { not: me.sub } },
    select: { id: true, fullName: true, email: true, role: true },
  });

  const checked = await Promise.all(
    candidates.map(async (candidate) => {
      const allowed = await canUsersMessage({ id: me.sub, role: me.role }, { id: candidate.id, role: candidate.role });
      return allowed ? candidate : null;
    })
  );

  return res.json({ data: checked.filter((c): c is (typeof candidates)[number] => c !== null) });
}

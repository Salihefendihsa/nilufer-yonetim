import type { Request, Response } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getPagination, paginatedResponse } from "../lib/pagination";
import { idParam } from "../lib/params";
import { canUsersMessage, orderedPair } from "../lib/messaging";
import { notifyUser } from "../lib/notify";
import { saveBase64Image } from "../lib/upload";
import { getTeamStaffIds } from "../lib/access";
import { recordAuditLog } from "../lib/auditLog";
import { findActiveGrant } from "./observerAccessController";

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

  const unreadCounts = await prisma.message.groupBy({
    by: ["conversationId"],
    where: {
      conversationId: { in: conversations.map((c) => c.id) },
      senderId: { not: userId },
      readAt: null,
    },
    _count: { _all: true },
  });
  const unreadByConversationId = new Map(
    unreadCounts.map((u) => [u.conversationId, u._count._all])
  );

  const result = conversations.map((c) => {
    const lastMessage = c.messages[0] ?? null;
    return {
      id: c.id,
      participant: otherParticipant(c, userId),
      lastMessage,
      unreadCount: unreadByConversationId.get(c.id) ?? 0,
      updatedAt: lastMessage?.createdAt ?? c.createdAt,
    };
  });

  result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return res.json({ data: result });
}

/**
 * OWNER-only: every conversation in the system, regardless of whether OWNER is a
 * participant. Erişim, önceden alınmış aktif bir ObserverAccessGrant'a bağlıdır
 * (bkz. controllers/observerAccessController.ts) — yoksa 403 döner ve web/mobile
 * gerekçe+süre formunu açar. Her başarılı çağrı ayrıca kendi "kullanım" audit log
 * kaydını düşer (grant'ın verilişinden bağımsız, kullanımının izlenmesi için).
 */
export async function listAllConversations(req: Request, res: Response) {
  const userId = req.user!.sub;
  const grant = await findActiveGrant(userId);
  if (!grant) {
    return res.status(403).json({ error: "Önce gözlemci erişimi talep edin", requiresGrant: true });
  }

  const conversations = await prisma.conversation.findMany({
    include: {
      participantA: { select: participantSelect },
      participantB: { select: participantSelect },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { messages: true } },
    },
  });

  const result = conversations
    .map((c) => {
      const lastMessage = c.messages[0] ?? null;
      return {
        id: c.id,
        participantA: c.participantA,
        participantB: c.participantB,
        lastMessage,
        messageCount: c._count.messages,
        updatedAt: lastMessage?.createdAt ?? c.createdAt,
      };
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  await recordAuditLog({
    actorUserId: userId,
    action: "observer.access_used",
    targetUserId: userId,
    targetType: "ObserverAccessGrant",
    targetId: grant.id,
    detail: `Tüm konuşmalar listelendi (${result.length} konuşma)`,
  });

  return res.json({ data: result });
}

export async function getMessages(req: Request, res: Response) {
  const userId = req.user!.sub;
  const conversation = await prisma.conversation.findUnique({ where: { id: idParam(req) } });
  if (!conversation) {
    return res.status(404).json({ error: "Konuşma bulunamadı" });
  }
  const isParticipant = conversation.participantAId === userId || conversation.participantBId === userId;
  if (!isParticipant && req.user!.role !== Role.OWNER) {
    return res.status(403).json({ error: "Bu işlem için yetkiniz yok" });
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
    return res.status(400).json({ error: "Kendinizle konuşma başlatamazsınız" });
  }

  const targetUser = await prisma.user.findUnique({ where: { id: participantId } });
  if (!targetUser) {
    return res.status(404).json({ error: "Kullanıcı bulunamadı" });
  }

  const allowed = await canUsersMessage({ id: me.sub, role: me.role }, { id: targetUser.id, role: targetUser.role });
  if (!allowed) {
    return res.status(403).json({ error: "Bu kullanıcıya mesaj gönderme izniniz yok" });
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

const sendMessageSchema = z.object({
  content: z.string().min(1),
  /// data-URL / base64 görsel; verilirse mesaja ek olarak kaydedilir.
  attachmentBase64: z.string().optional(),
});

export async function sendMessage(req: Request, res: Response) {
  const userId = req.user!.sub;
  const conversation = await prisma.conversation.findUnique({ where: { id: idParam(req) } });
  if (!conversation) {
    return res.status(404).json({ error: "Konuşma bulunamadı" });
  }
  if (conversation.participantAId !== userId && conversation.participantBId !== userId) {
    return res.status(403).json({ error: "Bu işlem için yetkiniz yok" });
  }

  const { content, attachmentBase64 } = sendMessageSchema.parse(req.body);

  // Saha fotografi eki (Stitch Sef -> Mesaj Detayi). Is fotograflariyla ayni
  // depolama altyapisi kullanilir; yalnizca goreli URL saklanir.
  const attachmentUrl = attachmentBase64
    ? await saveBase64Image(attachmentBase64, "message")
    : null;

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderId: userId,
      content,
      attachmentUrl,
      attachmentType: attachmentUrl ? "image" : null,
    },
  });

  const recipientId = conversation.participantAId === userId ? conversation.participantBId : conversation.participantAId;
  const sender = await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true } });
  await notifyUser(recipientId, `Yeni mesaj: ${sender?.fullName ?? "Kullanıcı"}`, content, {
    type: "new_message",
    relatedType: "Conversation",
    relatedId: conversation.id,
  });

  return res.status(201).json(message);
}

export async function markConversationRead(req: Request, res: Response) {
  const userId = req.user!.sub;
  const conversation = await prisma.conversation.findUnique({ where: { id: idParam(req) } });
  if (!conversation) {
    return res.status(404).json({ error: "Konuşma bulunamadı" });
  }
  if (conversation.participantAId !== userId && conversation.participantBId !== userId) {
    return res.status(403).json({ error: "Bu işlem için yetkiniz yok" });
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

// Bölüm L (4. tur): /team/broadcast { message } de aynı handler'ı kullanır —
// `message` ve `content` eşanlamlı kabul edilir.
const broadcastSchema = z
  .object({
    content: z.string().trim().min(1).optional(),
    message: z.string().trim().min(1).optional(),
  })
  .transform((d) => ({ content: (d.content ?? d.message ?? "").trim() }))
  .refine((d) => d.content.length > 0, { message: "Duyuru metni zorunludur", path: ["message"] });

/**
 * Sefin tum dogrudan ekibine ayni mesaji gondermesi
 * (Stitch Sef -> Mesajlar: "Tum Ekibime Toplu Duyuru Gonder").
 *
 * Her ekip uyesiyle AYRI bir birebir konusma kullanilir (grup konusmasi
 * kavrami sistemde yok) — konusma yoksa acilir, varsa yeniden kullanilir.
 * Sefin kendisi alicilardan cikarilir. Tum yazma islemleri tek transaction
 * icindedir: bir alici basarisiz olursa hicbir mesaj yazilmaz, yarim duyuru
 * olusmaz.
 */
export async function broadcastToTeam(req: Request, res: Response) {
  const userId = req.user!.sub;
  const { content } = broadcastSchema.parse(req.body);

  const teamStaffIds = await getTeamStaffIds(userId);
  if (teamStaffIds.length === 0) {
    return res.status(400).json({ error: "Ekibinize bağlı personel bulunamadı" });
  }

  // Staff -> User eslemesi; sefin kendi kaydi disarida birakilir.
  const teamStaff = await prisma.staff.findMany({
    where: { id: { in: teamStaffIds }, user: { is: { id: { not: userId } } } },
    select: { user: { select: { id: true, fullName: true } } },
  });
  const recipients = teamStaff.map((s) => s.user);
  if (recipients.length === 0) {
    return res.status(400).json({ error: "Duyuru gönderilecek ekip üyesi yok" });
  }

  const sender = await prisma.user.findUnique({
    where: { id: userId },
    select: { fullName: true },
  });

  const created = await prisma.$transaction(async (tx) => {
    const messageIds: string[] = [];
    for (const recipient of recipients) {
      const [participantAId, participantBId] = orderedPair(userId, recipient.id);
      const conversation = await tx.conversation.upsert({
        where: { participantAId_participantBId: { participantAId, participantBId } },
        create: { participantAId, participantBId },
        update: {},
      });
      const message = await tx.message.create({
        data: { conversationId: conversation.id, senderId: userId, content },
      });
      messageIds.push(message.id);
    }
    return messageIds;
  });

  // Bildirimler transaction disinda: bildirim yazimindaki bir hata gonderilmis
  // mesajlari geri almamali.
  await Promise.all(
    recipients.map((recipient) =>
      notifyUser(
        recipient.id,
        `Ekip duyurusu: ${sender?.fullName ?? "Ekip lideri"}`,
        content,
        { type: "team_broadcast", relatedType: "User", relatedId: userId }
      )
    )
  );

  await recordAuditLog({
    actorUserId: userId,
    action: "conversation.team_broadcast",
    targetUserId: userId,
    targetType: "Conversation",
    targetId: userId,
    detail: `${recipients.length} ekip üyesine duyuru gönderildi`,
  });

  return res.status(201).json({ recipientCount: recipients.length, messageIds: created });
}

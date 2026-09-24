import { prisma } from "./prisma";

/**
 * Bildirimin `relatedType`'ı → kaydın yaşadığı Prisma modeli. notify.ts
 * çağrılarında kullanılan tüm türler burada olmalı (tür adı = model adı).
 * Listede olmayan bir tür "yetim" sayılmaz — yanlışlıkla silinmesin diye.
 */
const RELATED_MODELS = [
  "AdvanceRequest",
  "AppointmentRequest",
  "Contract",
  "Conversation",
  "Customer",
  "CustomerComplaint",
  "DataDeletionRequest",
  "Job",
  "LeaveRequest",
  "Product",
  "QuoteRequest",
  "Staff",
  "StaffBonus",
  "StaffRequest",
  "User",
] as const;

type Delegate = { findMany(args: { where: { id: { in: string[] } }; select: { id: true } }): Promise<{ id: string }[]> };

function delegateFor(model: string): Delegate {
  return (prisma as unknown as Record<string, Delegate>)[model[0].toLowerCase() + model.slice(1)];
}

/**
 * İşaret ettiği kayıt artık var olmayan bildirimlerin id'leri. Test koşuları
 * gerçek yöneticilere bildirim bırakıp ardından kaydı sildiğinde, ya da bir
 * kayıt silindiğinde oluşur; tıklanınca boş ekrana gider.
 *
 * `since` verilirse yalnızca o andan sonra oluşturulan bildirimlere bakılır
 * (test temizliği yalnızca kendi koşusunun izini siler).
 */
export async function findOrphanNotificationIds(since?: Date): Promise<string[]> {
  const orphanIds: string[] = [];
  for (const model of RELATED_MODELS) {
    const rows = await prisma.notification.findMany({
      where: { relatedType: model, relatedId: { not: null }, ...(since ? { createdAt: { gte: since } } : {}) },
      select: { id: true, relatedId: true },
    });
    if (rows.length === 0) continue;
    const relatedIds = [...new Set(rows.map((r) => r.relatedId!))];
    const existing = new Set((await delegateFor(model).findMany({ where: { id: { in: relatedIds } }, select: { id: true } })).map((r) => r.id));
    for (const r of rows) if (!existing.has(r.relatedId!)) orphanIds.push(r.id);
  }
  return orphanIds;
}

export async function deleteOrphanNotifications(since?: Date): Promise<number> {
  const ids = await findOrphanNotificationIds(since);
  if (ids.length === 0) return 0;
  const { count } = await prisma.notification.deleteMany({ where: { id: { in: ids } } });
  return count;
}

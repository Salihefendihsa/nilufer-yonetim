import { prisma } from "./prisma";

interface RecordAuditLogParams {
  actorUserId: string;
  action: string;
  targetUserId: string | null | undefined;
  targetType?: string;
  targetId?: string;
  detail?: string;
}

/**
 * Writes an audit log entry. targetUserId is mandatory on the model — an action whose
 * target user cannot be unambiguously identified (e.g. a QuoteRequest with no linked
 * account) is intentionally NOT logged rather than recorded against a guessed user.
 */
export async function recordAuditLog(params: RecordAuditLogParams): Promise<void> {
  if (!params.targetUserId) return;

  await prisma.auditLog.create({
    data: {
      actorUserId: params.actorUserId,
      action: params.action,
      targetUserId: params.targetUserId,
      targetType: params.targetType,
      targetId: params.targetId,
      detail: params.detail,
    },
  });
}

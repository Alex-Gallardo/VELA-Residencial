import {
  AttachmentStatus,
  ModerationDecisionSource,
  ModerationStatus,
  type PrismaClient,
} from "@prisma/client";

import { recordAuditEvent } from "@/server/services/audit-service";

export class ModerationServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModerationServiceError";
  }
}

export async function reviewModerationItem(
  database: PrismaClient,
  input: {
    moderationId: string;
    tenantId: string;
    reviewerId: string;
    decision: "APROBADO" | "RECHAZADO";
    reason: string;
  },
) {
  return database.$transaction(async (transaction) => {
    await transaction.$queryRaw`
      SELECT pg_advisory_xact_lock(hashtextextended(${input.moderationId}, 0))::text
    `;
    const item = await transaction.moderationItem.findFirst({
      where: { id: input.moderationId, tenantId: input.tenantId },
      include: { attachment: true },
    });
    if (!item) throw new ModerationServiceError("Imagen no encontrada.");
    if (item.attachment.status !== AttachmentStatus.LISTO)
      throw new ModerationServiceError(
        "La imagen todavía no está lista para revisión.",
      );
    if (item.status !== ModerationStatus.EN_REVISION_HUMANA)
      throw new ModerationServiceError("Esta imagen ya fue decidida.");

    const status = ModerationStatus[input.decision];
    const reviewed = await transaction.moderationItem.update({
      where: { id: item.id },
      data: {
        status,
        decisionSource: ModerationDecisionSource.HUMANA,
        decisionReason: input.reason,
        reviewedById: input.reviewerId,
        reviewedAt: new Date(),
      },
    });
    await recordAuditEvent(transaction, {
      tenantId: input.tenantId,
      actorId: input.reviewerId,
      action: "moderation.reviewed",
      entity: "ModerationItem",
      entityId: item.id,
      metadata: {
        attachmentId: item.attachmentId,
        ticketId: item.attachment.ticketId,
        decision: status,
        reason: input.reason,
      },
    });
    return reviewed;
  });
}

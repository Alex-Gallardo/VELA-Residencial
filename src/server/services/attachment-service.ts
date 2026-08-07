import "server-only";

import {
  AttachmentStatus,
  ModerationDecisionSource,
  ModerationStatus,
  Prisma,
} from "@prisma/client";

import { db } from "@/lib/db";
import { recordAuditEvent } from "@/server/services/audit-service";
import {
  downloadPrivateAttachment,
  removePrivateAttachments,
  uploadProcessedAttachment,
} from "@/server/services/attachment-storage";
import {
  sanitizeImage,
  UnsafeImageError,
} from "@/server/services/image-sanitizer";
import { decideModerationStatus } from "@/server/services/moderation-policy";
import { getModerationProvider } from "@/server/services/moderation-provider";

function processedStorageKey(attachment: {
  tenantId: string;
  uploadedById: string | null;
  id: string;
}) {
  return `processed/${attachment.tenantId}/${attachment.uploadedById ?? "system"}/${attachment.id}/image.webp`;
}

export async function processAttachment(attachmentId: string) {
  const attachment = await db.attachment.findUnique({
    where: { id: attachmentId },
  });
  if (!attachment) return;
  if (attachment.status === AttachmentStatus.LISTO) return;
  if (!attachment.quarantineKey) return;

  const claimed = await db.attachment.updateMany({
    where: {
      id: attachment.id,
      status: {
        in: [AttachmentStatus.SUBIDO, AttachmentStatus.FALLIDO],
      },
    },
    data: { status: AttachmentStatus.PROCESANDO, failureReason: null },
  });
  if (claimed.count === 0) return;

  try {
    const original = await downloadPrivateAttachment(attachment.quarantineKey);
    if (original.byteLength !== attachment.sizeBytes)
      throw new UnsafeImageError(
        "El tamaño cargado no coincide con el archivo declarado.",
      );
    const sanitized = await sanitizeImage(original);
    const providerResult = await getModerationProvider().analyze(
      sanitized.image,
    );
    const moderationStatus = decideModerationStatus(providerResult);
    const storageKey = processedStorageKey(attachment);
    await uploadProcessedAttachment(storageKey, sanitized.image);

    const duplicate = await db.attachment.findFirst({
      where: {
        tenantId: attachment.tenantId,
        checksumSha256: sanitized.checksumSha256,
        id: { not: attachment.id },
      },
      select: { id: true, ticketId: true },
    });
    const labels: Prisma.InputJsonValue = [
      ...providerResult.labels,
      ...(duplicate
        ? [
            {
              name: "exact_image_duplicate",
              confidence: 1,
              attachmentId: duplicate.id,
              ticketId: duplicate.ticketId,
            },
          ]
        : []),
    ];

    await db.$transaction(async (transaction) => {
      await transaction.attachment.update({
        where: { id: attachment.id },
        data: {
          status: AttachmentStatus.LISTO,
          storageKey,
          mimeType: sanitized.mimeType,
          sizeBytes: sanitized.image.byteLength,
          checksumSha256: sanitized.checksumSha256,
          width: sanitized.width,
          height: sanitized.height,
          exifStripped: true,
          processedAt: new Date(),
          failureReason: null,
        },
      });
      await transaction.moderationItem.upsert({
        where: { attachmentId: attachment.id },
        create: {
          tenantId: attachment.tenantId,
          attachmentId: attachment.id,
          status: moderationStatus,
          provider: providerResult.provider,
          confidence: providerResult.riskScore,
          labels,
          decisionSource:
            moderationStatus === ModerationStatus.EN_REVISION_HUMANA
              ? null
              : ModerationDecisionSource.PROVEEDOR,
          decisionReason:
            moderationStatus === ModerationStatus.EN_REVISION_HUMANA
              ? "Proveedor externo pendiente; requiere revisión humana."
              : "Decisión automática según umbrales configurados.",
        },
        update: {
          status: moderationStatus,
          provider: providerResult.provider,
          confidence: providerResult.riskScore,
          labels,
          decisionSource:
            moderationStatus === ModerationStatus.EN_REVISION_HUMANA
              ? null
              : ModerationDecisionSource.PROVEEDOR,
          decisionReason:
            moderationStatus === ModerationStatus.EN_REVISION_HUMANA
              ? "Proveedor externo pendiente; requiere revisión humana."
              : "Decisión automática según umbrales configurados.",
        },
      });
      await recordAuditEvent(transaction, {
        tenantId: attachment.tenantId,
        action: "attachment.processed",
        entity: "Attachment",
        entityId: attachment.id,
        metadata: {
          moderationStatus,
          provider: providerResult.provider,
          duplicateAttachmentId: duplicate?.id ?? null,
        },
      });
    });
  } catch (error) {
    const unsafe = error instanceof UnsafeImageError;
    const reason =
      error instanceof Error
        ? error.message.slice(0, 300)
        : "No se pudo procesar la imagen.";
    await db.$transaction(async (transaction) => {
      await transaction.attachment.update({
        where: { id: attachment.id },
        data: {
          status: unsafe
            ? AttachmentStatus.RECHAZADO
            : AttachmentStatus.FALLIDO,
          failureReason: reason,
        },
      });
      if (unsafe)
        await transaction.moderationItem.upsert({
          where: { attachmentId: attachment.id },
          create: {
            tenantId: attachment.tenantId,
            attachmentId: attachment.id,
            status: ModerationStatus.RECHAZADO,
            provider: "local-security",
            decisionSource: ModerationDecisionSource.REGLAS_LOCALES,
            decisionReason: reason,
            labels: [{ name: "unsafe_file", confidence: 1 }],
          },
          update: {
            status: ModerationStatus.RECHAZADO,
            provider: "local-security",
            decisionSource: ModerationDecisionSource.REGLAS_LOCALES,
            decisionReason: reason,
            labels: [{ name: "unsafe_file", confidence: 1 }],
          },
        });
      await recordAuditEvent(transaction, {
        tenantId: attachment.tenantId,
        action: unsafe ? "attachment.rejected" : "attachment.failed",
        entity: "Attachment",
        entityId: attachment.id,
        metadata: { reason },
      });
    });
    return;
  }

  try {
    await removePrivateAttachments([attachment.quarantineKey]);
  } catch (error) {
    const reason =
      error instanceof Error
        ? error.message.slice(0, 300)
        : "No se pudo limpiar la cuarentena.";
    await recordAuditEvent(db, {
      tenantId: attachment.tenantId,
      action: "attachment.quarantine_cleanup_failed",
      entity: "Attachment",
      entityId: attachment.id,
      metadata: { reason, quarantineKey: attachment.quarantineKey },
    }).catch(() => undefined);
  }
}

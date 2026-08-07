"use server";

import { randomUUID } from "node:crypto";

import { AttachmentStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  extensionForMimeType,
  finalizeAttachmentSchema,
  initializeAttachmentSchema,
} from "@/lib/validations/attachment";
import { processAttachment } from "@/server/services/attachment-service";
import {
  createAttachmentUploadUrl,
  removePrivateAttachments,
} from "@/server/services/attachment-storage";

export type InitializeAttachmentResult =
  | {
      success: true;
      attachmentId: string;
      path: string;
      token: string;
    }
  | { success: false; error: string };

export async function initializeAttachmentAction(
  input: unknown,
): Promise<InitializeAttachmentResult> {
  const parsed = initializeAttachmentSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "La imagen no es válida.",
    };

  const context = await requirePermission("create", "ticket");
  const extension = extensionForMimeType(parsed.data.mimeType);
  if (!extension)
    return { success: false, error: "Formato de imagen no permitido." };
  const attachmentId = randomUUID();
  const path = `quarantine/${context.membership.tenantId}/${context.user.id}/${attachmentId}/original.${extension}`;

  await db.attachment.create({
    data: {
      id: attachmentId,
      tenantId: context.membership.tenantId,
      uploadedById: context.user.id,
      quarantineKey: path,
      originalName: parsed.data.fileName,
      mimeType: parsed.data.mimeType,
      sizeBytes: parsed.data.sizeBytes,
    },
  });
  try {
    const upload = await createAttachmentUploadUrl(path);
    return {
      success: true,
      attachmentId,
      path: upload.path,
      token: upload.token,
    };
  } catch (error) {
    await db.attachment.delete({ where: { id: attachmentId } });
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo preparar la carga.",
    };
  }
}

export async function finalizeAttachmentAction(input: unknown) {
  const parsed = finalizeAttachmentSchema.safeParse(input);
  if (!parsed.success)
    return { success: false as const, error: "Identificador inválido." };
  const context = await requirePermission("create", "ticket");
  const updated = await db.attachment.updateMany({
    where: {
      id: parsed.data.attachmentId,
      tenantId: context.membership.tenantId,
      uploadedById: context.user.id,
      ticketId: null,
      status: AttachmentStatus.PENDIENTE_SUBIDA,
    },
    data: { status: AttachmentStatus.SUBIDO },
  });
  if (updated.count !== 1)
    return {
      success: false as const,
      error: "La carga ya fue procesada o no pertenece a tu cuenta.",
    };

  after(() => processAttachment(parsed.data.attachmentId));
  return { success: true as const, attachmentId: parsed.data.attachmentId };
}

export async function discardAttachmentAction(input: unknown) {
  const parsed = finalizeAttachmentSchema.safeParse(input);
  if (!parsed.success) return { success: false as const };
  const context = await requirePermission("create", "ticket");
  const attachment = await db.attachment.findFirst({
    where: {
      id: parsed.data.attachmentId,
      tenantId: context.membership.tenantId,
      uploadedById: context.user.id,
      ticketId: null,
      status: {
        in: [
          AttachmentStatus.PENDIENTE_SUBIDA,
          AttachmentStatus.SUBIDO,
          AttachmentStatus.LISTO,
          AttachmentStatus.FALLIDO,
          AttachmentStatus.RECHAZADO,
        ],
      },
    },
  });
  if (!attachment) return { success: false as const };
  const claimed = await db.attachment.updateMany({
    where: { id: attachment.id, status: attachment.status },
    data: {
      status: AttachmentStatus.RECHAZADO,
      failureReason: "Descartado por la persona usuaria.",
    },
  });
  if (claimed.count !== 1) return { success: false as const };
  await removePrivateAttachments(
    [attachment.quarantineKey, attachment.storageKey].filter(
      (key): key is string => Boolean(key),
    ),
  );
  await db.attachment.delete({ where: { id: attachment.id } });
  return { success: true as const };
}

export async function retryAttachmentProcessingAction(formData: FormData) {
  const context = await requirePermission("moderate", "moderation");
  const parsed = finalizeAttachmentSchema.safeParse({
    attachmentId: formData.get("attachmentId"),
  });
  if (!parsed.success) return;
  const attachment = await db.attachment.findFirst({
    where: {
      id: parsed.data.attachmentId,
      tenantId: context.membership.tenantId,
      status: AttachmentStatus.FALLIDO,
    },
    select: { id: true },
  });
  if (!attachment) return;
  after(() => processAttachment(attachment.id));
  revalidatePath("/admin/moderacion");
}

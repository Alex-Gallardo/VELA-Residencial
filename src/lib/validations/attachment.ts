import { z } from "zod";

export const ATTACHMENT_BUCKET = "attachments";
export const MAX_ATTACHMENT_BYTES = 6 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 25_000_000;

export const allowedImageMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const initializeAttachmentSchema = z.object({
  fileName: z.string().trim().min(1).max(180),
  mimeType: z.enum(allowedImageMimeTypes),
  sizeBytes: z.number().int().positive().max(MAX_ATTACHMENT_BYTES),
});

export const finalizeAttachmentSchema = z.object({
  attachmentId: z.string().uuid(),
});

export const moderationDecisionSchema = z.object({
  moderationId: z.string().min(1),
  decision: z.enum(["APROBADO", "RECHAZADO"]),
  reason: z.string().trim().min(3).max(300),
});

export function extensionForMimeType(mimeType: string) {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return null;
}

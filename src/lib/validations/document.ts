import { z } from "zod";

export const DOCUMENT_BUCKET = "documents";
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const DOCUMENT_CATEGORIES = [
  "REGLAMENTO",
  "POLITICA",
  "ACTA",
  "PROTOCOLO",
] as const;

export const prepareDocumentSchema = z.object({
  title: z.string().trim().min(3).max(160),
  category: z.enum(DOCUMENT_CATEGORIES),
  seriesId: z.string().trim().min(1).optional(),
  fileName: z.string().trim().min(1).max(200),
  mimeType: z.literal("application/pdf"),
  sizeBytes: z.number().int().positive().max(MAX_DOCUMENT_BYTES),
});

export const completeDocumentSchema = prepareDocumentSchema.extend({
  seriesId: z.string().trim().min(1),
  storageKey: z.string().trim().min(10).max(600),
});

export type PrepareDocumentInput = z.infer<typeof prepareDocumentSchema>;

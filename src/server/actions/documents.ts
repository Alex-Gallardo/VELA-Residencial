"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  completeDocumentSchema,
  prepareDocumentSchema,
} from "@/lib/validations/document";
import {
  archiveDocument,
  completeDocumentUpload,
  DocumentServiceError,
  prepareDocumentUpload,
  removeDocumentObject,
} from "@/server/services/document-service";

export async function prepareDocumentUploadAction(payload: unknown) {
  const context = await requirePermission("create", "document");
  const parsed = prepareDocumentSchema.safeParse(payload);
  if (!parsed.success)
    return {
      error: parsed.error.issues[0]?.message ?? "Revisa los datos del PDF.",
    };
  try {
    const upload = await prepareDocumentUpload(db, {
      ...parsed.data,
      tenantId: context.membership.tenantId,
    });
    return { upload };
  } catch (error) {
    if (error instanceof DocumentServiceError) return { error: error.message };
    throw error;
  }
}

export async function completeDocumentUploadAction(payload: unknown) {
  const context = await requirePermission("create", "document");
  const parsed = completeDocumentSchema.safeParse(payload);
  if (!parsed.success)
    return {
      error: parsed.error.issues[0]?.message ?? "No se pudo validar el PDF.",
    };
  try {
    const document = await completeDocumentUpload(db, {
      ...parsed.data,
      tenantId: context.membership.tenantId,
      actorId: context.user.id,
    });
    revalidatePath("/admin/documentos");
    revalidatePath("/reglamento");
    return { success: true, documentId: document.id };
  } catch (error) {
    await removeDocumentObject(parsed.data.storageKey).catch(() => undefined);
    if (error instanceof DocumentServiceError) return { error: error.message };
    throw error;
  }
}

export async function archiveDocumentAction(formData: FormData) {
  const context = await requirePermission("delete", "document");
  const documentId = z.string().min(1).parse(formData.get("documentId"));
  try {
    await archiveDocument(db, {
      documentId,
      tenantId: context.membership.tenantId,
      actorId: context.user.id,
    });
  } catch (error) {
    if (error instanceof DocumentServiceError)
      redirect(`/admin/documentos?error=${encodeURIComponent(error.message)}`);
    throw error;
  }
  revalidatePath("/admin/documentos");
  revalidatePath("/reglamento");
  redirect("/admin/documentos?message=Documento+archivado");
}

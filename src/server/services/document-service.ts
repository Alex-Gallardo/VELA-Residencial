import "server-only";

import { randomUUID } from "node:crypto";

import type { PrismaClient } from "@prisma/client";

import {
  DOCUMENT_BUCKET,
  MAX_DOCUMENT_BYTES,
  type PrepareDocumentInput,
} from "@/lib/validations/document";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAuditEvent } from "@/server/services/audit-service";

export class DocumentServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentServiceError";
  }
}

function safeFileStem(fileName: string) {
  return (
    fileName
      .replace(/\.pdf$/i, "")
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "documento"
  );
}

export async function prepareDocumentUpload(
  database: PrismaClient,
  input: PrepareDocumentInput & { tenantId: string },
) {
  const seriesId = input.seriesId ?? randomUUID();
  if (input.seriesId) {
    const seriesExists = await database.document.count({
      where: { tenantId: input.tenantId, seriesId },
    });
    if (!seriesExists)
      throw new DocumentServiceError("La serie del documento no existe.");
  }
  const storageKey = `${input.tenantId}/${seriesId}/${randomUUID()}-${safeFileStem(input.fileName)}.pdf`;
  const { data, error } = await createAdminClient()
    .storage.from(DOCUMENT_BUCKET)
    .createSignedUploadUrl(storageKey);
  if (error || !data)
    throw new DocumentServiceError("No se pudo preparar la carga del PDF.");
  return { ...data, storageKey, seriesId };
}

async function readAndValidatePdf(storageKey: string, declaredSize: number) {
  const { data, error } = await createAdminClient()
    .storage.from(DOCUMENT_BUCKET)
    .download(storageKey);
  if (error || !data)
    throw new DocumentServiceError("El archivo no terminó de cargarse.");
  const bytes = new Uint8Array(await data.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_DOCUMENT_BYTES)
    throw new DocumentServiceError("El PDF excede el máximo de 10 MB.");
  if (bytes.length !== declaredSize)
    throw new DocumentServiceError(
      "El tamaño cargado no coincide con el archivo.",
    );
  const signature = new TextDecoder("ascii").decode(bytes.slice(0, 5));
  if (signature !== "%PDF-")
    throw new DocumentServiceError("El archivo cargado no es un PDF válido.");
}

export async function completeDocumentUpload(
  database: PrismaClient,
  input: PrepareDocumentInput & {
    tenantId: string;
    actorId: string;
    seriesId: string;
    storageKey: string;
  },
) {
  const expectedPrefix = `${input.tenantId}/${input.seriesId}/`;
  if (!input.storageKey.startsWith(expectedPrefix))
    throw new DocumentServiceError(
      "La ruta del documento no pertenece al residencial.",
    );
  await readAndValidatePdf(input.storageKey, input.sizeBytes);

  return database.$transaction(async (transaction) => {
    await transaction.$queryRaw`
      SELECT pg_advisory_xact_lock(
        hashtextextended(${`${input.tenantId}:${input.seriesId}`}, 5)
      )::text
    `;
    const previous = await transaction.document.findFirst({
      where: { tenantId: input.tenantId, seriesId: input.seriesId },
      orderBy: { version: "desc" },
    });
    if (input.seriesId && input.seriesId !== previous?.seriesId) {
      const pathWasPreparedForNewSeries = !previous;
      if (!pathWasPreparedForNewSeries)
        throw new DocumentServiceError("La serie del documento no es válida.");
    }
    const version = (previous?.version ?? 0) + 1;
    await transaction.document.updateMany({
      where: {
        tenantId: input.tenantId,
        seriesId: input.seriesId,
        isCurrent: true,
      },
      data: { isCurrent: false },
    });
    const document = await transaction.document.create({
      data: {
        tenantId: input.tenantId,
        seriesId: input.seriesId,
        title: input.title,
        category: input.category,
        storageKey: input.storageKey,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        version,
        uploadedById: input.actorId,
      },
    });
    await recordAuditEvent(transaction, {
      tenantId: input.tenantId,
      actorId: input.actorId,
      action: version === 1 ? "document.created" : "document.version_published",
      entity: "Document",
      entityId: document.id,
      metadata: {
        seriesId: document.seriesId,
        version: document.version,
        category: document.category,
        sizeBytes: document.sizeBytes,
      },
    });
    return document;
  });
}

export async function archiveDocument(
  database: PrismaClient,
  input: { tenantId: string; actorId: string; documentId: string },
) {
  return database.$transaction(async (transaction) => {
    const document = await transaction.document.findFirst({
      where: {
        id: input.documentId,
        tenantId: input.tenantId,
        isCurrent: true,
      },
    });
    if (!document)
      throw new DocumentServiceError("El documento ya no está vigente.");
    await transaction.document.update({
      where: { id: document.id },
      data: { isCurrent: false },
    });
    await recordAuditEvent(transaction, {
      tenantId: input.tenantId,
      actorId: input.actorId,
      action: "document.archived",
      entity: "Document",
      entityId: document.id,
      metadata: { seriesId: document.seriesId, version: document.version },
    });
  });
}

export async function removeDocumentObject(storageKey: string) {
  await createAdminClient().storage.from(DOCUMENT_BUCKET).remove([storageKey]);
}

export async function createDocumentViewUrl(storageKey: string) {
  const { data, error } = await createAdminClient()
    .storage.from(DOCUMENT_BUCKET)
    .createSignedUrl(storageKey, 5 * 60);
  if (error || !data)
    throw new DocumentServiceError("No se pudo abrir el documento privado.");
  return data.signedUrl;
}

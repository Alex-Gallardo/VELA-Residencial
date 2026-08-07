import "server-only";

import { ATTACHMENT_BUCKET } from "@/lib/validations/attachment";
import { createAdminClient } from "@/lib/supabase/admin";

export const SIGNED_IMAGE_URL_TTL_SECONDS = 5 * 60;

export class AttachmentStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AttachmentStorageError";
  }
}

export async function createAttachmentUploadUrl(storageKey: string) {
  const { data, error } = await createAdminClient()
    .storage.from(ATTACHMENT_BUCKET)
    .createSignedUploadUrl(storageKey);
  if (error)
    throw new AttachmentStorageError(
      "No se pudo preparar la carga segura de la imagen.",
    );
  return data;
}

export async function downloadPrivateAttachment(storageKey: string) {
  const { data, error } = await createAdminClient()
    .storage.from(ATTACHMENT_BUCKET)
    .download(storageKey);
  if (error || !data)
    throw new AttachmentStorageError("No se pudo leer la imagen privada.");
  return new Uint8Array(await data.arrayBuffer());
}

export async function uploadProcessedAttachment(
  storageKey: string,
  image: Uint8Array,
) {
  const { error } = await createAdminClient()
    .storage.from(ATTACHMENT_BUCKET)
    .upload(storageKey, image, {
      contentType: "image/webp",
      cacheControl: "31536000",
      upsert: true,
    });
  if (error)
    throw new AttachmentStorageError(
      "No se pudo guardar la copia procesada de la imagen.",
    );
}

export async function removePrivateAttachments(storageKeys: string[]) {
  if (storageKeys.length === 0) return;
  const { error } = await createAdminClient()
    .storage.from(ATTACHMENT_BUCKET)
    .remove(storageKeys);
  if (error)
    throw new AttachmentStorageError("No se pudo limpiar la imagen temporal.");
}

export async function createAttachmentViewUrl(storageKey: string) {
  const { data, error } = await createAdminClient()
    .storage.from(ATTACHMENT_BUCKET)
    .createSignedUrl(storageKey, SIGNED_IMAGE_URL_TTL_SECONDS);
  if (error)
    throw new AttachmentStorageError("No se pudo firmar la imagen privada.");
  return data.signedUrl;
}

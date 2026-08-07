import {
  AttachmentStatus,
  ModerationDecisionSource,
  ModerationStatus,
  PrismaClient,
} from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const prisma = new PrismaClient();
const TEST_TITLE = "Luminaria dañada Sprint 3 E2E";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function getFixture() {
  const attachment = await prisma.attachment.findFirst({
    where: { ticket: { title: TEST_TITLE } },
    include: { moderation: true, ticket: true },
    orderBy: { createdAt: "desc" },
  });
  assert(attachment, "No existe la imagen de la prueba E2E de Sprint 3.");
  return attachment;
}

async function verifyPending() {
  const attachment = await getFixture();
  assert(
    attachment.status === AttachmentStatus.LISTO,
    "La imagen no terminó de procesarse.",
  );
  assert(
    attachment.storageKey?.endsWith(".webp"),
    "No se generó el WebP sanitizado.",
  );
  assert(attachment.exifStripped, "No consta la eliminación de metadatos.");
  assert(attachment.checksumSha256?.length === 64, "Falta el hash SHA-256.");
  assert(
    (attachment.width ?? 0) > 0 && (attachment.height ?? 0) > 0,
    "Faltan dimensiones.",
  );
  assert(
    attachment.moderation?.status === ModerationStatus.EN_REVISION_HUMANA,
    "La imagen no está en la cola humana.",
  );
  assert(
    attachment.moderation.provider === "deferred",
    "Se invocó un proveedor no esperado.",
  );
  const audit = await prisma.auditLog.findFirst({
    where: { entityId: attachment.id, action: "attachment.processed" },
  });
  assert(audit, "Falta el evento de auditoría attachment.processed.");
  console.log(
    JSON.stringify({ verified: "pending", ticketId: attachment.ticketId }),
  );
}

async function verifyApproved() {
  const attachment = await getFixture();
  assert(
    attachment.moderation?.status === ModerationStatus.APROBADO,
    "La imagen no fue aprobada.",
  );
  assert(
    attachment.moderation.decisionSource === ModerationDecisionSource.HUMANA,
    "La decisión no quedó atribuida a revisión humana.",
  );
  assert(attachment.moderation.reviewedById, "Falta el moderador responsable.");
  assert(attachment.moderation.reviewedAt, "Falta la fecha de revisión.");
  const audit = await prisma.auditLog.findFirst({
    where: {
      entityId: attachment.moderation.id,
      action: "moderation.reviewed",
    },
  });
  assert(audit, "Falta el evento de auditoría moderation.reviewed.");
  console.log(
    JSON.stringify({ verified: "approved", ticketId: attachment.ticketId }),
  );
}

async function cleanupStorage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  assert(url && key, "Faltan credenciales administrativas de Supabase.");
  const attachments = await prisma.attachment.findMany({
    where: { ticket: { title: TEST_TITLE } },
    select: { quarantineKey: true, storageKey: true },
  });
  const keys = [
    ...new Set(
      attachments
        .flatMap((item) => [item.quarantineKey, item.storageKey])
        .filter(Boolean),
    ),
  ] as string[];
  if (keys.length) {
    const { error } = await createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
      .storage.from("attachments")
      .remove(keys);
    if (error) throw error;
  }
  console.log(JSON.stringify({ cleanedStorageObjects: keys.length }));
}

async function main() {
  const mode = process.argv[2];
  try {
    if (mode === "verify-pending") await verifyPending();
    else if (mode === "verify-approved") await verifyApproved();
    else if (mode === "cleanup-storage") await cleanupStorage();
    else
      throw new Error(
        "Uso: sprint-3-e2e.ts verify-pending|verify-approved|cleanup-storage",
      );
  } finally {
    await prisma.$disconnect();
  }
}

void main();

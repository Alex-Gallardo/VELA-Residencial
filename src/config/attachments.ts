import { AttachmentStatus, ModerationStatus } from "@prisma/client";

export const attachmentStatusLabels: Record<AttachmentStatus, string> = {
  PENDIENTE_SUBIDA: "Pendiente de carga",
  SUBIDO: "Carga completada",
  PROCESANDO: "Procesando",
  LISTO: "Procesada",
  RECHAZADO: "Rechazada por seguridad",
  FALLIDO: "Procesamiento fallido",
};

export const moderationStatusLabels: Record<ModerationStatus, string> = {
  PENDIENTE: "Moderación pendiente",
  APROBADO: "Aprobada",
  RECHAZADO: "Rechazada",
  EN_REVISION_HUMANA: "Revisión humana",
};

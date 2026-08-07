import { TicketCategory, TicketStatus } from "@prisma/client";

export const ticketCategoryLabels: Record<TicketCategory, string> = {
  SEGURIDAD: "Seguridad",
  MANTENIMIENTO: "Mantenimiento",
  LIMPIEZA: "Limpieza",
  ILUMINACION: "Iluminación",
  RUIDO: "Ruido",
  AREAS_COMUNES: "Áreas comunes",
  REGLAMENTO: "Reglamento",
  SUGERENCIA: "Sugerencia",
  OTRO: "Otro",
};

export const ticketStatusLabels: Record<TicketStatus, string> = {
  BORRADOR: "Borrador",
  ENVIADO: "Enviado",
  EN_REVISION: "En revisión",
  PENDIENTE_INFO: "Pendiente de información",
  ASIGNADO: "Asignado",
  EN_PROCESO: "En proceso",
  RESUELTO: "Resuelto",
  CERRADO: "Cerrado",
  DUPLICADO: "Duplicado",
  RECHAZADO: "Rechazado",
  ESCALADO: "Escalado",
  REABIERTO: "Reabierto",
};

export const openTicketStatuses: TicketStatus[] = [
  TicketStatus.ENVIADO,
  TicketStatus.EN_REVISION,
  TicketStatus.PENDIENTE_INFO,
  TicketStatus.ASIGNADO,
  TicketStatus.EN_PROCESO,
  TicketStatus.ESCALADO,
  TicketStatus.REABIERTO,
];

export function formatTicketNumber(number: number) {
  return `#${number.toString().padStart(3, "0")}`;
}

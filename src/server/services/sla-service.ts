import type { TicketStatus } from "@prisma/client";

const CLOSED_STATUSES = new Set<TicketStatus>([
  "RESUELTO",
  "CERRADO",
  "DUPLICADO",
  "RECHAZADO",
]);

export function calculateSlaDueAt(start: Date, slaHours: number) {
  if (!Number.isInteger(slaHours) || slaHours <= 0)
    throw new Error("Las horas de SLA deben ser un entero positivo");
  return new Date(start.getTime() + slaHours * 60 * 60 * 1000);
}

export type SlaState =
  | "sin_sla"
  | "cumplido"
  | "en_tiempo"
  | "en_riesgo"
  | "vencido";

export function getSlaState(input: {
  slaDueAt: Date | null;
  status: TicketStatus;
  resolvedAt?: Date | null;
  now?: Date;
}): SlaState {
  if (!input.slaDueAt) return "sin_sla";
  if (CLOSED_STATUSES.has(input.status)) {
    const completedAt = input.resolvedAt ?? input.now ?? new Date();
    return completedAt <= input.slaDueAt ? "cumplido" : "vencido";
  }
  const now = input.now ?? new Date();
  if (now > input.slaDueAt) return "vencido";
  const remainingMs = input.slaDueAt.getTime() - now.getTime();
  return remainingMs <= 6 * 60 * 60 * 1000 ? "en_riesgo" : "en_tiempo";
}

export function formatSla(slaDueAt: Date | null, now = new Date()) {
  if (!slaDueAt) return "Sin SLA configurado";
  const remainingMs = slaDueAt.getTime() - now.getTime();
  const absoluteHours = Math.ceil(Math.abs(remainingMs) / (60 * 60 * 1000));
  if (remainingMs < 0) return `SLA vencido hace ${absoluteHours} h`;
  if (absoluteHours < 24) return `SLA: ${absoluteHours} h restantes`;
  return `SLA: ${Math.ceil(absoluteHours / 24)} días restantes`;
}

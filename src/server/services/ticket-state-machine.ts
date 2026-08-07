import { TicketStatus } from "@prisma/client";

const transitions: Record<TicketStatus, readonly TicketStatus[]> = {
  BORRADOR: [TicketStatus.ENVIADO],
  ENVIADO: [
    TicketStatus.EN_REVISION,
    TicketStatus.ASIGNADO,
    TicketStatus.RECHAZADO,
    TicketStatus.DUPLICADO,
    TicketStatus.ESCALADO,
  ],
  EN_REVISION: [
    TicketStatus.PENDIENTE_INFO,
    TicketStatus.ASIGNADO,
    TicketStatus.EN_PROCESO,
    TicketStatus.RECHAZADO,
    TicketStatus.DUPLICADO,
    TicketStatus.ESCALADO,
  ],
  PENDIENTE_INFO: [
    TicketStatus.EN_REVISION,
    TicketStatus.ASIGNADO,
    TicketStatus.EN_PROCESO,
    TicketStatus.RECHAZADO,
  ],
  ASIGNADO: [
    TicketStatus.EN_PROCESO,
    TicketStatus.PENDIENTE_INFO,
    TicketStatus.ESCALADO,
  ],
  EN_PROCESO: [
    TicketStatus.PENDIENTE_INFO,
    TicketStatus.RESUELTO,
    TicketStatus.ESCALADO,
  ],
  RESUELTO: [TicketStatus.CERRADO, TicketStatus.REABIERTO],
  CERRADO: [TicketStatus.REABIERTO],
  DUPLICADO: [TicketStatus.CERRADO],
  RECHAZADO: [TicketStatus.CERRADO, TicketStatus.REABIERTO],
  ESCALADO: [
    TicketStatus.ASIGNADO,
    TicketStatus.EN_PROCESO,
    TicketStatus.RESUELTO,
  ],
  REABIERTO: [
    TicketStatus.EN_REVISION,
    TicketStatus.ASIGNADO,
    TicketStatus.EN_PROCESO,
  ],
};

export class InvalidTicketTransitionError extends Error {
  constructor(from: TicketStatus, to: TicketStatus) {
    super(`Transición de ${from} a ${to} no permitida`);
    this.name = "InvalidTicketTransitionError";
  }
}

export function availableTicketTransitions(status: TicketStatus) {
  return [...transitions[status]];
}

export function canTransitionTicket(from: TicketStatus, to: TicketStatus) {
  return transitions[from].includes(to);
}

export function assertTicketTransition(from: TicketStatus, to: TicketStatus) {
  if (!canTransitionTicket(from, to))
    throw new InvalidTicketTransitionError(from, to);
}

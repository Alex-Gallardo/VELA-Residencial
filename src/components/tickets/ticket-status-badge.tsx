import type { TicketStatus } from "@prisma/client";

import { ticketStatusLabels } from "@/config/tickets";

const tones: Record<TicketStatus, string> = {
  BORRADOR: "bg-background text-muted",
  ENVIADO: "bg-info/10 text-info",
  EN_REVISION: "bg-info/10 text-info",
  PENDIENTE_INFO: "bg-warning/10 text-warning",
  ASIGNADO: "bg-vela-soft text-vela",
  EN_PROCESO: "bg-warning/10 text-warning",
  RESUELTO: "bg-success/10 text-success",
  CERRADO: "bg-background text-muted",
  DUPLICADO: "bg-background text-muted",
  RECHAZADO: "bg-danger/10 text-danger",
  ESCALADO: "bg-danger/10 text-danger",
  REABIERTO: "bg-warning/10 text-warning",
};

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${tones[status]}`}
    >
      {ticketStatusLabels[status]}
    </span>
  );
}

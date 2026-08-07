import type { TicketStatus } from "@prisma/client";

import { formatSla, getSlaState } from "@/server/services/sla-service";

export function SlaBadge({
  dueAt,
  status,
  resolvedAt,
}: {
  dueAt: Date | null;
  status: TicketStatus;
  resolvedAt?: Date | null;
}) {
  const state = getSlaState({ slaDueAt: dueAt, status, resolvedAt });
  const tone =
    state === "vencido"
      ? "text-danger"
      : state === "en_riesgo"
        ? "text-warning"
        : state === "cumplido"
          ? "text-success"
          : "text-muted";
  const label =
    state === "cumplido"
      ? "SLA cumplido"
      : state === "vencido" && resolvedAt
        ? "SLA vencido"
        : formatSla(dueAt);
  return <span className={`text-xs font-medium ${tone}`}>{label}</span>;
}

import { TicketStatus } from "@prisma/client";
import { ClipboardList, Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ResidentShell } from "@/components/app/resident-shell";
import { FormMessage } from "@/components/form-message";
import { SlaBadge } from "@/components/tickets/sla-badge";
import { TicketStatusBadge } from "@/components/tickets/ticket-status-badge";
import {
  formatTicketNumber,
  ticketCategoryLabels,
  ticketStatusLabels,
} from "@/config/tickets";
import { getAuthContext } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const [context, query] = await Promise.all([getAuthContext(), searchParams]);
  if (!context?.user) redirect("/login?next=/reportes");
  if (!context.membership) redirect("/onboarding");
  const status = Object.values(TicketStatus).includes(
    query.status as TicketStatus,
  )
    ? (query.status as TicketStatus)
    : undefined;
  const tickets = await db.ticket.findMany({
    where: {
      tenantId: context.membership.tenantId,
      createdById: context.user.id,
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <ResidentShell active="reportes">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-brand">
            Seguimiento
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Mis reportes
          </h1>
          <p className="mt-2 text-sm text-muted">
            Consulta el estado y el SLA de cada solicitud.
          </p>
        </div>
        <Link
          className="inline-flex min-h-11 items-center gap-2 rounded-md bg-brand px-5 font-medium text-white"
          href="/reportes/nuevo"
        >
          <Plus className="size-4" aria-hidden="true" /> Nuevo reporte
        </Link>
      </div>
      <div className="mt-6">
        <FormMessage error={query.error} />
      </div>
      <form className="mt-6 flex flex-wrap items-end gap-3" method="get">
        <label className="text-sm font-medium">
          Estado
          <select
            className="mt-2 block min-h-11 rounded-md border bg-surface px-3"
            name="status"
            defaultValue={status ?? ""}
          >
            <option value="">Todos</option>
            {Object.values(TicketStatus)
              .filter((item) => item !== TicketStatus.BORRADOR)
              .map((item) => (
                <option key={item} value={item}>
                  {ticketStatusLabels[item]}
                </option>
              ))}
          </select>
        </label>
        <button className="min-h-11 rounded-md border bg-surface px-4 text-sm font-medium">
          Filtrar
        </button>
      </form>

      <div className="mt-7 space-y-3">
        {tickets.length === 0 && (
          <div className="rounded-xl border bg-surface p-8 text-center shadow-sm">
            <ClipboardList
              className="mx-auto size-10 text-faint"
              aria-hidden="true"
            />
            <h2 className="mt-4 text-lg font-semibold">
              No hay reportes en esta vista
            </h2>
            <p className="mt-2 text-sm text-muted">
              Crea uno nuevo o cambia el filtro de estado.
            </p>
          </div>
        )}
        {tickets.map((ticket) => (
          <Link
            key={ticket.id}
            className="block rounded-xl border bg-surface p-5 shadow-sm transition hover:border-brand"
            href={`/reportes/${ticket.id}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs text-brand">
                  {formatTicketNumber(ticket.number)}
                </p>
                <h2 className="mt-1 font-semibold">{ticket.title}</h2>
                <p className="mt-2 text-xs text-muted">
                  {ticketCategoryLabels[ticket.category]} ·{" "}
                  {ticket.createdAt.toLocaleDateString("es-GT")}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <TicketStatusBadge status={ticket.status} />
                <SlaBadge
                  dueAt={ticket.slaDueAt}
                  status={ticket.status}
                  resolvedAt={ticket.resolvedAt}
                />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </ResidentShell>
  );
}

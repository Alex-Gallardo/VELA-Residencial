import { RoleName, TicketCategory, TicketStatus } from "@prisma/client";
import { Filter, Inbox, UserRoundCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
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
import { can } from "@/lib/permissions";
import { assignTicketAction } from "@/server/actions/tickets";

export default async function AdminTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    category?: string;
    assignee?: string;
    error?: string;
  }>;
}) {
  const [context, query] = await Promise.all([getAuthContext(), searchParams]);
  if (!context?.user) redirect("/login?next=/admin/tickets");
  if (!context.membership || !can(context.membership, "triage", "ticket"))
    redirect("/inicio?denied=1");

  const status = Object.values(TicketStatus).includes(
    query.status as TicketStatus,
  )
    ? (query.status as TicketStatus)
    : undefined;
  const category = Object.values(TicketCategory).includes(
    query.category as TicketCategory,
  )
    ? (query.category as TicketCategory)
    : undefined;
  const [tickets, memberships] = await Promise.all([
    db.ticket.findMany({
      where: {
        tenantId: context.membership.tenantId,
        ...(status ? { status } : {}),
        ...(category ? { category } : {}),
        ...(query.assignee === "unassigned"
          ? { assigneeId: null }
          : query.assignee
            ? { assigneeId: query.assignee }
            : {}),
      },
      include: { createdBy: true, assignee: true, dwelling: true },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      take: 100,
    }),
    db.membership.findMany({
      where: {
        tenantId: context.membership.tenantId,
        active: true,
        roles: { some: { role: { not: RoleName.RESIDENTE } } },
      },
      include: { user: true, roles: true },
      orderBy: { user: { fullName: "asc" } },
    }),
  ]);
  const now = new Date();
  const staff = memberships.filter((membership) =>
    membership.roles.some(
      ({ role, expiresAt }) =>
        role !== RoleName.RESIDENTE && (!expiresAt || expiresAt > now),
    ),
  );

  return (
    <AdminShell permissions={context.membership}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-brand">
            Operaciones
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Bandeja de tickets
          </h1>
          <p className="mt-2 text-sm text-muted">
            Filtra, asigna y abre cada reporte para gestionar su ciclo de vida.
          </p>
        </div>
        <span className="rounded-full bg-brand-soft px-4 py-2 text-sm font-medium text-brand">
          {tickets.length} resultados
        </span>
      </div>
      <div className="mt-6">
        <FormMessage error={query.error} />
      </div>

      <form
        className="mt-6 grid gap-3 rounded-xl border bg-surface p-4 shadow-sm sm:grid-cols-4"
        method="get"
      >
        <label className="text-xs font-medium text-muted">
          Estado
          <select
            className="mt-2 min-h-11 w-full rounded-md border bg-background px-3 text-sm text-ink"
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
        <label className="text-xs font-medium text-muted">
          Categoría
          <select
            className="mt-2 min-h-11 w-full rounded-md border bg-background px-3 text-sm text-ink"
            name="category"
            defaultValue={category ?? ""}
          >
            <option value="">Todas</option>
            {Object.values(TicketCategory).map((item) => (
              <option key={item} value={item}>
                {ticketCategoryLabels[item]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-muted">
          Responsable
          <select
            className="mt-2 min-h-11 w-full rounded-md border bg-background px-3 text-sm text-ink"
            name="assignee"
            defaultValue={query.assignee ?? ""}
          >
            <option value="">Todos</option>
            <option value="unassigned">Sin asignar</option>
            {staff.map((membership) => (
              <option key={membership.userId} value={membership.userId}>
                {membership.user.fullName ?? membership.user.email}
              </option>
            ))}
          </select>
        </label>
        <button className="flex min-h-11 items-center justify-center gap-2 self-end rounded-md bg-brand px-4 text-sm font-medium text-white">
          <Filter className="size-4" aria-hidden="true" /> Aplicar filtros
        </button>
      </form>

      <div className="mt-7 space-y-3">
        {tickets.length === 0 && (
          <div className="rounded-xl border bg-surface p-10 text-center">
            <Inbox className="mx-auto size-10 text-faint" aria-hidden="true" />
            <h2 className="mt-4 text-lg font-semibold">Bandeja vacía</h2>
            <p className="mt-2 text-sm text-muted">
              No hay tickets que coincidan con los filtros.
            </p>
          </div>
        )}
        {tickets.map((ticket) => (
          <article
            key={ticket.id}
            className="rounded-xl border bg-surface p-5 shadow-sm"
          >
            <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
              <Link href={`/admin/tickets/${ticket.id}`} className="group">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-mono text-sm text-brand">
                    {formatTicketNumber(ticket.number)}
                  </span>
                  <TicketStatusBadge status={ticket.status} />
                  <SlaBadge
                    dueAt={ticket.slaDueAt}
                    status={ticket.status}
                    resolvedAt={ticket.resolvedAt}
                  />
                </div>
                <h2 className="mt-3 text-lg font-semibold group-hover:text-brand">
                  {ticket.title}
                </h2>
                <p className="mt-2 text-sm text-muted">
                  {ticketCategoryLabels[ticket.category]} ·{" "}
                  {ticket.dwelling?.code ?? "Sin vivienda"} ·{" "}
                  {ticket.createdBy.fullName ?? ticket.createdBy.email}
                </p>
              </Link>
              <form
                action={assignTicketAction}
                className="flex flex-wrap items-end gap-2"
              >
                <input type="hidden" name="ticketId" value={ticket.id} />
                <label className="text-xs font-medium text-muted">
                  Asignación rápida
                  <select
                    className="mt-2 block min-h-11 min-w-48 rounded-md border bg-background px-3 text-sm text-ink"
                    name="assigneeId"
                    defaultValue={ticket.assigneeId ?? ""}
                    required
                  >
                    <option value="">Selecciona</option>
                    {staff.map((membership) => (
                      <option key={membership.userId} value={membership.userId}>
                        {membership.user.fullName ?? membership.user.email}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="flex min-h-11 items-center gap-2 rounded-md border px-4 text-sm font-medium">
                  <UserRoundCheck className="size-4" aria-hidden="true" />{" "}
                  Asignar
                </button>
              </form>
            </div>
          </article>
        ))}
      </div>
    </AdminShell>
  );
}

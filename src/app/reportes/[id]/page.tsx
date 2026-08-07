import { ArrowLeft, CheckCircle2, MessageCircle } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

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
import { addResidentTicketCommentAction } from "@/server/actions/tickets";

export default async function TicketDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; error?: string; message?: string }>;
}) {
  const [{ id }, query, context] = await Promise.all([
    params,
    searchParams,
    getAuthContext(),
  ]);
  if (!context?.user)
    redirect(`/login?next=/reportes/${encodeURIComponent(id)}`);
  if (!context.membership) redirect("/onboarding");

  const ticket = await db.ticket.findFirst({
    where: {
      id,
      tenantId: context.membership.tenantId,
      createdById: context.user.id,
    },
    include: {
      dwelling: true,
      assignee: true,
      activities: { include: { actor: true }, orderBy: { createdAt: "asc" } },
      comments: {
        where: { isInternal: false },
        include: { author: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!ticket) notFound();

  return (
    <ResidentShell active="reportes">
      <Link
        className="inline-flex min-h-11 items-center gap-2 text-sm text-brand"
        href="/reportes"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> Volver a mis
        reportes
      </Link>
      <div className="mt-4">
        {query.created && (
          <p
            className="mb-5 flex items-center gap-2 rounded-md border border-success/30 bg-success/10 p-4 text-sm text-success"
            role="status"
          >
            <CheckCircle2 className="size-5" aria-hidden="true" /> Reporte
            enviado · {formatTicketNumber(ticket.number)}
          </p>
        )}
        <FormMessage error={query.error} message={query.message} />
      </div>

      <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <article className="rounded-xl border bg-surface p-6 shadow-md sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono text-sm text-brand">
                {formatTicketNumber(ticket.number)}
              </p>
              <h1 className="mt-2 text-3xl font-semibold">{ticket.title}</h1>
              <p className="mt-2 text-sm text-muted">
                {ticketCategoryLabels[ticket.category]} ·{" "}
                {ticket.dwelling?.code}
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
          <p className="mt-7 whitespace-pre-wrap leading-7">
            {ticket.description}
          </p>
          {ticket.locationText && (
            <p className="mt-4 rounded-md bg-background p-3 text-sm text-muted">
              Ubicación: {ticket.locationText}
            </p>
          )}
          <dl className="mt-7 grid gap-4 border-t pt-6 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted">Responsable</dt>
              <dd className="mt-1 font-medium">
                {ticket.assignee?.fullName ?? "Por asignar"}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Creado</dt>
              <dd className="mt-1 font-medium">
                {ticket.createdAt.toLocaleString("es-GT")}
              </dd>
            </div>
          </dl>
        </article>

        <aside className="rounded-xl border bg-surface p-6 shadow-md sm:p-8">
          <h2 className="text-xl font-semibold">Historial</h2>
          <ol className="mt-6 space-y-5">
            {ticket.activities.map((activity) => (
              <li
                key={activity.id}
                className="relative border-l-2 border-brand-soft pl-5"
              >
                <span className="absolute -left-[5px] top-1 size-2 rounded-full bg-brand" />
                <p className="text-sm font-medium">
                  {activity.toStatus
                    ? ticketStatusLabels[activity.toStatus]
                    : (activity.note ?? "Actividad")}
                </p>
                {activity.note && activity.toStatus && (
                  <p className="mt-1 text-sm text-muted">{activity.note}</p>
                )}
                <p className="mt-1 text-xs text-faint">
                  {activity.actor?.fullName ?? "Sistema"} ·{" "}
                  {activity.createdAt.toLocaleString("es-GT")}
                </p>
              </li>
            ))}
          </ol>
        </aside>
      </section>

      <section className="mt-6 rounded-xl border bg-surface p-6 shadow-md sm:p-8">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <MessageCircle className="size-5 text-brand" aria-hidden="true" />{" "}
          Comentarios
        </h2>
        <div className="mt-5 space-y-3">
          {ticket.comments.length === 0 && (
            <p className="text-sm text-muted">
              Aún no hay comentarios visibles.
            </p>
          )}
          {ticket.comments.map((comment) => (
            <article key={comment.id} className="rounded-md bg-background p-4">
              <div className="flex flex-wrap justify-between gap-2 text-xs text-muted">
                <span className="font-medium text-ink">
                  {comment.author.fullName ?? comment.author.email}
                </span>
                <time>{comment.createdAt.toLocaleString("es-GT")}</time>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                {comment.body}
              </p>
            </article>
          ))}
        </div>
        <form action={addResidentTicketCommentAction} className="mt-6">
          <input type="hidden" name="ticketId" value={ticket.id} />
          <label className="block text-sm font-medium">
            Agregar comentario
            <textarea
              className="mt-2 min-h-24 w-full rounded-md border bg-background p-3"
              name="body"
              maxLength={2000}
              required
            />
          </label>
          <button className="mt-3 min-h-11 rounded-md bg-brand px-5 font-medium text-white">
            Enviar comentario
          </button>
        </form>
      </section>
    </ResidentShell>
  );
}

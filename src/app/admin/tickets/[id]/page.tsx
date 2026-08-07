import { AttachmentStatus, RoleName } from "@prisma/client";
import {
  ArrowLeft,
  Eye,
  ImageIcon,
  LockKeyhole,
  MessageSquareText,
} from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { FormMessage } from "@/components/form-message";
import { SlaBadge } from "@/components/tickets/sla-badge";
import { TicketStatusBadge } from "@/components/tickets/ticket-status-badge";
import {
  formatTicketNumber,
  ticketCategoryLabels,
  ticketStatusLabels,
} from "@/config/tickets";
import {
  attachmentStatusLabels,
  moderationStatusLabels,
} from "@/config/attachments";
import { getAuthContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import {
  addAdminTicketCommentAction,
  assignTicketAction,
  transitionTicketAction,
} from "@/server/actions/tickets";
import { availableTicketTransitions } from "@/server/services/ticket-state-machine";
import { createAttachmentViewUrl } from "@/server/services/attachment-storage";

export default async function AdminTicketDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const [{ id }, query, context] = await Promise.all([
    params,
    searchParams,
    getAuthContext(),
  ]);
  if (!context?.user)
    redirect(`/login?next=/admin/tickets/${encodeURIComponent(id)}`);
  if (!context.membership || !can(context.membership, "triage", "ticket"))
    redirect("/inicio?denied=1");

  const [ticket, memberships] = await Promise.all([
    db.ticket.findFirst({
      where: { id, tenantId: context.membership.tenantId },
      include: {
        createdBy: true,
        assignee: true,
        dwelling: true,
        activities: { include: { actor: true }, orderBy: { createdAt: "asc" } },
        comments: { include: { author: true }, orderBy: { createdAt: "asc" } },
        attachments: { include: { moderation: true } },
      },
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
  if (!ticket) notFound();
  const now = new Date();
  const staff = memberships.filter((membership) =>
    membership.roles.some(
      ({ role, expiresAt }) =>
        role !== RoleName.RESIDENTE && (!expiresAt || expiresAt > now),
    ),
  );
  const transitions = availableTicketTransitions(ticket.status);
  const ticketImages = await Promise.all(
    ticket.attachments.map(async (attachment) => ({
      ...attachment,
      imageUrl:
        attachment.status === AttachmentStatus.LISTO && attachment.storageKey
          ? await createAttachmentViewUrl(attachment.storageKey).catch(
              () => null,
            )
          : null,
    })),
  );

  return (
    <AdminShell permissions={context.membership}>
      <Link
        className="inline-flex min-h-11 items-center gap-2 text-sm text-brand"
        href="/admin/tickets"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> Volver a la bandeja
      </Link>
      <div className="mt-4">
        <FormMessage error={query.error} message={query.message} />
      </div>

      <div className="mt-4 grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <article className="rounded-xl border bg-surface p-6 shadow-md sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-mono text-sm text-brand">
                  {formatTicketNumber(ticket.number)}
                </p>
                <h1 className="mt-2 text-3xl font-semibold">{ticket.title}</h1>
                <p className="mt-2 text-sm text-muted">
                  {ticketCategoryLabels[ticket.category]} ·{" "}
                  {ticket.dwelling?.code ?? "Sin vivienda"} ·{" "}
                  {ticket.createdBy.fullName ?? ticket.createdBy.email}
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
          </article>

          {ticketImages.length > 0 && (
            <section className="rounded-xl border bg-surface p-6 shadow-md sm:p-8">
              <h2 className="flex items-center gap-2 text-xl font-semibold">
                <ImageIcon className="size-5 text-brand" aria-hidden="true" />{" "}
                Imagen adjunta
              </h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {ticketImages.map((attachment) => (
                  <article
                    key={attachment.id}
                    className="rounded-lg border bg-background p-3"
                  >
                    {attachment.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        className="max-h-80 w-full rounded-md object-contain"
                        src={attachment.imageUrl}
                        alt={`Imagen del reporte ${formatTicketNumber(ticket.number)}`}
                      />
                    ) : (
                      <div className="grid min-h-40 place-items-center text-sm text-muted">
                        Imagen en procesamiento
                      </div>
                    )}
                    <p className="mt-3 text-xs font-medium text-muted">
                      Estado:{" "}
                      {attachment.moderation
                        ? moderationStatusLabels[attachment.moderation.status]
                        : attachmentStatusLabels[attachment.status]}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-xl border bg-surface p-6 shadow-md sm:p-8">
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <MessageSquareText
                className="size-5 text-brand"
                aria-hidden="true"
              />{" "}
              Conversación y notas
            </h2>
            <div className="mt-5 space-y-3">
              {ticket.comments.length === 0 && (
                <p className="text-sm text-muted">
                  Aún no hay comentarios ni notas.
                </p>
              )}
              {ticket.comments.map((comment) => (
                <article
                  key={comment.id}
                  className={`rounded-md border p-4 ${comment.isInternal ? "border-warning/30 bg-warning/5" : "bg-background"}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                    <span className="font-medium text-ink">
                      {comment.author.fullName ?? comment.author.email}
                    </span>
                    <span className="inline-flex items-center gap-1 font-medium">
                      {comment.isInternal ? (
                        <>
                          <LockKeyhole className="size-3" aria-hidden="true" />{" "}
                          Nota interna
                        </>
                      ) : (
                        <>
                          <Eye className="size-3" aria-hidden="true" /> Visible
                          al residente
                        </>
                      )}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                    {comment.body}
                  </p>
                </article>
              ))}
            </div>
            <form
              action={addAdminTicketCommentAction}
              className="mt-6 space-y-4"
            >
              <input type="hidden" name="ticketId" value={ticket.id} />
              <label className="block text-sm font-medium">
                Mensaje
                <textarea
                  className="mt-2 min-h-24 w-full rounded-md border bg-background p-3"
                  name="body"
                  maxLength={2000}
                  required
                />
              </label>
              <div className="flex flex-wrap items-end gap-3">
                <label className="text-sm font-medium">
                  Visibilidad
                  <select
                    className="mt-2 block min-h-11 rounded-md border bg-background px-3"
                    name="visibility"
                    defaultValue="public"
                  >
                    <option value="public">Visible al residente</option>
                    <option value="internal">Nota interna</option>
                  </select>
                </label>
                <button className="min-h-11 rounded-md bg-brand px-5 font-medium text-white">
                  Guardar mensaje
                </button>
              </div>
            </form>
          </section>

          <section className="rounded-xl border bg-surface p-6 shadow-md sm:p-8">
            <h2 className="text-xl font-semibold">Historial completo</h2>
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
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-xl border bg-surface p-5 shadow-sm">
            <h2 className="font-semibold">Responsable</h2>
            <p className="mt-2 text-sm text-muted">
              Actual: {ticket.assignee?.fullName ?? "Sin asignar"}
            </p>
            <form action={assignTicketAction} className="mt-4 space-y-3">
              <input type="hidden" name="ticketId" value={ticket.id} />
              <select
                className="min-h-11 w-full rounded-md border bg-background px-3 text-sm"
                name="assigneeId"
                aria-label="Responsable"
                defaultValue={ticket.assigneeId ?? ""}
                required
              >
                <option value="">Selecciona responsable</option>
                {staff.map((membership) => (
                  <option key={membership.userId} value={membership.userId}>
                    {membership.user.fullName ?? membership.user.email}
                  </option>
                ))}
              </select>
              <button className="min-h-11 w-full rounded-md border px-4 text-sm font-medium">
                Asignar
              </button>
            </form>
          </section>

          <section className="rounded-xl border bg-surface p-5 shadow-sm">
            <h2 className="font-semibold">Cambiar estado</h2>
            {transitions.length === 0 ? (
              <p className="mt-3 text-sm text-muted">
                No hay transiciones disponibles.
              </p>
            ) : (
              <form action={transitionTicketAction} className="mt-4 space-y-3">
                <input type="hidden" name="ticketId" value={ticket.id} />
                <select
                  className="min-h-11 w-full rounded-md border bg-background px-3 text-sm"
                  name="toStatus"
                  aria-label="Nuevo estado"
                  required
                >
                  <option value="">Selecciona estado</option>
                  {transitions.map((status) => (
                    <option key={status} value={status}>
                      {ticketStatusLabels[status]}
                    </option>
                  ))}
                </select>
                <label className="block text-xs font-medium text-muted">
                  Nota del cambio (opcional)
                  <textarea
                    className="mt-2 min-h-20 w-full rounded-md border bg-background p-3 text-sm text-ink"
                    name="note"
                    maxLength={500}
                  />
                </label>
                <button className="min-h-11 w-full rounded-md bg-brand px-4 text-sm font-medium text-white">
                  Actualizar estado
                </button>
              </form>
            )}
          </section>

          <section className="rounded-xl border bg-surface p-5 text-sm shadow-sm">
            <h2 className="font-semibold">Tiempos</h2>
            <dl className="mt-3 space-y-3 text-muted">
              <div>
                <dt>Creado</dt>
                <dd className="text-ink">
                  {ticket.createdAt.toLocaleString("es-GT")}
                </dd>
              </div>
              <div>
                <dt>Primer acuse</dt>
                <dd className="text-ink">
                  {ticket.ackAt?.toLocaleString("es-GT") ?? "Pendiente"}
                </dd>
              </div>
              <div>
                <dt>Fecha límite</dt>
                <dd className="text-ink">
                  {ticket.slaDueAt?.toLocaleString("es-GT") ?? "Sin SLA"}
                </dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </AdminShell>
  );
}

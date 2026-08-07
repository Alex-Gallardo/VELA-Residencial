import { AttachmentStatus, ModerationStatus } from "@prisma/client";
import {
  AlertTriangle,
  CheckCircle2,
  ImageOff,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { FormMessage } from "@/components/form-message";
import { formatTicketNumber } from "@/config/tickets";
import { getAuthContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { retryAttachmentProcessingAction } from "@/server/actions/attachments";
import { reviewModerationAction } from "@/server/actions/moderation";
import { createAttachmentViewUrl } from "@/server/services/attachment-storage";

export default async function ModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const [query, context] = await Promise.all([searchParams, getAuthContext()]);
  if (!context?.user) redirect("/login?next=/admin/moderacion");
  if (!context.membership || !can(context.membership, "read", "moderation"))
    redirect("/inicio?denied=1");

  const [pendingItems, recentItems, failedAttachments] = await Promise.all([
    db.moderationItem.findMany({
      where: {
        tenantId: context.membership.tenantId,
        status: ModerationStatus.EN_REVISION_HUMANA,
        attachment: {
          status: AttachmentStatus.LISTO,
          ticketId: { not: null },
        },
      },
      include: {
        attachment: {
          include: {
            ticket: { include: { createdBy: true, dwelling: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.moderationItem.findMany({
      where: {
        tenantId: context.membership.tenantId,
        status: { in: [ModerationStatus.APROBADO, ModerationStatus.RECHAZADO] },
        reviewedAt: { not: null },
      },
      include: {
        reviewedBy: true,
        attachment: { include: { ticket: true } },
      },
      orderBy: { reviewedAt: "desc" },
      take: 10,
    }),
    db.attachment.findMany({
      where: {
        tenantId: context.membership.tenantId,
        status: AttachmentStatus.FALLIDO,
        ticketId: { not: null },
      },
      include: { ticket: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const queue = await Promise.all(
    pendingItems.map(async (item) => ({
      ...item,
      imageUrl: item.attachment.storageKey
        ? await createAttachmentViewUrl(item.attachment.storageKey).catch(
            () => null,
          )
        : null,
    })),
  );

  return (
    <AdminShell permissions={context.membership}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-brand">
            Seguridad de contenido
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Cola de moderación
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Las imágenes ya fueron normalizadas y sus metadatos eliminados. El
            proveedor automático queda pendiente; por ahora toda decisión es
            humana, obligatoria y auditada.
          </p>
        </div>
        <span className="rounded-full border bg-surface px-4 py-2 text-sm font-medium">
          {queue.length} pendiente{queue.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="mt-5">
        <FormMessage error={query.error} message={query.message} />
      </div>

      {queue.length === 0 ? (
        <section className="mt-7 rounded-xl border bg-surface p-10 text-center shadow-sm">
          <ShieldCheck
            className="mx-auto size-10 text-success"
            aria-hidden="true"
          />
          <h2 className="mt-4 text-xl font-semibold">Cola al día</h2>
          <p className="mt-2 text-sm text-muted">
            No hay imágenes esperando una decisión humana.
          </p>
        </section>
      ) : (
        <section className="mt-7 grid gap-6 xl:grid-cols-2">
          {queue.map((item) => {
            const ticket = item.attachment.ticket;
            if (!ticket) return null;
            return (
              <article
                key={item.id}
                className="overflow-hidden rounded-xl border bg-surface shadow-md"
              >
                <div className="grid min-h-64 place-items-center bg-ink/5">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      className="max-h-[28rem] w-full object-contain"
                      src={item.imageUrl}
                      alt={`Imagen pendiente del reporte ${formatTicketNumber(ticket.number)}`}
                    />
                  ) : (
                    <ImageOff
                      className="size-12 text-faint"
                      aria-hidden="true"
                    />
                  )}
                </div>
                <div className="p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Link
                        className="font-mono text-sm text-brand hover:underline"
                        href={`/admin/tickets/${ticket.id}`}
                      >
                        {formatTicketNumber(ticket.number)}
                      </Link>
                      <h2 className="mt-1 text-xl font-semibold">
                        {ticket.title}
                      </h2>
                      <p className="mt-1 text-xs text-muted">
                        {ticket.dwelling?.code ?? "Sin vivienda"} ·{" "}
                        {ticket.createdBy.fullName ?? ticket.createdBy.email}
                      </p>
                    </div>
                    <span className="rounded-full bg-warning/10 px-3 py-1 text-xs font-medium text-warning">
                      Revisión humana
                    </span>
                  </div>
                  <form action={reviewModerationAction} className="mt-5">
                    <input type="hidden" name="moderationId" value={item.id} />
                    <label className="block text-sm font-medium">
                      Motivo de la decisión
                      <textarea
                        className="mt-2 min-h-20 w-full rounded-md border bg-background p-3"
                        name="reason"
                        minLength={3}
                        maxLength={300}
                        placeholder="Describe brevemente el criterio aplicado."
                        required
                      />
                    </label>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <button
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-success px-4 font-medium text-white"
                        name="decision"
                        value="APROBADO"
                      >
                        <CheckCircle2 className="size-4" aria-hidden="true" />{" "}
                        Aprobar
                      </button>
                      <button
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-danger px-4 font-medium text-white"
                        name="decision"
                        value="RECHAZADO"
                      >
                        <AlertTriangle className="size-4" aria-hidden="true" />{" "}
                        Rechazar
                      </button>
                    </div>
                  </form>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {failedAttachments.length > 0 && (
        <section className="mt-8 rounded-xl border border-danger/30 bg-danger/5 p-6">
          <h2 className="font-semibold">
            Procesamiento pendiente de reintento
          </h2>
          <div className="mt-4 space-y-3">
            {failedAttachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-surface p-3 text-sm"
              >
                <span>
                  {attachment.ticket
                    ? `${formatTicketNumber(attachment.ticket.number)} · ${attachment.ticket.title}`
                    : attachment.originalName}
                  <span className="ml-2 text-muted">
                    {attachment.failureReason ?? "Error transitorio"}
                  </span>
                </span>
                <form action={retryAttachmentProcessingAction}>
                  <input
                    type="hidden"
                    name="attachmentId"
                    value={attachment.id}
                  />
                  <button className="min-h-11 rounded-md border bg-surface px-4 font-medium">
                    Reintentar
                  </button>
                </form>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8 rounded-xl border bg-surface p-6 shadow-sm">
        <h2 className="font-semibold">Decisiones recientes</h2>
        {recentItems.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            Aún no hay decisiones humanas.
          </p>
        ) : (
          <ul className="mt-4 divide-y text-sm">
            {recentItems.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap justify-between gap-3 py-3"
              >
                <span>
                  {item.attachment.ticket
                    ? formatTicketNumber(item.attachment.ticket.number)
                    : "Sin reporte"}{" "}
                  · {item.decisionReason}
                </span>
                <span className="text-muted">
                  {item.status === ModerationStatus.APROBADO
                    ? "Aprobada"
                    : "Rechazada"}{" "}
                  ·{" "}
                  {item.reviewedBy?.fullName ??
                    item.reviewedBy?.email ??
                    "Sistema"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AdminShell>
  );
}

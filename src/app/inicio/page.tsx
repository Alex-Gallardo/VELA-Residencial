import {
  AlertTriangle,
  ArrowRight,
  BookOpenText,
  ClipboardList,
  Megaphone,
  PlusCircle,
  ShieldCheck,
} from "lucide-react";
import { NoticeType } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ResidentShell } from "@/components/app/resident-shell";
import { FormMessage } from "@/components/form-message";
import { SlaBadge } from "@/components/tickets/sla-badge";
import { TicketStatusBadge } from "@/components/tickets/ticket-status-badge";
import { formatTicketNumber, openTicketStatuses } from "@/config/tickets";
import { getAuthContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; denied?: string }>;
}) {
  const [context, query] = await Promise.all([getAuthContext(), searchParams]);
  if (!context?.user) redirect("/login?next=/inicio");
  if (!context.membership) redirect("/onboarding");
  const roles = context.membership.roles.map(({ role }) =>
    role.replaceAll("_", " "),
  );
  const now = new Date();
  const [openTickets, noticeReceipts] = await Promise.all([
    db.ticket.findMany({
      where: {
        tenantId: context.membership.tenantId,
        createdById: context.user.id,
        status: { in: openTicketStatuses },
      },
      orderBy: { updatedAt: "desc" },
      take: 3,
    }),
    db.noticeReceipt.findMany({
      where: {
        tenantId: context.membership.tenantId,
        userId: context.user.id,
        notice: {
          deliveredAt: { not: null },
          publishedAt: { lte: now },
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
      },
      include: { notice: true },
      orderBy: { notice: { publishedAt: "desc" } },
      take: 3,
    }),
  ]);
  const criticalNotice = noticeReceipts.find(
    ({ notice }) => notice.type === NoticeType.ALERTA_CRITICA,
  );

  return (
    <ResidentShell active="inicio">
      <FormMessage
        message={query.message}
        error={
          query.denied ? "No tienes permiso para abrir esa sección." : undefined
        }
      />
      {criticalNotice && (
        <Link
          className="mb-7 flex items-start gap-3 rounded-xl border border-danger/40 bg-danger/10 p-5 text-danger shadow-sm"
          href={`/avisos/${criticalNotice.notice.id}`}
        >
          <AlertTriangle
            className="mt-0.5 size-5 shrink-0"
            aria-hidden="true"
          />
          <span>
            <strong className="block">{criticalNotice.notice.title}</strong>
            <span className="mt-1 block text-sm">
              {criticalNotice.notice.body}
            </span>
          </span>
        </Link>
      )}
      <section className="rounded-xl border bg-surface p-7 shadow-md sm:p-10">
        <span className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-4 py-2 text-sm font-medium text-brand">
          <ShieldCheck className="size-4" aria-hidden="true" /> Acceso protegido
        </span>
        <h1 className="mt-6 text-3xl font-semibold sm:text-4xl">
          Hola, {context.user.fullName ?? context.user.email}
        </h1>
        <p className="mt-3 text-muted">{context.membership.tenant.name}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          {roles.map((role) => (
            <span
              key={role}
              className="rounded-full border px-3 py-1 text-xs font-medium"
            >
              {role}
            </span>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          {can(context.membership, "create", "ticket") && (
            <Link
              className="inline-flex min-h-11 items-center gap-2 rounded-md bg-brand px-5 font-medium text-white"
              href="/reportes/nuevo"
            >
              <PlusCircle className="size-4" aria-hidden="true" /> Crear reporte
            </Link>
          )}
          {can(context.membership, "read", "document") && (
            <Link
              className="inline-flex min-h-11 items-center gap-2 rounded-md border px-5 font-medium"
              href="/reglamento"
            >
              <BookOpenText className="size-4" aria-hidden="true" /> Reglamento
            </Link>
          )}
          {can(context.membership, "read", "ticket") &&
            context.membership.roles.some(
              ({ role, expiresAt }) =>
                role !== "RESIDENTE" && (!expiresAt || expiresAt > now),
            ) && (
              <Link
                className="inline-flex min-h-11 items-center gap-2 rounded-md border px-5 font-medium"
                href="/admin"
              >
                Dashboard operativo
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            )}
          {can(context.membership, "triage", "ticket") && (
            <Link
              className="inline-flex min-h-11 items-center gap-2 rounded-md border px-5 font-medium"
              href="/admin/tickets"
            >
              Bandeja administrativa{" "}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          )}
          {can(context.membership, "invite", "invitation") && (
            <Link
              className="inline-flex min-h-11 items-center rounded-md border px-5 font-medium"
              href="/admin/invitaciones"
            >
              Invitaciones
            </Link>
          )}
          {can(context.membership, "create", "notice") && (
            <Link
              className="inline-flex min-h-11 items-center rounded-md border px-5 font-medium"
              href="/admin/avisos"
            >
              Gestionar avisos
            </Link>
          )}
        </div>
      </section>

      <section className="mt-7 rounded-xl border bg-surface p-6 shadow-sm sm:p-8">
        <div className="flex items-center justify-between gap-4">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <Megaphone className="size-5 text-brand" aria-hidden="true" />{" "}
            Avisos recientes
          </h2>
          <Link className="text-sm font-medium text-brand" href="/avisos">
            Ver todos
          </Link>
        </div>
        <div className="mt-5 space-y-3">
          {noticeReceipts.length === 0 && (
            <p className="rounded-md bg-background p-5 text-sm text-muted">
              No hay avisos vigentes para tu audiencia.
            </p>
          )}
          {noticeReceipts.map(({ notice, readAt }) => (
            <Link
              key={notice.id}
              className="flex items-start justify-between gap-4 rounded-md border p-4 hover:border-brand"
              href={`/avisos/${notice.id}`}
            >
              <span>
                <strong className="block">{notice.title}</strong>
                <span className="mt-1 line-clamp-1 text-sm text-muted">
                  {notice.body}
                </span>
              </span>
              {!readAt && (
                <span className="shrink-0 rounded-full bg-brand-soft px-2 py-1 text-xs text-brand">
                  Nuevo
                </span>
              )}
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-7 rounded-xl border bg-surface p-6 shadow-sm sm:p-8">
        <div className="flex items-center justify-between gap-4">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <ClipboardList className="size-5 text-brand" aria-hidden="true" />{" "}
            Mis reportes abiertos
          </h2>
          <Link className="text-sm font-medium text-brand" href="/reportes">
            Ver todos
          </Link>
        </div>
        <div className="mt-5 space-y-3">
          {openTickets.length === 0 && (
            <p className="rounded-md bg-background p-5 text-sm text-muted">
              No tienes reportes abiertos.
            </p>
          )}
          {openTickets.map((ticket) => (
            <Link
              key={ticket.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-4 hover:border-brand"
              href={`/reportes/${ticket.id}`}
            >
              <div>
                <p className="font-mono text-xs text-brand">
                  {formatTicketNumber(ticket.number)}
                </p>
                <p className="mt-1 font-medium">{ticket.title}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <TicketStatusBadge status={ticket.status} />
                <SlaBadge
                  dueAt={ticket.slaDueAt}
                  status={ticket.status}
                  resolvedAt={ticket.resolvedAt}
                />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </ResidentShell>
  );
}

import { TicketStatus } from "@prisma/client";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Gauge,
  Images,
  Megaphone,
  TimerReset,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { TicketStatusBadge } from "@/components/tickets/ticket-status-badge";
import { ticketCategoryLabels, ticketStatusLabels } from "@/config/tickets";
import { getAuthContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { activeRoles } from "@/lib/permissions";
import { getDashboardMetrics } from "@/server/services/dashboard-service";
import { formatSla } from "@/server/services/sla-service";

const STATUS_COLORS: Record<TicketStatus, string> = {
  BORRADOR: "#9aa3af",
  ENVIADO: "#3a7bd5",
  EN_REVISION: "#5b8def",
  PENDIENTE_INFO: "#e0a030",
  ASIGNADO: "#f4a93b",
  EN_PROCESO: "#c88720",
  RESUELTO: "#2e9e6b",
  CERRADO: "#5b6573",
  DUPLICADO: "#8a93a0",
  RECHAZADO: "#d64545",
  ESCALADO: "#b52e2e",
  REABIERTO: "#9b6bdb",
};

function hoursLabel(value: number | null) {
  if (value === null) return "Sin datos";
  if (value < 1) return `${Math.round(value * 60)} min`;
  if (value < 24) return `${value.toFixed(1)} h`;
  return `${(value / 24).toFixed(1)} días`;
}

function StatusDonut({
  values,
  total,
}: {
  values: Record<TicketStatus, number>;
  total: number;
}) {
  let cursor = 0;
  const segments = Object.entries(values)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => {
      const start = cursor;
      cursor += total ? (count / total) * 360 : 0;
      return `${STATUS_COLORS[status as TicketStatus]} ${start}deg ${cursor}deg`;
    });
  return (
    <div
      className="relative grid size-44 shrink-0 place-items-center rounded-full"
      style={{
        background: total
          ? `conic-gradient(${segments.join(",")})`
          : "var(--color-border)",
      }}
      role="img"
      aria-label={`${total} tickets distribuidos por estado`}
    >
      <div className="grid size-28 place-items-center rounded-full bg-surface text-center shadow-sm">
        <span className="font-mono text-3xl font-semibold">{total}</span>
        <span className="text-xs text-muted">tickets</span>
      </div>
    </div>
  );
}

export default async function AdminDashboardPage() {
  const context = await getAuthContext();
  if (!context?.user) redirect("/login?next=/admin");
  if (
    !context.membership ||
    activeRoles(context.membership).every((role) => role === "RESIDENTE")
  )
    redirect("/inicio?denied=1");
  const metrics = await getDashboardMetrics(db, context.membership.tenantId);
  const visibleStatuses = Object.entries(metrics.ticketsByStatus).filter(
    ([, count]) => count > 0,
  );
  const maxCategory = Math.max(
    1,
    ...metrics.ticketsByCategory.map(({ count }) => count),
  );

  return (
    <AdminShell permissions={context.membership}>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-brand">
            Operación en vivo
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Dashboard
          </h1>
          <p className="mt-2 text-sm text-muted">
            {context.membership.tenant.name} · datos actualizados al cargar
          </p>
        </div>
        <Link
          className="inline-flex min-h-11 items-center rounded-md bg-brand px-5 text-sm font-semibold text-white"
          href="/admin/tickets"
        >
          Ver bandeja de tickets
        </Link>
      </header>

      <section
        aria-label="Indicadores principales"
        className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {[
          {
            label: "Primera respuesta",
            value: hoursLabel(metrics.firstResponseHours),
            hint: "Meta: menos de 4 h",
            icon: Clock3,
          },
          {
            label: "Resolución media",
            value: hoursLabel(metrics.resolutionHours),
            hint: "Tickets resueltos",
            icon: TimerReset,
          },
          {
            label: "SLA cumplido",
            value: `${metrics.slaCompliance}%`,
            hint: "Meta inicial: 85%",
            icon: CheckCircle2,
          },
          {
            label: "Avisos críticos leídos",
            value: `${metrics.criticalReadRate}%`,
            hint: `${metrics.criticalReceiptTotal} entregas críticas`,
            icon: Megaphone,
          },
        ].map(({ label, value, hint, icon: Icon }) => (
          <article
            key={label}
            className="rounded-xl border bg-surface p-5 shadow-sm"
          >
            <Icon className="size-5 text-brand" aria-hidden="true" />
            <p className="mt-4 text-sm text-muted">{label}</p>
            <p className="mt-1 font-mono text-3xl font-semibold">{value}</p>
            <p className="mt-2 text-xs text-faint">{hint}</p>
          </article>
        ))}
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="rounded-xl border bg-surface p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Tickets por estado</h2>
          <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            <StatusDonut
              values={metrics.ticketsByStatus}
              total={metrics.ticketTotal}
            />
            <ul className="grid flex-1 gap-2 text-sm sm:grid-cols-2">
              {visibleStatuses.length === 0 && (
                <li className="text-muted">Aún no hay tickets.</li>
              )}
              {visibleStatuses.map(([status, count]) => (
                <li
                  key={status}
                  className="flex items-center justify-between gap-3 rounded-md bg-background px-3 py-2"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="size-3 rounded-full"
                      style={{
                        background: STATUS_COLORS[status as TicketStatus],
                      }}
                      aria-hidden="true"
                    />
                    {ticketStatusLabels[status as TicketStatus]}
                  </span>
                  <strong className="font-mono">{count}</strong>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="rounded-xl border bg-surface p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">SLA en riesgo</h2>
            <span className="rounded-full bg-danger/10 px-3 py-1 text-xs font-semibold text-danger">
              {metrics.slaRisk.length}
            </span>
          </div>
          <div className="mt-5 space-y-3">
            {metrics.slaRisk.length === 0 && (
              <p className="rounded-md bg-background p-5 text-sm text-muted">
                No hay tickets vencidos o próximos a vencer.
              </p>
            )}
            {metrics.slaRisk.map((ticket) => (
              <Link
                key={ticket.id}
                className="block rounded-md border p-4 transition-colors hover:bg-background"
                href={`/admin/tickets/${ticket.id}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong>
                    #{String(ticket.number).padStart(4, "0")} · {ticket.title}
                  </strong>
                  <TicketStatusBadge status={ticket.status} />
                </div>
                <p className="mt-2 flex items-center gap-2 text-xs text-danger">
                  <AlertTriangle className="size-4" aria-hidden="true" />
                  {formatSla(ticket.slaDueAt)}
                </p>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-xl border bg-surface p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Tickets por categoría</h2>
          <div className="mt-5 space-y-4">
            {metrics.ticketsByCategory.length === 0 && (
              <p className="text-sm text-muted">
                Aún no hay datos por categoría.
              </p>
            )}
            {metrics.ticketsByCategory.map(({ category, count }) => (
              <div key={category}>
                <div className="flex justify-between gap-3 text-sm">
                  <span>
                    {
                      ticketCategoryLabels[
                        category as keyof typeof ticketCategoryLabels
                      ]
                    }
                  </span>
                  <strong className="font-mono">{count}</strong>
                </div>
                <div className="mt-2 h-3 overflow-hidden rounded-full bg-background">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{
                      width: `${Math.max(4, (count / maxCategory) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-md bg-background p-4">
              <Gauge className="size-5 text-brand" aria-hidden="true" />
              <p className="mt-2 text-xs text-muted">Duplicados consolidados</p>
              <p className="font-mono text-xl font-semibold">
                {metrics.duplicateRate}%
              </p>
            </div>
            <div className="rounded-md bg-background p-4">
              <Images className="size-5 text-brand" aria-hidden="true" />
              <p className="mt-2 text-xs text-muted">Cola de moderación</p>
              <p className="font-mono text-xl font-semibold">
                {metrics.moderationPending}
              </p>
            </div>
            <div className="rounded-md bg-background p-4">
              <UsersRoundIcon />
              <p className="mt-2 text-xs text-muted">Invitaciones aceptadas</p>
              <p className="font-mono text-xl font-semibold">
                {metrics.invitationAcceptance}%
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-xl border bg-surface p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Actividad reciente</h2>
          <ol className="mt-5 space-y-4">
            {metrics.activity.length === 0 && (
              <li className="text-sm text-muted">Aún no hay actividad.</li>
            )}
            {metrics.activity.map((item) => (
              <li key={item.id} className="border-l-2 border-brand-soft pl-4">
                <p className="text-sm font-medium">
                  {item.action.replaceAll("_", " ")}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {item.actor?.fullName ?? item.actor?.email ?? "Sistema"} ·{" "}
                  {item.createdAt.toLocaleString("es-GT")}
                </p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </AdminShell>
  );
}

function UsersRoundIcon() {
  return (
    <svg
      className="size-5 text-brand"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

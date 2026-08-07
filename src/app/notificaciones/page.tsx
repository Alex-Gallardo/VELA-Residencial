import { NotificationType } from "@prisma/client";
import { Bell, CheckCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ResidentShell } from "@/components/app/resident-shell";
import { FormMessage } from "@/components/form-message";
import { getAuthContext } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  markAllNotificationsReadAction,
  markNotificationAction,
} from "@/server/actions/notifications";

const typeLabels: Record<NotificationType, string> = {
  AVISO: "Avisos",
  ALERTA: "Alertas",
  TICKET_UPDATE: "Reportes",
  PAGO: "Pagos",
  MENSAJE_DIRECTO: "Mensajes",
  ENCUESTA: "Encuestas",
  SEGURIDAD_CUENTA: "Seguridad",
};

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; page?: string; error?: string }>;
}) {
  const [context, query] = await Promise.all([getAuthContext(), searchParams]);
  if (!context?.user) redirect("/login?next=/notificaciones");
  if (!context.membership) redirect("/onboarding");
  const type = Object.values(NotificationType).includes(
    query.type as NotificationType,
  )
    ? (query.type as NotificationType)
    : undefined;
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const pageSize = 25;
  const where = {
    tenantId: context.membership.tenantId,
    userId: context.user.id,
    channel: "IN_APP" as const,
    ...(type ? { type } : {}),
  };
  const [notifications, total, unread] = await Promise.all([
    db.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.notification.count({ where }),
    db.notification.count({ where: { ...where, readAt: null } }),
  ]);

  return (
    <ResidentShell active="notificaciones">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-brand">
            Actualizaciones
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Notificaciones
          </h1>
          <p className="mt-2 text-sm text-muted">{unread} sin leer</p>
        </div>
        {unread > 0 && (
          <form action={markAllNotificationsReadAction}>
            <button className="inline-flex min-h-11 items-center gap-2 rounded-md border bg-surface px-4 text-sm font-medium">
              <CheckCheck className="size-4" aria-hidden="true" /> Marcar todas
            </button>
          </form>
        )}
      </div>
      <div className="mt-5">
        <FormMessage error={query.error} />
      </div>
      <form className="mt-6 flex flex-wrap items-end gap-3" method="get">
        <label className="text-sm font-medium">
          Tipo
          <select
            className="mt-2 block min-h-11 rounded-md border bg-surface px-3"
            name="type"
            defaultValue={type ?? ""}
          >
            <option value="">Todos</option>
            {Object.values(NotificationType).map((value) => (
              <option key={value} value={value}>
                {typeLabels[value]}
              </option>
            ))}
          </select>
        </label>
        <button className="min-h-11 rounded-md border bg-surface px-4 text-sm font-medium">
          Filtrar
        </button>
      </form>

      <div className="mt-7 space-y-3">
        {notifications.length === 0 && (
          <section className="rounded-xl border bg-surface p-10 text-center">
            <Bell className="mx-auto size-10 text-faint" aria-hidden="true" />
            <h2 className="mt-4 text-lg font-semibold">Sin notificaciones</h2>
          </section>
        )}
        {notifications.map((notification) => (
          <article
            key={notification.id}
            className={`rounded-xl border bg-surface p-5 shadow-sm ${
              notification.readAt ? "opacity-75" : "border-brand/40"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-brand">
                  {typeLabels[notification.type]}
                </p>
                <h2 className="mt-1 font-semibold">{notification.title}</h2>
                <p className="mt-2 text-sm text-muted">{notification.body}</p>
                <p className="mt-2 text-xs text-faint">
                  {notification.createdAt.toLocaleString("es-GT")}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {notification.linkUrl && (
                  <Link
                    className="inline-flex min-h-11 items-center rounded-md bg-brand px-4 text-sm font-medium text-white"
                    href={notification.linkUrl}
                  >
                    Abrir
                  </Link>
                )}
                <form action={markNotificationAction}>
                  <input
                    type="hidden"
                    name="notificationId"
                    value={notification.id}
                  />
                  {notification.readAt && (
                    <input type="hidden" name="unread" value="1" />
                  )}
                  <button className="min-h-11 rounded-md border px-4 text-sm font-medium">
                    {notification.readAt ? "Marcar pendiente" : "Marcar leído"}
                  </button>
                </form>
              </div>
            </div>
          </article>
        ))}
      </div>
      {total > pageSize && (
        <nav className="mt-6 flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link
              href={`?${new URLSearchParams({ ...(type ? { type } : {}), page: String(page - 1) })}`}
            >
              Anterior
            </Link>
          ) : (
            <span />
          )}
          <span>
            Página {page} de {Math.ceil(total / pageSize)}
          </span>
          {page * pageSize < total && (
            <Link
              href={`?${new URLSearchParams({ ...(type ? { type } : {}), page: String(page + 1) })}`}
            >
              Siguiente
            </Link>
          )}
        </nav>
      )}
    </ResidentShell>
  );
}

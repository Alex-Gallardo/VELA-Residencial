import { ListChecks, Search } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { getAuthContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";

function validDate(value?: string, endOfDay = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(
    `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}-06:00`,
  );
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{
    action?: string;
    entity?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  const [context, query] = await Promise.all([getAuthContext(), searchParams]);
  if (!context?.user) redirect("/login?next=/admin/auditoria");
  if (!context.membership || !can(context.membership, "audit", "audit_log"))
    redirect("/inicio?denied=1");
  const action = query.action?.trim().slice(0, 100) || undefined;
  const entity = query.entity?.trim().slice(0, 100) || undefined;
  const from = validDate(query.from);
  const to = validDate(query.to, true);
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const pageSize = 40;
  const where = {
    tenantId: context.membership.tenantId,
    ...(action
      ? { action: { contains: action, mode: "insensitive" as const } }
      : {}),
    ...(entity ? { entity } : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
  };
  const [logs, total, entities] = await Promise.all([
    db.auditLog.findMany({
      where,
      include: { actor: { select: { fullName: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where: { tenantId: context.membership.tenantId },
      distinct: ["entity"],
      select: { entity: true },
      orderBy: { entity: "asc" },
    }),
  ]);
  const filterParams = {
    ...(action ? { action } : {}),
    ...(entity ? { entity } : {}),
    ...(query.from ? { from: query.from } : {}),
    ...(query.to ? { to: query.to } : {}),
  };

  return (
    <AdminShell permissions={context.membership}>
      <header>
        <p className="font-mono text-xs uppercase tracking-widest text-brand">
          Evidencia inmutable
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Auditoría</h1>
        <p className="mt-2 text-sm text-muted">
          Acciones sensibles del residencial con actor, fecha y contexto.
        </p>
      </header>
      <form
        className="mt-7 grid gap-3 rounded-xl border bg-surface p-5 shadow-sm md:grid-cols-5 md:items-end"
        method="get"
      >
        <label className="text-sm font-medium">
          Acción
          <input
            className="mt-2 min-h-11 w-full rounded-md border bg-background px-3"
            name="action"
            defaultValue={action}
            placeholder="ticket.status"
          />
        </label>
        <label className="text-sm font-medium">
          Entidad
          <select
            className="mt-2 min-h-11 w-full rounded-md border bg-background px-3"
            name="entity"
            defaultValue={entity ?? ""}
          >
            <option value="">Todas</option>
            {entities.map(({ entity: value }) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          Desde
          <input
            className="mt-2 min-h-11 w-full rounded-md border bg-background px-3"
            type="date"
            name="from"
            defaultValue={query.from}
          />
        </label>
        <label className="text-sm font-medium">
          Hasta
          <input
            className="mt-2 min-h-11 w-full rounded-md border bg-background px-3"
            type="date"
            name="to"
            defaultValue={query.to}
          />
        </label>
        <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-white">
          <Search className="size-4" aria-hidden="true" /> Filtrar
        </button>
      </form>

      <section
        className="mt-6 overflow-hidden rounded-xl border bg-surface shadow-sm"
        aria-label="Registro de auditoría"
      >
        <div className="flex items-center justify-between gap-3 border-b p-5">
          <h2 className="font-semibold">{total} eventos</h2>
          <span className="text-xs text-muted">
            Página {page} de {Math.max(1, Math.ceil(total / pageSize))}
          </span>
        </div>
        {logs.length === 0 && (
          <div className="p-10 text-center">
            <ListChecks
              className="mx-auto size-10 text-faint"
              aria-hidden="true"
            />
            <p className="mt-4 text-sm text-muted">
              No hay eventos con esos filtros.
            </p>
          </div>
        )}
        <div className="divide-y">
          {logs.map((log) => (
            <article
              key={log.id}
              className="grid gap-3 p-5 md:grid-cols-[1fr_0.8fr_0.8fr]"
            >
              <div>
                <p className="font-mono text-sm font-semibold text-brand">
                  {log.action}
                </p>
                <p className="mt-1 text-sm">
                  {log.entity}
                  {log.entityId ? ` · ${log.entityId}` : ""}
                </p>
              </div>
              <div className="text-sm">
                <p>{log.actor?.fullName ?? log.actor?.email ?? "Sistema"}</p>
                <p className="mt-1 text-xs text-muted">
                  {log.ip ?? "IP no registrada"}
                </p>
              </div>
              <div className="text-sm md:text-right">
                <time dateTime={log.createdAt.toISOString()}>
                  {log.createdAt.toLocaleString("es-GT")}
                </time>
                {log.metadata && (
                  <details className="mt-2 text-left text-xs text-muted md:text-right">
                    <summary className="min-h-11 cursor-pointer py-3 text-brand">
                      Ver contexto
                    </summary>
                    <pre className="mt-1 max-h-48 overflow-auto rounded-md bg-background p-3 text-left font-mono text-[11px]">
                      {JSON.stringify(log.metadata, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
      {total > pageSize && (
        <nav
          className="mt-5 flex items-center justify-between text-sm"
          aria-label="Paginación de auditoría"
        >
          {page > 1 ? (
            <Link
              className="min-h-11 py-3 text-brand"
              href={`?${new URLSearchParams({ ...filterParams, page: String(page - 1) })}`}
            >
              Anterior
            </Link>
          ) : (
            <span />
          )}
          {page * pageSize < total && (
            <Link
              className="min-h-11 py-3 text-brand"
              href={`?${new URLSearchParams({ ...filterParams, page: String(page + 1) })}`}
            >
              Siguiente
            </Link>
          )}
        </nav>
      )}
    </AdminShell>
  );
}

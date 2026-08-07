import { RoleName } from "@prisma/client";
import { ShieldCheck, UserCog } from "lucide-react";
import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { ConfirmSubmitButton } from "@/components/admin/confirm-submit-button";
import { FormMessage } from "@/components/form-message";
import { getAuthContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import {
  grantMembershipRoleAction,
  revokeMembershipRoleAction,
  setMembershipActiveAction,
} from "@/server/actions/admin";

const roleLabels: Record<RoleName, string> = {
  ADMIN_GENERAL: "Administración general",
  OPERACIONES: "Operaciones",
  COMUNICACIONES: "Comunicaciones",
  FINANZAS: "Finanzas",
  MODERADOR: "Moderación",
  SEGURIDAD: "Seguridad",
  RESIDENTE: "Residente",
  SOPORTE_SISTEMA: "Soporte temporal",
};

export default async function UsersAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const [context, query] = await Promise.all([getAuthContext(), searchParams]);
  if (!context?.user) redirect("/login?next=/admin/usuarios");
  if (
    !context.membership ||
    !can(context.membership, "manage_roles", "membership")
  )
    redirect("/inicio?denied=1");
  const memberships = await db.membership.findMany({
    where: { tenantId: context.membership.tenantId },
    include: {
      user: {
        include: {
          householdMembers: {
            where: { tenantId: context.membership.tenantId, active: true },
            include: { household: { include: { dwelling: true } } },
          },
        },
      },
      roles: { orderBy: { role: "asc" } },
    },
    orderBy: [{ active: "desc" }, { createdAt: "asc" }],
  });
  const now = new Date();

  return (
    <AdminShell permissions={context.membership}>
      <header>
        <p className="font-mono text-xs uppercase tracking-widest text-brand">
          Acceso y permisos
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Usuarios y roles</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          Los roles permanentes se asignan sin fecha. Soporte de sistema exige
          una vigencia máxima de 24 horas y deja evidencia en auditoría.
        </p>
      </header>
      <div className="mt-5">
        <FormMessage error={query.error} message={query.message} />
      </div>

      <section className="mt-7 space-y-4" aria-label="Usuarios del residencial">
        {memberships.map((membership) => (
          <article
            key={membership.id}
            className={`rounded-xl border bg-surface p-5 shadow-sm sm:p-6 ${membership.active ? "" : "opacity-70"}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <UserCog className="size-5 text-brand" aria-hidden="true" />
                  <h2 className="text-lg font-semibold">
                    {membership.user.fullName ?? "Usuario sin nombre"}
                  </h2>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {membership.user.email}
                </p>
                <p className="mt-2 text-xs text-faint">
                  {membership.user.householdMembers
                    .map(({ household }) => household.dwelling.code)
                    .join(", ") || "Sin vivienda activa"}
                </p>
              </div>
              <form action={setMembershipActiveAction}>
                <input
                  type="hidden"
                  name="membershipId"
                  value={membership.id}
                />
                <input
                  type="hidden"
                  name="active"
                  value={membership.active ? "0" : "1"}
                />
                {membership.active ? (
                  <ConfirmSubmitButton
                    className="text-danger"
                    confirmation={`Desactivar el acceso de ${membership.user.email}?`}
                  >
                    Desactivar usuario
                  </ConfirmSubmitButton>
                ) : (
                  <button className="min-h-11 rounded-md border px-3 text-sm font-medium text-brand">
                    Reactivar usuario
                  </button>
                )}
              </form>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {membership.roles.length === 0 && (
                <span className="text-sm text-muted">Sin roles asignados.</span>
              )}
              {membership.roles.map((role) => {
                const expired = Boolean(
                  role.expiresAt && role.expiresAt <= now,
                );
                return (
                  <form key={role.id} action={revokeMembershipRoleAction}>
                    <input
                      type="hidden"
                      name="membershipId"
                      value={membership.id}
                    />
                    <input type="hidden" name="role" value={role.role} />
                    <ConfirmSubmitButton
                      className={
                        expired
                          ? "bg-background text-muted"
                          : "bg-brand-soft text-brand"
                      }
                      confirmation={`Revocar el rol ${roleLabels[role.role]} de ${membership.user.email}?`}
                      title="Revocar rol"
                    >
                      {roleLabels[role.role]}
                      {role.expiresAt
                        ? ` · ${expired ? "venció" : "vence"} ${role.expiresAt.toLocaleString("es-GT")}`
                        : ""}
                      <span aria-hidden="true"> ×</span>
                    </ConfirmSubmitButton>
                  </form>
                );
              })}
            </div>

            {membership.active && (
              <form
                action={grantMembershipRoleAction}
                className="mt-5 grid gap-3 rounded-md bg-background p-4 sm:grid-cols-[1fr_0.7fr_auto] sm:items-end"
              >
                <input
                  type="hidden"
                  name="membershipId"
                  value={membership.id}
                />
                <label className="text-sm font-medium">
                  Asignar o renovar rol
                  <select
                    className="mt-2 min-h-11 w-full rounded-md border bg-surface px-3"
                    name="role"
                    defaultValue={RoleName.OPERACIONES}
                  >
                    {Object.values(RoleName).map((role) => (
                      <option key={role} value={role}>
                        {roleLabels[role]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-medium">
                  Vigencia soporte
                  <select
                    className="mt-2 min-h-11 w-full rounded-md border bg-surface px-3"
                    name="supportHours"
                    defaultValue="4"
                  >
                    <option value="1">1 hora</option>
                    <option value="4">4 horas</option>
                    <option value="8">8 horas</option>
                    <option value="24">24 horas</option>
                  </select>
                </label>
                <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-white">
                  <ShieldCheck className="size-4" aria-hidden="true" /> Asignar
                </button>
                <p className="text-xs text-muted sm:col-span-3">
                  La vigencia sólo se aplica al rol Soporte temporal. Los
                  permisos vencen aunque la fila histórica permanezca visible.
                </p>
              </form>
            )}
          </article>
        ))}
      </section>
    </AdminShell>
  );
}

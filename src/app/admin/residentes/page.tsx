import { DwellingType, HouseholdRelation } from "@prisma/client";
import { Home, MailPlus, UserPlus, UsersRound } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { ConfirmSubmitButton } from "@/components/admin/confirm-submit-button";
import { FormMessage } from "@/components/form-message";
import { getAuthContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import {
  addHouseholdMemberAction,
  createDwellingAction,
  createHouseholdAction,
  deleteDwellingAction,
  moveOutHouseholdMemberAction,
  setHouseholdActiveAction,
  updateDwellingAction,
} from "@/server/actions/admin";

function humanize(value: string) {
  return value.replaceAll("_", " ").toLowerCase();
}

export default async function ResidentsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const [context, query] = await Promise.all([getAuthContext(), searchParams]);
  if (!context?.user) redirect("/login?next=/admin/residentes");
  if (!context.membership || !can(context.membership, "create", "membership"))
    redirect("/inicio?denied=1");
  const [dwellings, zones] = await Promise.all([
    db.dwelling.findMany({
      where: { tenantId: context.membership.tenantId },
      include: {
        households: {
          include: {
            members: {
              include: { user: { select: { email: true } } },
              orderBy: [
                { active: "desc" },
                { isPrimary: "desc" },
                { fullName: "asc" },
              ],
            },
          },
          orderBy: [{ active: "desc" }, { createdAt: "asc" }],
        },
        _count: { select: { tickets: true } },
      },
      orderBy: { code: "asc" },
    }),
    db.zoneConfig.findMany({
      where: { tenantId: context.membership.tenantId, active: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const households = dwellings.flatMap((dwelling) =>
    dwelling.households
      .filter(({ active }) => active)
      .map((household) => ({
        id: household.id,
        label: `${dwelling.code} · ${household.name ?? "Hogar sin nombre"}`,
      })),
  );

  return (
    <AdminShell permissions={context.membership}>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-brand">
            Directorio residencial
          </p>
          <h1 className="mt-2 text-3xl font-semibold">
            Residentes, hogares y viviendas
          </h1>
          <p className="mt-2 text-sm text-muted">
            Gestiona ocupación sin borrar el historial de reportes ni auditoría.
          </p>
        </div>
        <Link
          className="inline-flex min-h-11 items-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-white"
          href="/admin/invitaciones"
        >
          <MailPlus className="size-4" aria-hidden="true" /> Invitar residente
        </Link>
      </header>
      <div className="mt-5">
        <FormMessage error={query.error} message={query.message} />
      </div>

      <section
        aria-label="Altas rápidas"
        className="mt-7 grid gap-5 lg:grid-cols-3"
      >
        <form
          action={createDwellingAction}
          className="rounded-xl border bg-surface p-5 shadow-sm"
        >
          <Home className="size-6 text-brand" aria-hidden="true" />
          <h2 className="mt-3 text-lg font-semibold">Nueva vivienda</h2>
          <label className="mt-4 block text-sm font-medium">
            Código
            <input
              className="mt-2 min-h-11 w-full rounded-md border bg-background px-3"
              name="code"
              placeholder="Casa 24"
              required
            />
          </label>
          <label className="mt-3 block text-sm font-medium">
            Tipo
            <select
              className="mt-2 min-h-11 w-full rounded-md border bg-background px-3 capitalize"
              name="type"
              defaultValue={DwellingType.CASA}
            >
              {Object.values(DwellingType).map((type) => (
                <option key={type} value={type}>
                  {humanize(type)}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-3 block text-sm font-medium">
            Zona
            <select
              className="mt-2 min-h-11 w-full rounded-md border bg-background px-3"
              name="zone"
              defaultValue=""
            >
              <option value="">Sin zona</option>
              {zones.map((zone) => (
                <option key={zone.id} value={zone.name}>
                  {zone.name}
                </option>
              ))}
            </select>
          </label>
          <button className="mt-4 min-h-11 w-full rounded-md bg-brand px-4 text-sm font-semibold text-white">
            Crear vivienda
          </button>
        </form>

        <form
          action={createHouseholdAction}
          className="rounded-xl border bg-surface p-5 shadow-sm"
        >
          <UsersRound className="size-6 text-brand" aria-hidden="true" />
          <h2 className="mt-3 text-lg font-semibold">Nuevo hogar</h2>
          <label className="mt-4 block text-sm font-medium">
            Vivienda
            <select
              className="mt-2 min-h-11 w-full rounded-md border bg-background px-3"
              name="dwellingId"
              required
              defaultValue=""
            >
              <option value="">Selecciona</option>
              {dwellings.map((dwelling) => (
                <option key={dwelling.id} value={dwelling.id}>
                  {dwelling.code}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-3 block text-sm font-medium">
            Nombre
            <input
              className="mt-2 min-h-11 w-full rounded-md border bg-background px-3"
              name="name"
              placeholder="Familia García"
            />
          </label>
          <button className="mt-4 min-h-11 w-full rounded-md bg-brand px-4 text-sm font-semibold text-white">
            Crear hogar
          </button>
        </form>

        <form
          action={addHouseholdMemberAction}
          className="rounded-xl border bg-surface p-5 shadow-sm"
        >
          <UserPlus className="size-6 text-brand" aria-hidden="true" />
          <h2 className="mt-3 text-lg font-semibold">Agregar persona</h2>
          <label className="mt-4 block text-sm font-medium">
            Hogar
            <select
              className="mt-2 min-h-11 w-full rounded-md border bg-background px-3"
              name="householdId"
              required
              defaultValue=""
            >
              <option value="">Selecciona</option>
              {households.map((household) => (
                <option key={household.id} value={household.id}>
                  {household.label}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-3 block text-sm font-medium">
            Nombre completo
            <input
              className="mt-2 min-h-11 w-full rounded-md border bg-background px-3"
              name="fullName"
              required
            />
          </label>
          <label className="mt-3 block text-sm font-medium">
            Relación
            <select
              className="mt-2 min-h-11 w-full rounded-md border bg-background px-3 capitalize"
              name="relation"
              defaultValue={HouseholdRelation.FAMILIAR}
            >
              {Object.values(HouseholdRelation).map((relation) => (
                <option key={relation} value={relation}>
                  {humanize(relation)}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-3 flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" name="isPrimary" /> Contacto principal
          </label>
          <button className="mt-2 min-h-11 w-full rounded-md bg-brand px-4 text-sm font-semibold text-white">
            Agregar persona
          </button>
        </form>
      </section>

      <section className="mt-7 space-y-5" aria-labelledby="dwelling-list-title">
        <h2 id="dwelling-list-title" className="text-xl font-semibold">
          Directorio ({dwellings.length} viviendas)
        </h2>
        {dwellings.length === 0 && (
          <div className="rounded-xl border bg-surface p-10 text-center text-sm text-muted">
            Aún no hay viviendas. Crea la primera con el formulario superior.
          </div>
        )}
        {dwellings.map((dwelling) => (
          <article
            key={dwelling.id}
            className="rounded-xl border bg-surface p-5 shadow-sm sm:p-6"
          >
            <form
              action={updateDwellingAction}
              className="grid gap-3 lg:grid-cols-[1fr_0.8fr_0.8fr_auto] lg:items-end"
            >
              <input type="hidden" name="dwellingId" value={dwelling.id} />
              <label className="text-sm font-medium">
                Código
                <input
                  className="mt-2 min-h-11 w-full rounded-md border bg-background px-3"
                  name="code"
                  defaultValue={dwelling.code}
                  required
                />
              </label>
              <label className="text-sm font-medium">
                Tipo
                <select
                  className="mt-2 min-h-11 w-full rounded-md border bg-background px-3 capitalize"
                  name="type"
                  defaultValue={dwelling.type}
                >
                  {Object.values(DwellingType).map((type) => (
                    <option key={type} value={type}>
                      {humanize(type)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium">
                Zona
                <select
                  className="mt-2 min-h-11 w-full rounded-md border bg-background px-3"
                  name="zone"
                  defaultValue={dwelling.zone ?? ""}
                >
                  <option value="">Sin zona</option>
                  {zones.map((zone) => (
                    <option key={zone.id} value={zone.name}>
                      {zone.name}
                    </option>
                  ))}
                </select>
              </label>
              <button className="min-h-11 rounded-md border px-4 text-sm font-medium">
                Guardar
              </button>
            </form>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
              <span>
                {dwelling.households.length} hogares · {dwelling._count.tickets}{" "}
                reportes
              </span>
              {dwelling.households.length === 0 &&
                dwelling._count.tickets === 0 && (
                  <form action={deleteDwellingAction}>
                    <input
                      type="hidden"
                      name="dwellingId"
                      value={dwelling.id}
                    />
                    <ConfirmSubmitButton
                      className="text-danger"
                      confirmation={`Eliminar ${dwelling.code} de forma permanente?`}
                    >
                      Eliminar vivienda
                    </ConfirmSubmitButton>
                  </form>
                )}
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {dwelling.households.map((household) => (
                <section
                  key={household.id}
                  className={`rounded-md border p-4 ${household.active ? "" : "opacity-65"}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">
                        {household.name ?? "Hogar sin nombre"}
                      </h3>
                      <p className="mt-1 text-xs text-muted">
                        {household.active ? "Activo" : "Inactivo"} ·{" "}
                        {
                          household.members.filter(({ active }) => active)
                            .length
                        }{" "}
                        residentes activos
                      </p>
                    </div>
                    <form action={setHouseholdActiveAction}>
                      <input
                        type="hidden"
                        name="householdId"
                        value={household.id}
                      />
                      <input
                        type="hidden"
                        name="active"
                        value={household.active ? "0" : "1"}
                      />
                      {household.active ? (
                        <ConfirmSubmitButton
                          className="text-danger"
                          confirmation="Desactivar el hogar también registrará la salida de sus residentes y revocará accesos sin otra vivienda. ¿Continuar?"
                        >
                          Desactivar
                        </ConfirmSubmitButton>
                      ) : (
                        <button className="min-h-11 rounded-md border px-3 text-sm font-medium text-brand">
                          Reactivar
                        </button>
                      )}
                    </form>
                  </div>
                  <ul className="mt-4 space-y-2">
                    {household.members.length === 0 && (
                      <li className="text-sm text-muted">
                        Sin personas registradas.
                      </li>
                    )}
                    {household.members.map((member) => (
                      <li
                        key={member.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-background p-3 text-sm"
                      >
                        <div>
                          <p className="font-medium">
                            {member.fullName}
                            {member.isPrimary ? " · Principal" : ""}
                          </p>
                          <p className="mt-1 text-xs capitalize text-muted">
                            {humanize(member.relation)}
                            {member.user?.email
                              ? ` · ${member.user.email}`
                              : ""}
                            {!member.active && member.leftAt
                              ? ` · salida ${member.leftAt.toLocaleDateString("es-GT")}`
                              : ""}
                          </p>
                        </div>
                        {member.active && household.active && (
                          <form action={moveOutHouseholdMemberAction}>
                            <input
                              type="hidden"
                              name="memberId"
                              value={member.id}
                            />
                            <ConfirmSubmitButton
                              className="text-danger"
                              confirmation={`Registrar la salida de ${member.fullName}? Su acceso se revocará si no tiene otra vivienda activa.`}
                            >
                              Registrar salida
                            </ConfirmSubmitButton>
                          </form>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </article>
        ))}
      </section>
    </AdminShell>
  );
}

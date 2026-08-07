import { NotificationChannel, RoleName, TicketCategory } from "@prisma/client";
import { BellRing, MapPinned, Settings2 } from "lucide-react";
import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { ConfirmSubmitButton } from "@/components/admin/confirm-submit-button";
import { FormMessage } from "@/components/form-message";
import { ticketCategoryLabels } from "@/config/tickets";
import { getAuthContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import {
  createZoneConfigurationAction,
  setZoneActiveAction,
  updateCategoryConfigurationAction,
  updateTenantSettingsAction,
} from "@/server/actions/admin";
import { DEFAULT_TENANT_CHANNELS } from "@/server/services/tenant-settings";

const staffRoles = [
  RoleName.OPERACIONES,
  RoleName.SEGURIDAD,
  RoleName.COMUNICACIONES,
  RoleName.FINANZAS,
  RoleName.MODERADOR,
];

const roleLabels: Partial<Record<RoleName, string>> = {
  OPERACIONES: "Operaciones",
  SEGURIDAD: "Seguridad",
  COMUNICACIONES: "Comunicaciones",
  FINANZAS: "Finanzas",
  MODERADOR: "Moderación",
};

const channelLabels: Record<NotificationChannel, string> = {
  IN_APP: "En la aplicación",
  PUSH: "Web Push",
  EMAIL: "Correo",
  SMS: "SMS",
};

export default async function ConfigurationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const [context, query] = await Promise.all([getAuthContext(), searchParams]);
  if (!context?.user) redirect("/login?next=/admin/configuracion");
  if (!context.membership || !can(context.membership, "update", "tenant"))
    redirect("/inicio?denied=1");
  const [categories, zones, savedSettings] = await Promise.all([
    db.categoryConfig.findMany({
      where: { tenantId: context.membership.tenantId },
    }),
    db.zoneConfig.findMany({
      where: { tenantId: context.membership.tenantId },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
    db.tenantSettings.findUnique({
      where: { tenantId: context.membership.tenantId },
    }),
  ]);
  const categoryMap = new Map(
    categories.map((config) => [config.category, config]),
  );
  const channels =
    savedSettings?.notificationChannels ?? DEFAULT_TENANT_CHANNELS;

  return (
    <AdminShell permissions={context.membership}>
      <header>
        <p className="font-mono text-xs uppercase tracking-widest text-brand">
          Parámetros del tenant
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Configuración</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          Los cambios de SLA se aplican a los reportes nuevos. El historial
          conserva la fecha calculada al crearse.
        </p>
      </header>
      <div className="mt-5">
        <FormMessage error={query.error} message={query.message} />
      </div>

      <section
        className="mt-7 rounded-xl border bg-surface p-5 shadow-sm sm:p-6"
        aria-labelledby="categories-title"
      >
        <div className="flex items-center gap-3">
          <Settings2 className="size-6 text-brand" aria-hidden="true" />
          <h2 id="categories-title" className="text-xl font-semibold">
            Categorías y SLA
          </h2>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {Object.values(TicketCategory).map((category) => {
            const config = categoryMap.get(category);
            return (
              <form
                key={category}
                action={updateCategoryConfigurationAction}
                className="grid gap-3 rounded-md border bg-background p-4 sm:grid-cols-[1fr_0.7fr] sm:items-end"
              >
                <input type="hidden" name="category" value={category} />
                <div>
                  <p className="font-semibold">
                    {ticketCategoryLabels[category]}
                  </p>
                  <label className="mt-3 flex min-h-11 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="active"
                      defaultChecked={config?.active ?? true}
                    />{" "}
                    Categoría activa
                  </label>
                </div>
                <label className="text-sm font-medium">
                  SLA (horas)
                  <input
                    className="mt-2 min-h-11 w-full rounded-md border bg-surface px-3"
                    name="slaHours"
                    type="number"
                    min="1"
                    max={24 * 90}
                    defaultValue={config?.slaHours ?? 48}
                    required
                  />
                </label>
                <label className="text-sm font-medium sm:col-span-2">
                  Rol responsable predeterminado
                  <select
                    className="mt-2 min-h-11 w-full rounded-md border bg-surface px-3"
                    name="defaultRole"
                    defaultValue={config?.defaultRole ?? ""}
                  >
                    <option value="">Sin asignación automática</option>
                    {staffRoles.map((role) => (
                      <option key={role} value={role}>
                        {roleLabels[role]}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="min-h-11 rounded-md bg-brand px-4 text-sm font-semibold text-white sm:col-span-2">
                  Guardar categoría
                </button>
              </form>
            );
          })}
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section
          className="rounded-xl border bg-surface p-5 shadow-sm sm:p-6"
          aria-labelledby="zones-title"
        >
          <div className="flex items-center gap-3">
            <MapPinned className="size-6 text-brand" aria-hidden="true" />
            <h2 id="zones-title" className="text-xl font-semibold">
              Zonas
            </h2>
          </div>
          <form
            action={createZoneConfigurationAction}
            className="mt-5 flex flex-wrap gap-3"
          >
            <label className="min-w-48 flex-1 text-sm font-medium">
              Nueva zona
              <input
                className="mt-2 min-h-11 w-full rounded-md border bg-background px-3"
                name="name"
                placeholder="Sector Norte"
                required
              />
            </label>
            <button className="min-h-11 self-end rounded-md bg-brand px-4 text-sm font-semibold text-white">
              Agregar zona
            </button>
          </form>
          <ul className="mt-5 space-y-2">
            {zones.length === 0 && (
              <li className="text-sm text-muted">
                Aún no hay zonas configuradas.
              </li>
            )}
            {zones.map((zone) => (
              <li
                key={zone.id}
                className="flex items-center justify-between gap-3 rounded-md bg-background p-3"
              >
                <span
                  className={
                    zone.active ? "font-medium" : "text-muted line-through"
                  }
                >
                  {zone.name}
                </span>
                <form action={setZoneActiveAction}>
                  <input type="hidden" name="zoneId" value={zone.id} />
                  <input
                    type="hidden"
                    name="active"
                    value={zone.active ? "0" : "1"}
                  />
                  {zone.active ? (
                    <ConfirmSubmitButton
                      className="text-danger"
                      confirmation={`Desactivar la zona ${zone.name}? Las viviendas existentes conservarán su historial.`}
                    >
                      Desactivar
                    </ConfirmSubmitButton>
                  ) : (
                    <button className="min-h-11 rounded-md border px-3 text-sm font-medium text-brand">
                      Activar
                    </button>
                  )}
                </form>
              </li>
            ))}
          </ul>
        </section>

        <section
          className="rounded-xl border bg-surface p-5 shadow-sm sm:p-6"
          aria-labelledby="channels-title"
        >
          <div className="flex items-center gap-3">
            <BellRing className="size-6 text-brand" aria-hidden="true" />
            <h2 id="channels-title" className="text-xl font-semibold">
              Canales y emergencias
            </h2>
          </div>
          <form action={updateTenantSettingsAction} className="mt-5 space-y-4">
            <fieldset>
              <legend className="text-sm font-medium">
                Canales disponibles para el residencial
              </legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {[
                  NotificationChannel.IN_APP,
                  NotificationChannel.PUSH,
                  NotificationChannel.EMAIL,
                ].map((channel) => (
                  <label
                    key={channel}
                    className="flex min-h-11 items-center gap-2 rounded-md border bg-background px-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      name="notificationChannels"
                      value={channel}
                      defaultChecked={channels.includes(channel)}
                      disabled={channel === NotificationChannel.IN_APP}
                    />
                    {channelLabels[channel]}
                    {channel === NotificationChannel.IN_APP && (
                      <input
                        type="hidden"
                        name="notificationChannels"
                        value={channel}
                      />
                    )}
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted">
                In-app permanece activo por seguridad. SMS sigue fuera del MVP
                hasta contratar proveedor.
              </p>
            </fieldset>
            <label className="block text-sm font-medium">
              Contactos/protocolos de emergencia
              <textarea
                className="mt-2 min-h-28 w-full rounded-md border bg-background p-3"
                name="emergencyContacts"
                defaultValue={savedSettings?.emergencyContacts.join("\n") ?? ""}
                placeholder="Seguridad: 5555-0101&#10;Emergencias: 122"
              />
              <span className="mt-1 block text-xs font-normal text-muted">
                Uno por línea; se mostrarán a residentes en el reglamento.
              </span>
            </label>
            <button className="min-h-11 w-full rounded-md bg-brand px-4 text-sm font-semibold text-white">
              Guardar canales
            </button>
          </form>
        </section>
      </div>
    </AdminShell>
  );
}

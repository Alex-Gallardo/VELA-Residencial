import { Settings2 } from "lucide-react";
import { redirect } from "next/navigation";

import { ResidentShell } from "@/components/app/resident-shell";
import { FormMessage } from "@/components/form-message";
import { PushSubscriptionManager } from "@/components/notifications/push-subscription-manager";
import { getAuthContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateNotificationPreferencesAction } from "@/server/actions/notifications";
import { defaultDeliveryPreferences } from "@/server/services/notification-preferences";

function minutesToTime(minutes: number | null) {
  if (minutes === null) return "";
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(
    minutes % 60,
  ).padStart(2, "0")}`;
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const [context, query] = await Promise.all([getAuthContext(), searchParams]);
  if (!context?.user) redirect("/login?next=/perfil");
  if (!context.membership) redirect("/onboarding");
  const [savedPreferences, pushCount] = await Promise.all([
    db.notificationPreference.findUnique({
      where: {
        tenantId_userId: {
          tenantId: context.membership.tenantId,
          userId: context.user.id,
        },
      },
    }),
    db.pushSubscription.count({
      where: {
        tenantId: context.membership.tenantId,
        userId: context.user.id,
      },
    }),
  ]);
  const preferences = savedPreferences ?? defaultDeliveryPreferences;

  return (
    <ResidentShell active="perfil">
      <section className="mx-auto max-w-3xl rounded-xl border bg-surface p-6 shadow-md sm:p-9">
        <Settings2 className="size-8 text-brand" aria-hidden="true" />
        <h1 className="mt-4 text-3xl font-semibold">Perfil y notificaciones</h1>
        <p className="mt-2 text-sm text-muted">
          {context.user.fullName ?? context.user.email} ·{" "}
          {context.membership.tenant.name}
        </p>
        <div className="mt-6">
          <FormMessage error={query.error} message={query.message} />
        </div>
        <form
          action={updateNotificationPreferencesAction}
          className="mt-6 space-y-6"
        >
          <fieldset>
            <legend className="font-semibold">Canales permitidos</legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {[
                ["inAppEnabled", "En la aplicación", preferences.inAppEnabled],
                ["pushEnabled", "Web Push", preferences.pushEnabled],
                ["emailEnabled", "Correo", preferences.emailEnabled],
              ].map(([name, label, enabled]) => (
                <label
                  key={String(name)}
                  className="flex min-h-11 items-center gap-2 rounded-md border bg-background px-3 text-sm"
                >
                  <input
                    name={String(name)}
                    type="checkbox"
                    defaultChecked={Boolean(enabled)}
                  />
                  {String(label)}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="font-semibold">Horario silencioso</legend>
            <p className="mt-1 text-xs text-muted">
              Push y correo se difieren durante este periodo. Las alertas
              críticas siempre se entregan.
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium">
                Desde
                <input
                  className="mt-2 min-h-11 w-full rounded-md border bg-background px-3"
                  name="quietHoursStart"
                  type="time"
                  defaultValue={minutesToTime(preferences.quietHoursStart)}
                />
              </label>
              <label className="text-sm font-medium">
                Hasta
                <input
                  className="mt-2 min-h-11 w-full rounded-md border bg-background px-3"
                  name="quietHoursEnd"
                  type="time"
                  defaultValue={minutesToTime(preferences.quietHoursEnd)}
                />
              </label>
            </div>
            <label className="mt-4 block text-sm font-medium">
              Zona horaria
              <select
                className="mt-2 min-h-11 w-full rounded-md border bg-background px-3"
                name="timeZone"
                defaultValue={preferences.timeZone}
              >
                <option value="America/Guatemala">Guatemala</option>
                <option value="America/Mexico_City">Ciudad de México</option>
                <option value="America/Bogota">Bogotá</option>
                <option value="America/Lima">Lima</option>
                <option value="America/Panama">Panamá</option>
                <option value="America/Costa_Rica">Costa Rica</option>
              </select>
            </label>
          </fieldset>
          <button className="min-h-12 rounded-md bg-brand px-5 font-semibold text-white">
            Guardar preferencias
          </button>
        </form>

        <div className="mt-7">
          <PushSubscriptionManager
            publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY}
            hasSubscription={pushCount > 0}
          />
        </div>
      </section>
    </ResidentShell>
  );
}

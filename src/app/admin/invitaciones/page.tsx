import { HouseholdRelation, InvitationStatus, RoleName } from "@prisma/client";
import { ArrowLeft, Copy, MailPlus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { FormMessage } from "@/components/form-message";
import { getAuthContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import {
  createInvitationAction,
  revokeInvitationAction,
} from "@/server/actions/invitations";

function label(value: string) {
  return value.replaceAll("_", " ").toLowerCase();
}

export default async function InvitationsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string; link?: string }>;
}) {
  const [context, query] = await Promise.all([getAuthContext(), searchParams]);
  if (!context?.user) redirect("/login?next=/admin/invitaciones");
  if (!context.membership || !can(context.membership, "invite", "invitation"))
    redirect("/inicio?denied=1");

  const [dwellings, invitations] = await Promise.all([
    db.dwelling.findMany({
      where: { tenantId: context.membership.tenantId },
      orderBy: { code: "asc" },
    }),
    db.invitation.findMany({
      where: { tenantId: context.membership.tenantId },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
  ]);

  return (
    <main className="min-h-screen bg-background px-5 py-8 sm:px-10">
      <div className="mx-auto max-w-6xl">
        <Link
          className="inline-flex min-h-11 items-center gap-2 text-sm text-brand"
          href="/inicio"
        >
          <ArrowLeft className="size-4" aria-hidden="true" /> Volver al inicio
        </Link>
        <div className="mt-6 grid gap-7 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-xl border bg-surface p-6 shadow-md sm:p-8">
            <MailPlus className="size-8 text-brand" aria-hidden="true" />
            <h1 className="mt-4 text-3xl font-semibold">Invitar residente</h1>
            <p className="mt-2 text-sm leading-6 text-muted">
              El enlace es único, vence en 7 días y sólo sirve para el correo
              indicado.
            </p>
            <div className="mt-6">
              <FormMessage error={query.error} message={query.message} />
              {query.link && (
                <label className="mb-5 block text-sm font-medium">
                  Enlace seguro
                  <span className="mt-2 flex items-center gap-2 rounded-md border bg-background p-2">
                    <Copy
                      className="size-4 shrink-0 text-muted"
                      aria-hidden="true"
                    />
                    <input
                      className="w-full bg-transparent text-xs"
                      readOnly
                      value={query.link}
                      aria-label="Enlace seguro de invitación"
                    />
                  </span>
                </label>
              )}
            </div>
            <form action={createInvitationAction} className="space-y-5">
              <label className="block text-sm font-medium">
                Correo del residente
                <input
                  className="mt-2 min-h-11 w-full rounded-md border bg-background px-3"
                  name="email"
                  type="email"
                  required
                />
              </label>
              <label className="block text-sm font-medium">
                Vivienda
                <select
                  className="mt-2 min-h-11 w-full rounded-md border bg-background px-3"
                  name="dwellingId"
                  required
                >
                  <option value="">Selecciona una vivienda</option>
                  {dwellings.map((dwelling) => (
                    <option key={dwelling.id} value={dwelling.id}>
                      {dwelling.code}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium">
                Relación con la vivienda
                <select
                  className="mt-2 min-h-11 w-full rounded-md border bg-background px-3 capitalize"
                  name="relation"
                  defaultValue={HouseholdRelation.PROPIETARIO}
                >
                  {Object.values(HouseholdRelation).map((relation) => (
                    <option key={relation} value={relation}>
                      {label(relation)}
                    </option>
                  ))}
                </select>
              </label>
              <input type="hidden" name="role" value={RoleName.RESIDENTE} />
              <button className="min-h-11 w-full rounded-md bg-brand px-5 font-medium text-white">
                Crear invitación
              </button>
            </form>
          </section>

          <section className="rounded-xl border bg-surface p-6 shadow-md sm:p-8">
            <h2 className="text-xl font-semibold">Invitaciones recientes</h2>
            <div className="mt-5 space-y-3">
              {invitations.length === 0 && (
                <p className="rounded-md bg-background p-4 text-sm text-muted">
                  Aún no hay invitaciones.
                </p>
              )}
              {invitations.map((invitation) => (
                <article key={invitation.id} className="rounded-md border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{invitation.email}</p>
                      <p className="mt-1 text-xs capitalize text-muted">
                        {label(invitation.status)} · vence{" "}
                        {invitation.expiresAt.toLocaleDateString("es-GT")}
                      </p>
                    </div>
                    {invitation.status === InvitationStatus.PENDIENTE && (
                      <form action={revokeInvitationAction}>
                        <input
                          type="hidden"
                          name="invitationId"
                          value={invitation.id}
                        />
                        <button className="min-h-11 rounded-md border px-3 text-xs font-medium text-danger">
                          Revocar
                        </button>
                      </form>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

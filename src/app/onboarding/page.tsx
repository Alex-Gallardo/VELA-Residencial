import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth-shell";
import { FormMessage } from "@/components/form-message";
import { getAuthContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { completeOnboardingAction } from "@/server/actions/onboarding";
import { findInvitationByToken } from "@/server/services/invitation-service";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const query = await searchParams;
  const context = await getAuthContext();
  if (!context) redirect("/login?next=/onboarding");

  const invitation = query.token
    ? await findInvitationByToken(query.token)
    : null;
  if (
    !invitation ||
    context.authUser.email?.toLowerCase() !== invitation.email.toLowerCase()
  ) {
    return (
      <AuthShell
        eyebrow="Registro residencial"
        title="Necesitas una invitación válida"
        description="Abre el enlace que recibiste de la administración con la cuenta invitada."
      >
        <FormMessage error={query.error} />
        <Link
          className="text-sm font-medium text-brand underline"
          href="/login"
        >
          Cambiar de cuenta
        </Link>
      </AuthShell>
    );
  }

  const dwelling = invitation.dwellingId
    ? await db.dwelling.findFirst({
        where: { id: invitation.dwellingId, tenantId: invitation.tenantId },
      })
    : null;

  return (
    <AuthShell
      eyebrow="Paso final"
      title="Confirma tu hogar"
      description={`${invitation.tenant.name} · ${dwelling?.code ?? "Vivienda por confirmar"} · ${invitation.relation ?? "Relación por confirmar"}`}
    >
      <FormMessage error={query.error} />
      <form action={completeOnboardingAction} className="space-y-5">
        <input type="hidden" name="token" value={query.token} />
        <label className="block text-sm font-medium">
          Nombre completo
          <input
            className="mt-2 min-h-11 w-full rounded-md border bg-background px-3"
            name="fullName"
            defaultValue={context.user?.fullName ?? ""}
            required
          />
        </label>
        <label className="block text-sm font-medium">
          Nombre del hogar
          <input
            className="mt-2 min-h-11 w-full rounded-md border bg-background px-3"
            name="householdName"
            placeholder="Ej. Familia García"
            required
          />
        </label>
        <label className="block text-sm font-medium">
          Teléfono <span className="font-normal text-muted">(opcional)</span>
          <input
            className="mt-2 min-h-11 w-full rounded-md border bg-background px-3"
            name="phone"
            type="tel"
            autoComplete="tel"
          />
        </label>
        <button className="min-h-11 w-full rounded-md bg-brand px-5 font-medium text-white">
          Completar registro
        </button>
      </form>
    </AuthShell>
  );
}

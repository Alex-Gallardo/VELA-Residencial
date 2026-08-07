import { AuthShell } from "@/components/auth-shell";
import { FormMessage } from "@/components/form-message";
import { getAuthContext } from "@/lib/auth";
import { acceptInvitationAccountAction } from "@/server/actions/onboarding";
import { findInvitationByToken } from "@/server/services/invitation-service";

export default async function InvitationPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ token }, query, context] = await Promise.all([
    params,
    searchParams,
    getAuthContext(),
  ]);
  const invitation = await findInvitationByToken(token);

  if (!invitation) {
    return (
      <AuthShell
        eyebrow="Invitación"
        title="Este enlace ya no está disponible"
        description="La invitación venció, fue utilizada o fue revocada. Solicita una nueva a la administración."
      >
        <Link
          className="text-sm font-medium text-brand underline"
          href="/login"
        >
          Ir al acceso
        </Link>
      </AuthShell>
    );
  }

  const sameSession =
    context?.authUser.email?.toLowerCase() === invitation.email.toLowerCase();
  return (
    <AuthShell
      eyebrow="Invitación válida"
      title={`Únete a ${invitation.tenant.name}`}
      description={`La administración reservó este acceso para ${invitation.email}. El enlace vence el ${invitation.expiresAt.toLocaleDateString("es-GT")}.`}
    >
      <FormMessage error={query.error} />
      <form action={acceptInvitationAccountAction} className="space-y-5">
        <input type="hidden" name="token" value={token} />
        <label className="block text-sm font-medium">
          Nombre completo
          <input
            className="mt-2 min-h-11 w-full rounded-md border bg-background px-3"
            name="fullName"
            defaultValue={context?.user?.fullName ?? ""}
            autoComplete="name"
            required
          />
        </label>
        {!sameSession && (
          <label className="block text-sm font-medium">
            Crea una contraseña
            <input
              className="mt-2 min-h-11 w-full rounded-md border bg-background px-3"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
        )}
        <button className="min-h-11 w-full rounded-md bg-brand px-5 font-medium text-white">
          {sameSession ? "Continuar al registro" : "Crear cuenta y continuar"}
        </button>
      </form>
      {!sameSession && (
        <p className="mt-5 text-center text-xs leading-5 text-muted">
          ¿Ya tienes cuenta? Inicia sesión y vuelve a abrir esta invitación.
        </p>
      )}
    </AuthShell>
  );
}
import Link from "next/link";

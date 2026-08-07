import { AuthShell } from "@/components/auth-shell";
import { FormMessage } from "@/components/form-message";
import { requestPasswordResetAction } from "@/server/actions/auth";

export default async function RecoverPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthShell
      eyebrow="Recuperación"
      title="Recupera tu cuenta"
      description="Te enviaremos un enlace si el correo pertenece a una cuenta activa."
    >
      <FormMessage error={params.error} message={params.message} />
      <form action={requestPasswordResetAction} className="space-y-5">
        <label className="block text-sm font-medium">
          Correo
          <input
            className="mt-2 min-h-11 w-full rounded-md border bg-background px-3"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        </label>
        <button className="min-h-11 w-full rounded-md bg-brand px-5 font-medium text-white">
          Enviar instrucciones
        </button>
      </form>
      <Link
        className="mt-5 block text-center text-sm text-brand underline"
        href="/login"
      >
        Volver al acceso
      </Link>
    </AuthShell>
  );
}
import Link from "next/link";

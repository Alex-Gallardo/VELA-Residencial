import { AuthShell } from "@/components/auth-shell";
import { FormMessage } from "@/components/form-message";
import { safeRelativePath } from "@/lib/route-guards";
import { loginAction } from "@/server/actions/auth";

type SearchParams = Promise<{
  error?: string;
  message?: string;
  next?: string;
}>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  return (
    <AuthShell
      eyebrow="Acceso seguro"
      title="Inicia sesión"
      description="Entra con la cuenta asociada a la invitación de tu residencial."
    >
      <FormMessage error={params.error} message={params.message} />
      <form action={loginAction} className="space-y-5">
        <input
          type="hidden"
          name="next"
          value={safeRelativePath(params.next)}
        />
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
        <label className="block text-sm font-medium">
          Contraseña
          <input
            className="mt-2 min-h-11 w-full rounded-md border bg-background px-3"
            name="password"
            type="password"
            autoComplete="current-password"
            minLength={8}
            required
          />
        </label>
        <button className="min-h-11 w-full rounded-md bg-brand px-5 font-medium text-white hover:bg-brand-hover">
          Entrar
        </button>
      </form>
      <Link
        className="mt-5 block text-center text-sm text-brand underline"
        href="/recuperar-cuenta"
      >
        ¿Olvidaste tu contraseña?
      </Link>
    </AuthShell>
  );
}
import Link from "next/link";

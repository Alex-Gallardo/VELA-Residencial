import { AuthShell } from "@/components/auth-shell";
import { FormMessage } from "@/components/form-message";
import { updatePasswordAction } from "@/server/actions/auth";

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthShell
      eyebrow="Nueva contraseña"
      title="Protege tu cuenta"
      description="Elige una contraseña nueva de al menos 8 caracteres."
    >
      <FormMessage error={params.error} />
      <form action={updatePasswordAction} className="space-y-5">
        <label className="block text-sm font-medium">
          Contraseña nueva
          <input
            className="mt-2 min-h-11 w-full rounded-md border bg-background px-3"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        <button className="min-h-11 w-full rounded-md bg-brand px-5 font-medium text-white">
          Guardar contraseña
        </button>
      </form>
    </AuthShell>
  );
}

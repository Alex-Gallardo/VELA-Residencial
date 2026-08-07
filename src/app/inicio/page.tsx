import { Flame, LogOut, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { FormMessage } from "@/components/form-message";
import { getAuthContext } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { logoutAction } from "@/server/actions/auth";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; denied?: string }>;
}) {
  const [context, query] = await Promise.all([getAuthContext(), searchParams]);
  if (!context?.user) redirect("/login?next=/inicio");
  if (!context.membership) redirect("/onboarding");
  const roles = context.membership.roles.map(({ role }) =>
    role.replaceAll("_", " "),
  );

  return (
    <main className="min-h-screen bg-background px-5 py-8 sm:px-10">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <Link className="flex items-center gap-2 font-semibold" href="/inicio">
          <span className="grid size-10 place-items-center rounded-full bg-brand text-white">
            <Flame className="size-5" aria-hidden="true" />
          </span>
          Vela
        </Link>
        <form action={logoutAction}>
          <button className="flex min-h-11 items-center gap-2 rounded-md border bg-surface px-4 text-sm font-medium">
            <LogOut className="size-4" aria-hidden="true" /> Cerrar sesión
          </button>
        </form>
      </nav>

      <section className="mx-auto mt-14 max-w-6xl">
        <FormMessage
          message={query.message}
          error={
            query.denied
              ? "No tienes permiso para abrir esa sección."
              : undefined
          }
        />
        <div className="rounded-xl border bg-surface p-7 shadow-md sm:p-10">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-4 py-2 text-sm font-medium text-brand">
            <ShieldCheck className="size-4" aria-hidden="true" /> Acceso
            protegido
          </span>
          <h1 className="mt-6 text-3xl font-semibold sm:text-4xl">
            Hola, {context.user.fullName ?? context.user.email}
          </h1>
          <p className="mt-3 text-muted">{context.membership.tenant.name}</p>
          <div className="mt-7 flex flex-wrap gap-2">
            {roles.map((role) => (
              <span
                key={role}
                className="rounded-full border px-3 py-1 text-xs font-medium"
              >
                {role}
              </span>
            ))}
          </div>
          {can(context.membership, "invite", "invitation") && (
            <Link
              className="mt-8 inline-flex min-h-11 items-center rounded-md bg-brand px-5 font-medium text-white"
              href="/admin/invitaciones"
            >
              Administrar invitaciones
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}

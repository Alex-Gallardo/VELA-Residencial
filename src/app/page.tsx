import { ArrowRight, CheckCircle2, Flame, ShieldCheck } from "lucide-react";
import Link from "next/link";

const accessFeatures = [
  "Acceso únicamente por invitación",
  "Sesiones seguras con Supabase Auth",
  "Permisos por rol y residencial",
  "Aislamiento multi-tenant con RLS",
];

export default function HomePage() {
  return (
    <main className="relative isolate min-h-screen overflow-hidden px-6 py-8 sm:px-10 lg:px-16">
      <div
        aria-hidden="true"
        className="absolute -right-32 -top-40 -z-10 h-96 w-96 rounded-full bg-brand-soft blur-3xl"
      />
      <nav
        className="mx-auto flex max-w-6xl items-center justify-between"
        aria-label="Principal"
      >
        <Link
          className="flex min-h-11 items-center gap-2 text-lg font-semibold"
          href="/"
        >
          <span className="grid size-9 place-items-center rounded-full bg-brand text-white shadow-sm">
            <Flame aria-hidden="true" className="size-5" />
          </span>
          Vela
        </Link>
        <span className="rounded-full bg-brand-soft px-4 py-2 text-sm font-medium text-brand">
          Acceso seguro
        </span>
      </nav>

      <section className="mx-auto grid max-w-6xl items-center gap-14 py-20 lg:grid-cols-[1.08fr_0.92fr] lg:py-28">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-surface px-4 py-2 text-sm text-muted shadow-sm">
            <ShieldCheck aria-hidden="true" className="size-4 text-brand" />
            Tu comunidad y tus datos, bien protegidos
          </div>
          <h1 className="max-w-3xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            Tu residencial, <span className="text-brand">en orden.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-balance text-lg leading-8 text-muted">
            Vela conecta a residentes y administración en un espacio privado
            para cada comunidad.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              className="inline-flex min-h-11 items-center gap-2 rounded-md bg-brand px-6 font-medium text-white hover:bg-brand-hover"
              href="/login"
            >
              Iniciar sesión{" "}
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
            <a
              className="inline-flex min-h-11 items-center rounded-md border bg-surface px-6 font-medium"
              href="/api/health"
            >
              Estado técnico
            </a>
          </div>
        </div>

        <div className="rounded-xl border bg-surface p-6 shadow-lg sm:p-8">
          <p className="font-mono text-xs uppercase tracking-widest text-faint">
            VELA · SPRINT 1
          </p>
          <h2 className="mt-2 text-2xl font-semibold">Identidad y acceso</h2>
          <ul className="mt-7 space-y-3">
            {accessFeatures.map((feature) => (
              <li
                key={feature}
                className="flex min-h-11 items-center gap-3 rounded-lg bg-background px-4 py-3"
              >
                <CheckCircle2
                  aria-hidden="true"
                  className="size-5 shrink-0 text-success"
                />
                <span className="text-sm font-medium sm:text-base">
                  {feature}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}

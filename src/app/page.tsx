import { ArrowRight, CheckCircle2, Flame, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

const foundations = [
  "Next.js 15 + TypeScript strict",
  "Supabase + Prisma preparados",
  "Diseño y accesibilidad base",
  "Calidad automatizada en CI",
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
        <a
          className="flex min-h-11 items-center gap-2 text-lg font-semibold"
          href="#inicio"
        >
          <span className="grid size-9 place-items-center rounded-full bg-brand text-white shadow-sm">
            <Flame aria-hidden="true" className="size-5" />
          </span>
          Vela
        </a>
        <span className="rounded-full bg-brand-soft px-4 py-2 text-sm font-medium text-brand">
          Sprint 0
        </span>
      </nav>

      <section
        id="inicio"
        className="mx-auto grid max-w-6xl items-center gap-14 py-20 lg:grid-cols-[1.08fr_0.92fr] lg:py-28"
      >
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-surface px-4 py-2 text-sm text-muted shadow-sm">
            <ShieldCheck aria-hidden="true" className="size-4 text-brand" />
            Fundaciones listas para crecer con seguridad
          </div>
          <h1 className="max-w-3xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            Tu residencial, <span className="text-brand">en orden.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-balance text-lg leading-8 text-muted">
            Vela convertirá reportes, avisos y seguimiento en una experiencia
            clara para toda la comunidad. La base técnica del producto ya está
            preparada.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <a href="#fundaciones">
                Ver fundaciones{" "}
                <ArrowRight aria-hidden="true" className="size-4" />
              </a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="/api/health">Estado técnico</a>
            </Button>
          </div>
        </div>

        <div
          id="fundaciones"
          className="rounded-xl border bg-surface p-6 shadow-lg sm:p-8"
        >
          <div className="mb-7 flex items-center justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-faint">
                VELA · SPRINT 0
              </p>
              <h2 className="mt-2 text-2xl font-semibold">Base del producto</h2>
            </div>
            <span className="grid size-12 place-items-center rounded-full bg-vela-soft text-vela">
              <Flame aria-hidden="true" className="size-6" />
            </span>
          </div>
          <ul className="space-y-3">
            {foundations.map((foundation) => (
              <li
                key={foundation}
                className="flex min-h-11 items-center gap-3 rounded-lg bg-background px-4 py-3"
              >
                <CheckCircle2
                  aria-hidden="true"
                  className="size-5 shrink-0 text-success"
                />
                <span className="text-sm font-medium sm:text-base">
                  {foundation}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-6 border-t pt-5 text-sm leading-6 text-muted">
            Menos WhatsApp, más control. Las funciones de acceso, reportes y
            administración se construirán en los siguientes sprints.
          </p>
        </div>
      </section>
    </main>
  );
}

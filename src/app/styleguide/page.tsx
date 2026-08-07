import { Priority, TicketStatus } from "@prisma/client";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Flame,
  Home,
  Info,
  Search,
  Settings2,
  TicketCheck,
  UsersRound,
} from "lucide-react";
import type { ReactNode } from "react";

import { PriorityTag } from "@/components/tickets/priority-tag";
import { TicketStatusBadge } from "@/components/tickets/ticket-status-badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { SurfacePanel } from "@/components/ui/surface-panel";

const COLORS = [
  { name: "brand", variable: "--color-brand", value: "#1E6F5C" },
  { name: "vela", variable: "--color-vela", value: "#F4A93B" },
  { name: "ink", variable: "--color-ink", value: "#161B22" },
  { name: "muted", variable: "--color-muted", value: "#5B6573" },
  { name: "background", variable: "--color-bg", value: "#F7F8FA" },
  { name: "surface", variable: "--color-surface", value: "#FFFFFF" },
  { name: "success", variable: "--color-success", value: "#2E9E6B" },
  { name: "warning", variable: "--color-warning", value: "#E0A030" },
  { name: "danger", variable: "--color-danger", value: "#B93434" },
  { name: "info", variable: "--color-info", value: "#3A7BD5" },
] as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      className="mb-14"
      aria-labelledby={`section-${title.replaceAll(" ", "-").toLowerCase()}`}
    >
      <h2
        id={`section-${title.replaceAll(" ", "-").toLowerCase()}`}
        className="mb-6 text-2xl font-semibold"
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function StyleGuidePage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-14">
      <header className="mb-12">
        <div className="flex items-center gap-3 text-brand">
          <Flame className="size-8" aria-hidden="true" />
          <span className="font-mono text-xs uppercase tracking-widest">
            Design system vivo
          </span>
        </div>
        <h1 className="mt-4 text-4xl font-semibold">Vela · Styleguide</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Fuente de verdad visual y accesible para componentes, estados y tokens
          de la aplicación.
        </p>
      </header>

      <Section title="1. Colores">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {COLORS.map((color) => (
            <article
              key={color.name}
              className="rounded-xl border bg-surface p-3 shadow-sm"
            >
              <div
                className="h-16 rounded-md border"
                style={{ background: `var(${color.variable})` }}
              />
              <p className="mt-2 text-sm font-medium">{color.name}</p>
              <p className="font-mono text-xs text-muted">{color.value}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section title="2. Tipografía">
        <SurfacePanel className="space-y-3">
          <p className="text-4xl font-semibold">Título hero · 36px</p>
          <p className="text-3xl font-semibold">Título de página · 30px</p>
          <p className="text-2xl font-semibold">Sección · 24px</p>
          <p className="text-lg">Subtítulo · 18px</p>
          <p className="text-base">Cuerpo · 16px</p>
          <p className="text-sm text-muted">Secundario · 14px</p>
          <p className="font-mono text-sm text-muted">
            #0042 · métricas y datos
          </p>
        </SurfacePanel>
      </Section>

      <Section title="3. Botones">
        <SurfacePanel className="flex flex-wrap gap-3">
          <Button>Enviar reporte</Button>
          <Button variant="outline">Cancelar</Button>
          <Button variant="ghost">Ver más</Button>
          <Button variant="destructive">Eliminar</Button>
          <Button disabled>Cargando…</Button>
          <Button size="icon" aria-label="Buscar">
            <Search className="size-4" />
          </Button>
        </SurfacePanel>
      </Section>

      <Section title="4. Formularios">
        <SurfacePanel className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">
            Nombre
            <input
              className="mt-2 min-h-11 w-full rounded-md border bg-background px-3"
              placeholder="Nombre completo"
            />
          </label>
          <label className="text-sm font-medium">
            Categoría
            <select className="mt-2 min-h-11 w-full rounded-md border bg-background px-3">
              <option>Seguridad</option>
              <option>Mantenimiento</option>
            </select>
          </label>
          <label className="text-sm font-medium sm:col-span-2">
            Descripción
            <textarea className="mt-2 min-h-28 w-full rounded-md border bg-background p-3" />
            <span className="mt-1 block text-xs font-normal text-muted">
              Explica qué sucede y dónde.
            </span>
          </label>
          <label className="text-sm font-medium">
            Campo con error
            <input
              aria-invalid="true"
              aria-describedby="field-error"
              className="mt-2 min-h-11 w-full rounded-md border border-danger bg-background px-3"
            />
            <span
              id="field-error"
              className="mt-1 block text-xs font-normal text-danger"
            >
              Este dato es obligatorio.
            </span>
          </label>
          <label className="flex min-h-11 items-center gap-2 self-end text-sm">
            <input type="checkbox" defaultChecked /> Recibir notificaciones
          </label>
        </SurfacePanel>
      </Section>

      <Section title="5. Badges y prioridades">
        <SurfacePanel className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {Object.values(TicketStatus).map((status) => (
              <TicketStatusBadge key={status} status={status} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.values(Priority).map((priority) => (
              <PriorityTag key={priority} priority={priority} />
            ))}
          </div>
        </SurfacePanel>
      </Section>

      <Section title="6. Tarjetas y paneles">
        <div className="grid gap-4 sm:grid-cols-3">
          <SurfacePanel>
            <p className="text-sm text-muted">Tickets abiertos</p>
            <p className="mt-2 font-mono text-3xl font-semibold">24</p>
          </SurfacePanel>
          <SurfacePanel className="shadow-md">
            <p className="text-sm text-muted">SLA cumplido</p>
            <p className="mt-2 font-mono text-3xl font-semibold text-success">
              91%
            </p>
          </SurfacePanel>
          <SurfacePanel className="border-danger/40">
            <p className="text-sm text-muted">En riesgo</p>
            <p className="mt-2 font-mono text-3xl font-semibold text-danger">
              3
            </p>
          </SurfacePanel>
        </div>
      </Section>

      <Section title="7. Notificaciones">
        <div className="grid gap-4 sm:grid-cols-2">
          <div
            className="rounded-xl border border-success/30 bg-success/10 p-4"
            role="status"
          >
            <p className="flex items-center gap-2 font-semibold text-success">
              <CheckCircle2 className="size-5" /> Reporte enviado
            </p>
            <p className="mt-1 text-sm">
              Te avisaremos cuando cambie de estado.
            </p>
          </div>
          <article className="rounded-xl border border-brand/40 bg-surface p-4 shadow-sm">
            <p className="flex items-center gap-2 text-xs font-semibold text-brand">
              <Bell className="size-4" /> AVISO
            </p>
            <h3 className="mt-2 font-semibold">Mantenimiento programado</h3>
            <p className="mt-1 text-sm text-muted">
              El acceso norte cerrará de 9 a 11 h.
            </p>
          </article>
        </div>
      </Section>

      <Section title="8. Estados">
        <div className="grid gap-4 lg:grid-cols-3">
          <EmptyState
            icon={<TicketCheck className="size-8" />}
            title="Sin reportes"
            description="Aún no tienes reportes. Crea el primero para dar seguimiento."
            action={<Button>Crear reporte</Button>}
          />
          <SurfacePanel aria-label="Contenido cargando" aria-busy="true">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="mt-4 h-8 w-4/5" />
            <Skeleton className="mt-4 h-24" />
          </SurfacePanel>
          <div className="rounded-xl border border-danger/30 bg-danger/5 p-6">
            <AlertTriangle className="size-7 text-danger" />
            <h3 className="mt-3 font-semibold">No pudimos cargar los datos</h3>
            <p className="mt-2 text-sm text-muted">
              Intenta nuevamente. Tus cambios guardados están seguros.
            </p>
            <Button className="mt-5" variant="outline">
              Reintentar
            </Button>
          </div>
        </div>
      </Section>

      <Section title="9. Iconografía">
        <SurfacePanel className="grid grid-cols-4 gap-5 text-center text-xs text-muted sm:grid-cols-8">
          {[
            Flame,
            Home,
            TicketCheck,
            Bell,
            UsersRound,
            Settings2,
            Info,
            CheckCircle2,
          ].map((Icon, index) => (
            <div key={index} className="grid place-items-center gap-2">
              <Icon className="size-6 text-ink" aria-hidden="true" />
              <span>24px</span>
            </div>
          ))}
        </SurfacePanel>
      </Section>

      <Section title="10. Espaciado y radios">
        <SurfacePanel>
          <div className="flex flex-wrap items-end gap-5">
            {[4, 8, 12, 16, 24, 32, 48, 64].map((size) => (
              <div key={size} className="text-center">
                <div
                  className="mx-auto bg-brand"
                  style={{ width: size, height: size }}
                />
                <p className="mt-2 font-mono text-xs">{size}px</p>
              </div>
            ))}
          </div>
          <div className="mt-8 grid grid-cols-5 gap-3">
            {[
              ["sm", "rounded-sm"],
              ["md", "rounded-md"],
              ["lg", "rounded-lg"],
              ["xl", "rounded-xl"],
              ["full", "rounded-full"],
            ].map(([radius, className]) => (
              <div
                key={radius}
                className={`grid h-20 place-items-center border-2 border-brand bg-brand-soft text-xs font-medium ${className}`}
              >
                {radius}
              </div>
            ))}
          </div>
        </SurfacePanel>
      </Section>
    </main>
  );
}

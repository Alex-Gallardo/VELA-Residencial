import { Flame, Home, MailPlus, TicketCheck } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-background px-5 py-6 sm:px-10">
      <nav className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
        <Link
          className="flex min-h-11 items-center gap-2 font-semibold"
          href="/admin/tickets"
        >
          <span className="grid size-10 place-items-center rounded-full bg-brand text-white">
            <Flame className="size-5" aria-hidden="true" />
          </span>
          Vela Admin
        </Link>
        <div className="flex flex-wrap gap-2 text-sm font-medium">
          <Link
            className="flex min-h-11 items-center gap-2 rounded-md border bg-surface px-3"
            href="/admin/tickets"
          >
            <TicketCheck className="size-4" aria-hidden="true" /> Tickets
          </Link>
          <Link
            className="flex min-h-11 items-center gap-2 rounded-md border bg-surface px-3"
            href="/admin/invitaciones"
          >
            <MailPlus className="size-4" aria-hidden="true" /> Invitaciones
          </Link>
          <Link
            className="flex min-h-11 items-center gap-2 rounded-md border bg-surface px-3"
            href="/inicio"
          >
            <Home className="size-4" aria-hidden="true" /> Inicio
          </Link>
        </div>
      </nav>
      <div className="mx-auto mt-9 max-w-7xl">{children}</div>
    </main>
  );
}

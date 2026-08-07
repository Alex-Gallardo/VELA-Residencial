import {
  Flame,
  Home,
  Images,
  LogOut,
  MailPlus,
  Megaphone,
  TicketCheck,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { can, type PermissionUser } from "@/lib/permissions";
import { logoutAction } from "@/server/actions/auth";

export function AdminShell({
  children,
  permissions,
}: {
  children: ReactNode;
  permissions: PermissionUser;
}) {
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
          {can(permissions, "read", "moderation") && (
            <Link
              className="flex min-h-11 items-center gap-2 rounded-md border bg-surface px-3"
              href="/admin/moderacion"
            >
              <Images className="size-4" aria-hidden="true" /> Moderación
            </Link>
          )}
          {can(permissions, "read", "ticket") && (
            <Link
              className="flex min-h-11 items-center gap-2 rounded-md border bg-surface px-3"
              href="/admin/tickets"
            >
              <TicketCheck className="size-4" aria-hidden="true" /> Tickets
            </Link>
          )}
          {can(permissions, "create", "notice") && (
            <Link
              className="flex min-h-11 items-center gap-2 rounded-md border bg-surface px-3"
              href="/admin/avisos"
            >
              <Megaphone className="size-4" aria-hidden="true" /> Avisos
            </Link>
          )}
          {can(permissions, "invite", "invitation") && (
            <Link
              className="flex min-h-11 items-center gap-2 rounded-md border bg-surface px-3"
              href="/admin/invitaciones"
            >
              <MailPlus className="size-4" aria-hidden="true" /> Invitaciones
            </Link>
          )}
          <Link
            className="flex min-h-11 items-center gap-2 rounded-md border bg-surface px-3"
            href="/inicio"
          >
            <Home className="size-4" aria-hidden="true" /> Inicio
          </Link>
          <form action={logoutAction}>
            <button className="flex min-h-11 items-center gap-2 rounded-md border bg-surface px-3">
              <LogOut className="size-4" aria-hidden="true" /> Salir
            </button>
          </form>
        </div>
      </nav>
      <div className="mx-auto mt-9 max-w-7xl">{children}</div>
    </main>
  );
}

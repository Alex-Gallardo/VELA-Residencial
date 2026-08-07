import {
  BookOpenText,
  ChartNoAxesCombined,
  Flame,
  Home,
  Images,
  ListChecks,
  LogOut,
  Megaphone,
  Settings2,
  TicketCheck,
  UserCog,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { can, type PermissionUser } from "@/lib/permissions";
import { logoutAction } from "@/server/actions/auth";

type NavItem = {
  href: string;
  label: string;
  icon: typeof Home;
  visible: boolean;
};

export function AdminShell({
  children,
  permissions,
}: {
  children: ReactNode;
  permissions: PermissionUser;
}) {
  const items: NavItem[] = [
    {
      href: "/admin",
      label: "Dashboard",
      icon: ChartNoAxesCombined,
      visible: can(permissions, "read", "tenant"),
    },
    {
      href: "/admin/tickets",
      label: "Tickets",
      icon: TicketCheck,
      visible: can(permissions, "read", "ticket"),
    },
    {
      href: "/admin/moderacion",
      label: "Moderación",
      icon: Images,
      visible: can(permissions, "read", "moderation"),
    },
    {
      href: "/admin/avisos",
      label: "Avisos",
      icon: Megaphone,
      visible: can(permissions, "create", "notice"),
    },
    {
      href: "/admin/residentes",
      label: "Residentes",
      icon: UsersRound,
      visible: can(permissions, "create", "membership"),
    },
    {
      href: "/admin/usuarios",
      label: "Usuarios",
      icon: UserCog,
      visible: can(permissions, "manage_roles", "membership"),
    },
    {
      href: "/admin/auditoria",
      label: "Auditoría",
      icon: ListChecks,
      visible: can(permissions, "audit", "audit_log"),
    },
    {
      href: "/admin/configuracion",
      label: "Configuración",
      icon: Settings2,
      visible: can(permissions, "update", "tenant"),
    },
    {
      href: "/admin/documentos",
      label: "Documentos",
      icon: BookOpenText,
      visible: can(permissions, "create", "document"),
    },
  ];

  return (
    <main className="min-h-screen bg-background px-4 py-5 sm:px-8">
      <a className="skip-link" href="#admin-content">
        Saltar al contenido
      </a>
      <nav
        aria-label="Administración"
        className="mx-auto max-w-7xl rounded-xl border bg-surface p-3 shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            className="flex min-h-11 items-center gap-2 px-2 font-semibold"
            href="/admin"
          >
            <span className="grid size-10 place-items-center rounded-full bg-brand text-white">
              <Flame className="size-5" aria-hidden="true" />
            </span>
            Vela Admin
          </Link>
          <div className="flex gap-2">
            <Link
              className="grid size-11 place-items-center rounded-md border bg-background"
              href="/inicio"
              aria-label="Ir a la aplicación de residentes"
            >
              <Home className="size-4" aria-hidden="true" />
            </Link>
            <form action={logoutAction}>
              <button
                className="grid size-11 place-items-center rounded-md border bg-background"
                aria-label="Cerrar sesión"
              >
                <LogOut className="size-4" aria-hidden="true" />
              </button>
            </form>
          </div>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 text-sm font-medium">
          {items
            .filter(({ visible }) => visible)
            .map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                className="flex min-h-11 shrink-0 items-center gap-2 rounded-md border bg-background px-3 transition-colors hover:bg-brand-soft hover:text-brand"
                href={href}
              >
                <Icon className="size-4" aria-hidden="true" /> {label}
              </Link>
            ))}
        </div>
      </nav>
      <div id="admin-content" className="mx-auto mt-7 max-w-7xl">
        {children}
      </div>
    </main>
  );
}

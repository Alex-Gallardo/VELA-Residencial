import {
  BookOpenText,
  ClipboardList,
  Flame,
  Home,
  LogOut,
  Megaphone,
  PlusCircle,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { NotificationRealtimeBridge } from "@/components/notifications/notification-realtime-bridge";
import { getAuthContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { logoutAction } from "@/server/actions/auth";

const navigation = [
  { href: "/inicio", label: "Inicio", icon: Home, key: "inicio" },
  { href: "/avisos", label: "Avisos", icon: Megaphone, key: "avisos" },
  {
    href: "/reportes",
    label: "Mis reportes",
    icon: ClipboardList,
    key: "reportes",
  },
  {
    href: "/reportes/nuevo",
    label: "Reportar",
    icon: PlusCircle,
    key: "nuevo",
  },
  {
    href: "/reglamento",
    label: "Reglamento",
    icon: BookOpenText,
    key: "reglamento",
  },
] as const;

export async function ResidentShell({
  children,
  active,
}: {
  children: ReactNode;
  active:
    | "inicio"
    | "avisos"
    | "notificaciones"
    | "reportes"
    | "nuevo"
    | "reglamento"
    | "perfil";
}) {
  const context = await getAuthContext();
  const unreadCount =
    context?.user && context.membership
      ? await db.notification.count({
          where: {
            tenantId: context.membership.tenantId,
            userId: context.user.id,
            channel: "IN_APP",
            readAt: null,
          },
        })
      : 0;
  return (
    <main className="min-h-screen bg-background px-5 py-6 pb-28 sm:px-10 sm:pb-10">
      <a className="skip-link" href="#resident-content">
        Saltar al contenido
      </a>
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <Link
          className="flex min-h-11 items-center gap-2 font-semibold"
          href="/inicio"
        >
          <span className="grid size-10 place-items-center rounded-full bg-brand text-white">
            <Flame className="size-5" aria-hidden="true" />
          </span>
          Vela
        </Link>
        <Link
          className={`grid size-11 place-items-center rounded-md border bg-surface sm:hidden ${active === "perfil" ? "text-brand" : ""}`}
          href="/perfil"
          aria-label="Perfil y preferencias"
        >
          <UserRound className="size-5" aria-hidden="true" />
        </Link>
        <div className="hidden items-center gap-2 sm:flex">
          {navigation.map(({ href, label, key }) => (
            <Link
              key={href}
              className={`min-h-11 rounded-md px-4 py-3 text-sm font-medium ${
                active === key ? "bg-brand-soft text-brand" : "text-muted"
              }`}
              href={href}
            >
              {label}
            </Link>
          ))}
          {context?.user && (
            <NotificationRealtimeBridge
              userId={context.user.id}
              initialUnreadCount={unreadCount}
            />
          )}
          <Link
            className={`grid size-11 place-items-center rounded-md border bg-surface ${active === "perfil" ? "text-brand" : ""}`}
            href="/perfil"
            aria-label="Perfil y preferencias"
          >
            <UserRound className="size-5" aria-hidden="true" />
          </Link>
          <form action={logoutAction}>
            <button className="flex min-h-11 items-center gap-2 rounded-md border bg-surface px-4 text-sm font-medium">
              <LogOut className="size-4" aria-hidden="true" /> Salir
            </button>
          </form>
        </div>
      </nav>

      <div id="resident-content" className="mx-auto mt-10 max-w-6xl">
        {children}
      </div>

      <nav
        aria-label="Navegación de residente"
        className="fixed inset-x-3 bottom-3 z-20 grid grid-cols-6 rounded-xl border bg-surface/95 p-2 shadow-lg backdrop-blur sm:hidden"
      >
        {navigation.map(({ href, label, icon: Icon, key }) => (
          <Link
            key={href}
            className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-md text-xs font-medium ${
              active === key ? "bg-brand-soft text-brand" : "text-muted"
            }`}
            href={href}
          >
            <Icon className="size-5" aria-hidden="true" /> {label}
          </Link>
        ))}
        {context?.user && (
          <NotificationRealtimeBridge
            userId={context.user.id}
            initialUnreadCount={unreadCount}
            mobile
            active={active === "notificaciones"}
            subscribe={false}
          />
        )}
      </nav>
    </main>
  );
}

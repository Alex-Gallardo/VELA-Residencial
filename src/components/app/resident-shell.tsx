import { ClipboardList, Flame, Home, LogOut, PlusCircle } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { logoutAction } from "@/server/actions/auth";

const navigation = [
  { href: "/inicio", label: "Inicio", icon: Home },
  { href: "/reportes", label: "Mis reportes", icon: ClipboardList },
  { href: "/reportes/nuevo", label: "Reportar", icon: PlusCircle },
];

export function ResidentShell({
  children,
  active,
}: {
  children: ReactNode;
  active: "inicio" | "reportes" | "nuevo";
}) {
  return (
    <main className="min-h-screen bg-background px-5 py-6 pb-28 sm:px-10 sm:pb-10">
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
        <div className="hidden items-center gap-2 sm:flex">
          {navigation.map(({ href, label }) => (
            <Link
              key={href}
              className={`min-h-11 rounded-md px-4 py-3 text-sm font-medium ${
                active ===
                (href.endsWith("nuevo")
                  ? "nuevo"
                  : href === "/inicio"
                    ? "inicio"
                    : "reportes")
                  ? "bg-brand-soft text-brand"
                  : "text-muted"
              }`}
              href={href}
            >
              {label}
            </Link>
          ))}
          <form action={logoutAction}>
            <button className="flex min-h-11 items-center gap-2 rounded-md border bg-surface px-4 text-sm font-medium">
              <LogOut className="size-4" aria-hidden="true" /> Salir
            </button>
          </form>
        </div>
      </nav>

      <div className="mx-auto mt-10 max-w-6xl">{children}</div>

      <nav
        aria-label="Navegación de residente"
        className="fixed inset-x-3 bottom-3 z-20 grid grid-cols-3 rounded-xl border bg-surface/95 p-2 shadow-lg backdrop-blur sm:hidden"
      >
        {navigation.map(({ href, label, icon: Icon }) => {
          const key = href.endsWith("nuevo")
            ? "nuevo"
            : href === "/inicio"
              ? "inicio"
              : "reportes";
          return (
            <Link
              key={href}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-md text-xs font-medium ${
                active === key ? "bg-brand-soft text-brand" : "text-muted"
              }`}
              href={href}
            >
              <Icon className="size-5" aria-hidden="true" /> {label}
            </Link>
          );
        })}
      </nav>
    </main>
  );
}

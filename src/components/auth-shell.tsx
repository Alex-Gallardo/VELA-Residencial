import { Flame } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <section className="w-full max-w-md rounded-xl border bg-surface p-6 shadow-lg sm:p-8">
        <Link
          className="mb-8 inline-flex items-center gap-2 font-semibold"
          href="/"
        >
          <span className="grid size-10 place-items-center rounded-full bg-brand text-white">
            <Flame aria-hidden="true" className="size-5" />
          </span>
          Vela
        </Link>
        <p className="font-mono text-xs uppercase tracking-widest text-brand">
          {eyebrow}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-muted">{description}</p>
        <div className="mt-7">{children}</div>
      </section>
    </main>
  );
}

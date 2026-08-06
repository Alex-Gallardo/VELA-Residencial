"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body className="grid min-h-screen place-items-center bg-background p-6 text-ink">
        <main className="max-w-md rounded-xl border bg-surface p-8 text-center shadow-md">
          <h1 className="text-2xl font-semibold">Algo no salió bien</h1>
          <p className="mt-3 text-muted">
            El error quedó registrado. Puedes intentar cargar esta vista de
            nuevo.
          </p>
          <button
            className="mt-6 min-h-11 rounded-md bg-brand px-5 font-medium text-white hover:bg-brand-hover"
            onClick={reset}
            type="button"
          >
            Intentar de nuevo
          </button>
        </main>
      </body>
    </html>
  );
}

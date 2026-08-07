import { BookOpenText, ExternalLink, PhoneCall } from "lucide-react";
import { redirect } from "next/navigation";

import { ResidentShell } from "@/components/app/resident-shell";
import { getAuthContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";

export default async function RegulationsPage() {
  const context = await getAuthContext();
  if (!context?.user) redirect("/login?next=/reglamento");
  if (!context.membership || !can(context.membership, "read", "document"))
    redirect("/inicio?denied=1");
  const now = new Date();
  const [documents, settings] = await Promise.all([
    db.document.findMany({
      where: {
        tenantId: context.membership.tenantId,
        isCurrent: true,
        publishedAt: { lte: now },
      },
      orderBy: [{ category: "asc" }, { title: "asc" }],
    }),
    db.tenantSettings.findUnique({
      where: { tenantId: context.membership.tenantId },
      select: { emergencyContacts: true },
    }),
  ]);

  return (
    <ResidentShell active="reglamento">
      <header>
        <p className="font-mono text-xs uppercase tracking-widest text-brand">
          Información oficial
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Reglamento y documentos</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Consulta siempre la versión vigente publicada por la administración.
        </p>
      </header>
      {settings?.emergencyContacts.length ? (
        <aside
          className="mt-6 rounded-xl border border-danger/30 bg-danger/5 p-5"
          aria-labelledby="emergency-title"
        >
          <div className="flex items-center gap-2 text-danger">
            <PhoneCall className="size-5" aria-hidden="true" />
            <h2 id="emergency-title" className="font-semibold">
              Contactos de emergencia
            </h2>
          </div>
          <p className="mt-2 text-sm text-muted">
            Vela no sustituye los números de emergencia. En incidentes graves
            utiliza estos protocolos:
          </p>
          <ul className="mt-3 space-y-1 text-sm font-medium">
            {settings.emergencyContacts.map((contact) => (
              <li key={contact}>{contact}</li>
            ))}
          </ul>
        </aside>
      ) : null}
      <section
        className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        aria-label="Documentos vigentes"
      >
        {documents.length === 0 && (
          <div className="rounded-xl border bg-surface p-10 text-center sm:col-span-2 lg:col-span-3">
            <BookOpenText
              className="mx-auto size-10 text-faint"
              aria-hidden="true"
            />
            <h2 className="mt-4 text-lg font-semibold">
              Aún no hay documentos publicados
            </h2>
            <p className="mt-2 text-sm text-muted">
              La administración los mostrará aquí cuando estén vigentes.
            </p>
          </div>
        )}
        {documents.map((document) => (
          <article
            key={document.id}
            className="flex flex-col rounded-xl border bg-surface p-5 shadow-sm"
          >
            <BookOpenText className="size-7 text-brand" aria-hidden="true" />
            <p className="mt-4 text-xs font-semibold text-brand">
              {document.category} · versión {document.version}
            </p>
            <h2 className="mt-1 text-lg font-semibold">{document.title}</h2>
            <p className="mt-2 text-xs text-muted">
              Publicado {document.publishedAt.toLocaleDateString("es-GT")}
            </p>
            <a
              className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-white"
              href={`/api/documents/${document.id}`}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="size-4" aria-hidden="true" /> Abrir PDF
            </a>
          </article>
        ))}
      </section>
    </ResidentShell>
  );
}

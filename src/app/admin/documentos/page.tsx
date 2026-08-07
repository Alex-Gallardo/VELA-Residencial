import { BookOpenText, ExternalLink } from "lucide-react";
import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { ConfirmSubmitButton } from "@/components/admin/confirm-submit-button";
import { DocumentUploader } from "@/components/documents/document-uploader";
import { FormMessage } from "@/components/form-message";
import { getAuthContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { archiveDocumentAction } from "@/server/actions/documents";

export default async function DocumentsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const [context, query] = await Promise.all([getAuthContext(), searchParams]);
  if (!context?.user) redirect("/login?next=/admin/documentos");
  if (!context.membership || !can(context.membership, "create", "document"))
    redirect("/inicio?denied=1");
  const documents = await db.document.findMany({
    where: { tenantId: context.membership.tenantId },
    include: { uploadedBy: { select: { fullName: true, email: true } } },
    orderBy: [{ isCurrent: "desc" }, { publishedAt: "desc" }],
  });
  const current = documents.filter(({ isCurrent }) => isCurrent);

  return (
    <AdminShell permissions={context.membership}>
      <header>
        <p className="font-mono text-xs uppercase tracking-widest text-brand">
          Biblioteca privada
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Reglamento y documentos</h1>
        <p className="mt-2 text-sm text-muted">
          Cada carga crea una versión inmutable; sólo la vigente aparece a
          residentes.
        </p>
      </header>
      <div className="mt-5">
        <FormMessage error={query.error} message={query.message} />
      </div>
      <div className="mt-7 grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
        <section className="rounded-xl border bg-surface p-6 shadow-sm">
          <BookOpenText className="size-7 text-brand" aria-hidden="true" />
          <h2 className="mt-3 text-xl font-semibold">Publicar PDF</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            La carga usa una URL firmada y el servidor valida tamaño y firma PDF
            antes de publicarla.
          </p>
          <div className="mt-5">
            <DocumentUploader
              series={current.map(({ seriesId, title, version }) => ({
                seriesId,
                title,
                version,
              }))}
            />
          </div>
        </section>
        <section className="rounded-xl border bg-surface p-6 shadow-sm">
          <h2 className="text-xl font-semibold">
            Versiones ({documents.length})
          </h2>
          <div className="mt-5 space-y-3">
            {documents.length === 0 && (
              <p className="rounded-md bg-background p-6 text-center text-sm text-muted">
                Aún no hay documentos. Publica el primer reglamento.
              </p>
            )}
            {documents.map((document) => (
              <article
                key={document.id}
                className={`rounded-md border p-4 ${document.isCurrent ? "border-brand/40" : "opacity-70"}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-brand">
                      {document.category} · v{document.version}{" "}
                      {document.isCurrent ? "· Vigente" : "· Histórica"}
                    </p>
                    <h3 className="mt-1 font-semibold">{document.title}</h3>
                    <p className="mt-2 text-xs text-muted">
                      {(document.sizeBytes / 1024 / 1024).toFixed(2)} MB ·{" "}
                      {document.uploadedBy?.fullName ??
                        document.uploadedBy?.email ??
                        "Sistema"}{" "}
                      · {document.publishedAt.toLocaleString("es-GT")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a
                      className="inline-flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm font-medium"
                      href={`/api/documents/${document.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink className="size-4" aria-hidden="true" />{" "}
                      Abrir
                    </a>
                    {document.isCurrent && (
                      <form action={archiveDocumentAction}>
                        <input
                          type="hidden"
                          name="documentId"
                          value={document.id}
                        />
                        <ConfirmSubmitButton
                          className="text-danger"
                          confirmation={`Archivar ${document.title}? Dejará de estar disponible para residentes.`}
                        >
                          Archivar
                        </ConfirmSubmitButton>
                      </form>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}

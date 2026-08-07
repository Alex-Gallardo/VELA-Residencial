"use client";

import { FileUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useRef, useState } from "react";

import {
  DOCUMENT_CATEGORIES,
  MAX_DOCUMENT_BYTES,
} from "@/lib/validations/document";
import {
  completeDocumentUploadAction,
  prepareDocumentUploadAction,
} from "@/server/actions/documents";

const categoryLabels: Record<(typeof DOCUMENT_CATEGORIES)[number], string> = {
  REGLAMENTO: "Reglamento",
  POLITICA: "Política",
  ACTA: "Acta",
  PROTOCOLO: "Protocolo",
};

export function DocumentUploader({
  series,
}: {
  series: Array<{ seriesId: string; title: string; version: number }>;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) {
      setMessage("Selecciona un PDF.");
      return;
    }
    if (file.type !== "application/pdf" || file.size > MAX_DOCUMENT_BYTES) {
      setMessage("El archivo debe ser PDF y pesar como máximo 10 MB.");
      return;
    }
    const base = {
      title: String(form.get("title") ?? ""),
      category: String(form.get("category") ?? ""),
      seriesId: String(form.get("seriesId") ?? "") || undefined,
      fileName: file.name,
      mimeType: "application/pdf" as const,
      sizeBytes: file.size,
    };
    setPending(true);
    setMessage("Preparando carga privada…");
    try {
      const prepared = await prepareDocumentUploadAction(base);
      if (prepared.error || !prepared.upload)
        throw new Error(prepared.error ?? "No se pudo preparar la carga.");
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      setMessage("Subiendo PDF…");
      const { error } = await supabase.storage
        .from("documents")
        .uploadToSignedUrl(prepared.upload.path, prepared.upload.token, file, {
          contentType: file.type,
          upsert: false,
        });
      if (error) throw new Error("No se pudo subir el PDF.");
      setMessage("Validando y publicando…");
      const completed = await completeDocumentUploadAction({
        ...base,
        seriesId: prepared.upload.seriesId,
        storageKey: prepared.upload.storageKey,
      });
      if (completed.error) throw new Error(completed.error);
      formRef.current?.reset();
      setMessage("Documento publicado correctamente.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "No se pudo publicar el PDF.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      <label className="block text-sm font-medium">
        Publicación
        <select
          className="mt-2 min-h-11 w-full rounded-md border bg-background px-3"
          name="seriesId"
          defaultValue=""
        >
          <option value="">Documento nuevo</option>
          {series.map((item) => (
            <option key={item.seriesId} value={item.seriesId}>
              Nueva versión de {item.title} (actual v{item.version})
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium">
        Título
        <input
          className="mt-2 min-h-11 w-full rounded-md border bg-background px-3"
          name="title"
          minLength={3}
          maxLength={160}
          required
        />
      </label>
      <label className="block text-sm font-medium">
        Categoría
        <select
          className="mt-2 min-h-11 w-full rounded-md border bg-background px-3"
          name="category"
          defaultValue="REGLAMENTO"
        >
          {DOCUMENT_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {categoryLabels[category]}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium">
        Archivo PDF
        <input
          className="mt-2 min-h-11 w-full rounded-md border bg-background p-2 text-sm"
          name="file"
          type="file"
          accept="application/pdf,.pdf"
          required
        />
        <span className="mt-1 block text-xs font-normal text-muted">
          PDF privado, máximo 10 MB.
        </span>
      </label>
      <button
        disabled={pending}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-white disabled:opacity-60"
      >
        <FileUp className="size-4" aria-hidden="true" />{" "}
        {pending ? "Publicando…" : "Publicar documento"}
      </button>
      <p className="min-h-5 text-sm text-muted" aria-live="polite">
        {message}
      </p>
    </form>
  );
}

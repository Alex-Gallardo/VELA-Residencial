"use client";

import type { TicketCategory } from "@prisma/client";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  MapPin,
  Send,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";

import { ticketCategoryLabels } from "@/config/tickets";
import { capture } from "@/lib/analytics";
import {
  createTicketAction,
  type CreateTicketActionState,
} from "@/server/actions/tickets";
import { useDraftReportStore } from "@/stores/draft-report-store";

const initialActionState: CreateTicketActionState = {};

export function CreateTicketWizard({
  dwellingId,
  dwellingCode,
  categories,
}: {
  dwellingId: string;
  dwellingCode: string;
  categories: Array<{ category: TicketCategory; slaHours: number }>;
}) {
  const router = useRouter();
  const draft = useDraftReportStore();
  const handledTicketId = useRef<string | undefined>(undefined);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [clientError, setClientError] = useState<string>();
  const [state, formAction, pending] = useActionState(
    createTicketAction,
    initialActionState,
  );

  useEffect(() => {
    let active = true;
    void Promise.resolve(useDraftReportStore.persist.rehydrate()).then(() => {
      if (active) setHasHydrated(true);
    });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => capture("report_flow_opened"), []);
  useEffect(() => {
    if (!state.success || !state.ticketId) return;
    if (handledTicketId.current === state.ticketId) return;
    handledTicketId.current = state.ticketId;
    capture("ticket_created", {
      number: state.number ?? 0,
      category: state.category ?? "OTRO",
    });
    draft.clearDraft();
    router.push(`/reportes/${state.ticketId}?created=1`);
  }, [draft, router, state]);

  function continueToReview() {
    if (draft.title.trim().length < 5) {
      setClientError("Escribe un título de al menos 5 caracteres.");
      return;
    }
    if (draft.description.trim().length < 10) {
      setClientError("Describe el problema con al menos 10 caracteres.");
      return;
    }
    setClientError(undefined);
    draft.setDraft({ step: 3 });
  }

  if (!hasHydrated) {
    return (
      <section className="mx-auto max-w-2xl rounded-xl border bg-surface p-8 text-center text-sm text-muted shadow-md">
        Recuperando tu borrador…
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-2xl">
      <div className="mb-7 flex items-center justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-brand">
            Paso {draft.step} de 3
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Crear reporte
          </h1>
        </div>
        <span className="rounded-full border bg-surface px-3 py-2 text-xs text-muted">
          {dwellingCode}
        </span>
      </div>

      <div
        className="mb-7 grid grid-cols-3 gap-2"
        aria-label="Progreso del reporte"
      >
        {[1, 2, 3].map((step) => (
          <span
            key={step}
            className={`h-2 rounded-full ${draft.step >= step ? "bg-brand" : "bg-border"}`}
          />
        ))}
      </div>

      <form
        action={formAction}
        className="rounded-xl border bg-surface p-5 shadow-md sm:p-8"
      >
        <input type="hidden" name="category" value={draft.category ?? ""} />
        <input type="hidden" name="title" value={draft.title} />
        <input type="hidden" name="description" value={draft.description} />
        <input type="hidden" name="locationText" value={draft.locationText} />
        <input type="hidden" name="dwellingId" value={dwellingId} />

        {draft.step === 1 && (
          <fieldset>
            <legend className="text-xl font-semibold">
              ¿Qué necesitas reportar?
            </legend>
            <p className="mt-2 text-sm text-muted">
              Selecciona una categoría para continuar.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {categories.map(({ category, slaHours }) => (
                <button
                  key={category}
                  className="min-h-24 rounded-lg border bg-background p-4 text-left transition hover:border-brand hover:bg-brand-soft focus-visible:border-brand"
                  type="button"
                  onClick={() => draft.setDraft({ category, step: 2 })}
                >
                  <span className="block font-semibold">
                    {ticketCategoryLabels[category]}
                  </span>
                  <span className="mt-2 block text-xs text-muted">
                    SLA {slaHours} h
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {draft.step === 2 && (
          <div>
            <button
              className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm text-brand"
              type="button"
              onClick={() => draft.setDraft({ step: 1 })}
            >
              <ArrowLeft className="size-4" aria-hidden="true" /> Cambiar
              categoría
            </button>
            <h2 className="text-xl font-semibold">Cuéntanos qué sucede</h2>
            <div className="mt-6 space-y-5">
              <label className="block text-sm font-medium">
                Título breve
                <input
                  className="mt-2 min-h-11 w-full rounded-md border bg-background px-3"
                  value={draft.title}
                  maxLength={100}
                  placeholder="Ej. Luminaria apagada"
                  onChange={(event) =>
                    draft.setDraft({ title: event.target.value })
                  }
                />
              </label>
              <label className="block text-sm font-medium">
                Descripción
                <textarea
                  className="mt-2 min-h-32 w-full rounded-md border bg-background p-3"
                  value={draft.description}
                  maxLength={2000}
                  placeholder="Describe el problema y desde cuándo ocurre."
                  onChange={(event) =>
                    draft.setDraft({ description: event.target.value })
                  }
                />
              </label>
              <label className="block text-sm font-medium">
                <span className="inline-flex items-center gap-2">
                  <MapPin className="size-4 text-brand" aria-hidden="true" />{" "}
                  Ubicación adicional
                  <span className="font-normal text-muted">(opcional)</span>
                </span>
                <input
                  className="mt-2 min-h-11 w-full rounded-md border bg-background px-3"
                  value={draft.locationText}
                  maxLength={160}
                  placeholder="Ej. Entrada principal, junto al portón"
                  onChange={(event) =>
                    draft.setDraft({ locationText: event.target.value })
                  }
                />
              </label>
            </div>
            <p className="mt-4 text-xs text-muted" role="status">
              Borrador guardado automáticamente en este dispositivo.
            </p>
            {clientError && (
              <p className="mt-4 text-sm text-danger" role="alert">
                {clientError}
              </p>
            )}
            <button
              className="mt-7 flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-brand px-5 font-medium text-white"
              type="button"
              onClick={continueToReview}
            >
              Revisar reporte{" "}
              <ArrowRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        )}

        {draft.step === 3 && draft.category && (
          <div>
            <button
              className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm text-brand"
              type="button"
              onClick={() => draft.setDraft({ step: 2 })}
            >
              <ArrowLeft className="size-4" aria-hidden="true" /> Editar
              detalles
            </button>
            <div className="flex items-start gap-3">
              <CheckCircle2
                className="mt-1 size-6 shrink-0 text-success"
                aria-hidden="true"
              />
              <div>
                <h2 className="text-xl font-semibold">
                  Todo listo para enviar
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Revisa el resumen antes de confirmar.
                </p>
              </div>
            </div>
            <dl className="mt-7 space-y-4 rounded-lg bg-background p-5 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-faint">
                  Categoría
                </dt>
                <dd className="mt-1 font-medium">
                  {ticketCategoryLabels[draft.category]}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-faint">
                  Título
                </dt>
                <dd className="mt-1 font-medium">{draft.title}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-faint">
                  Descripción
                </dt>
                <dd className="mt-1 whitespace-pre-wrap leading-6">
                  {draft.description}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-faint">
                  Ubicación
                </dt>
                <dd className="mt-1">{draft.locationText || dwellingCode}</dd>
              </div>
            </dl>
            {state.error && (
              <p className="mt-4 text-sm text-danger" role="alert">
                {state.error}
              </p>
            )}
            <button
              className="mt-7 flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-brand px-5 font-medium text-white disabled:opacity-60"
              type="submit"
              disabled={pending}
            >
              <Send className="size-4" aria-hidden="true" />
              {pending ? "Enviando…" : "Enviar reporte"}
            </button>
          </div>
        )}
      </form>
    </section>
  );
}

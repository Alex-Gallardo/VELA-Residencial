"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  assignTicketSchema,
  createTicketSchema,
  ticketCommentSchema,
  transitionTicketSchema,
} from "@/lib/validations/ticket";
import { InvalidTicketTransitionError } from "@/server/services/ticket-state-machine";
import {
  addTicketComment,
  assignTicket,
  createTicket,
  findPotentialTicketDuplicate,
  TicketServiceError,
  transitionTicket,
} from "@/server/services/ticket-service";

export type CreateTicketActionState = {
  error?: string;
  success?: boolean;
  ticketId?: string;
  number?: number;
  category?: string;
  duplicate?: { id: string; number: number; title: string };
};

export async function createTicketAction(
  _previous: CreateTicketActionState,
  formData: FormData,
): Promise<CreateTicketActionState> {
  try {
    const context = await requirePermission("create", "ticket");
    const parsed = createTicketSchema.safeParse({
      category: formData.get("category"),
      title: formData.get("title"),
      description: formData.get("description"),
      locationText: formData.get("locationText") || undefined,
      dwellingId: formData.get("dwellingId"),
      attachmentId: formData.get("attachmentId") || undefined,
      duplicateOfId: formData.get("duplicateOfId") || undefined,
    });
    if (!parsed.success)
      return {
        error:
          parsed.error.issues[0]?.message ?? "Revisa los datos del reporte.",
      };

    if (!parsed.data.duplicateOfId) {
      const duplicate = await findPotentialTicketDuplicate(db, {
        tenantId: context.membership.tenantId,
        userId: context.user.id,
        category: parsed.data.category,
        dwellingId: parsed.data.dwellingId,
        title: parsed.data.title,
      });
      if (duplicate)
        return {
          error:
            "Encontramos un reporte parecido. Revísalo antes de confirmar otro.",
          duplicate,
        };
    }

    const ticket = await createTicket(db, {
      ...parsed.data,
      tenantId: context.membership.tenantId,
      userId: context.user.id,
    });
    revalidatePath("/inicio");
    revalidatePath("/reportes");
    revalidatePath("/admin/tickets");
    revalidatePath("/admin/moderacion");
    return {
      success: true,
      ticketId: ticket.id,
      number: ticket.number,
      category: ticket.category,
    };
  } catch (error) {
    if (error instanceof TicketServiceError) return { error: error.message };
    return { error: "No pudimos enviar el reporte. Intenta nuevamente." };
  }
}

function adminTicketPath(
  ticketId: string,
  key: "error" | "message",
  value: string,
) {
  return `/admin/tickets/${encodeURIComponent(ticketId)}?${key}=${encodeURIComponent(value)}`;
}

export async function assignTicketAction(formData: FormData) {
  const context = await requirePermission("triage", "ticket");
  const parsed = assignTicketSchema.safeParse({
    ticketId: formData.get("ticketId"),
    assigneeId: formData.get("assigneeId"),
  });
  if (!parsed.success)
    redirect("/admin/tickets?error=Selecciona+un+responsable+válido");
  try {
    await assignTicket(db, {
      ...parsed.data,
      tenantId: context.membership.tenantId,
      actorId: context.user.id,
    });
  } catch (error) {
    if (error instanceof TicketServiceError)
      redirect(adminTicketPath(parsed.data.ticketId, "error", error.message));
    throw error;
  }
  revalidatePath(`/admin/tickets/${parsed.data.ticketId}`);
  revalidatePath(`/reportes/${parsed.data.ticketId}`);
  redirect(
    adminTicketPath(parsed.data.ticketId, "message", "Responsable asignado."),
  );
}

export async function transitionTicketAction(formData: FormData) {
  const context = await requirePermission("triage", "ticket");
  const parsed = transitionTicketSchema.safeParse({
    ticketId: formData.get("ticketId"),
    toStatus: formData.get("toStatus"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success)
    redirect("/admin/tickets?error=Cambio+de+estado+inválido");
  try {
    await transitionTicket(db, {
      ...parsed.data,
      tenantId: context.membership.tenantId,
      actorId: context.user.id,
    });
  } catch (error) {
    if (
      error instanceof TicketServiceError ||
      error instanceof InvalidTicketTransitionError
    )
      redirect(adminTicketPath(parsed.data.ticketId, "error", error.message));
    throw error;
  }
  revalidatePath(`/admin/tickets/${parsed.data.ticketId}`);
  revalidatePath(`/reportes/${parsed.data.ticketId}`);
  revalidatePath("/reportes");
  redirect(
    adminTicketPath(parsed.data.ticketId, "message", "Estado actualizado."),
  );
}

export async function addResidentTicketCommentAction(formData: FormData) {
  const context = await requirePermission("update", "ticket");
  const parsed = ticketCommentSchema.safeParse({
    ticketId: formData.get("ticketId"),
    body: formData.get("body"),
  });
  if (!parsed.success) redirect("/reportes?error=El+comentario+no+es+válido");
  try {
    await addTicketComment(db, {
      ...parsed.data,
      tenantId: context.membership.tenantId,
      authorId: context.user.id,
      isInternal: false,
      access: "resident",
    });
  } catch (error) {
    if (error instanceof TicketServiceError)
      redirect(
        `/reportes/${parsed.data.ticketId}?error=${encodeURIComponent(error.message)}`,
      );
    throw error;
  }
  revalidatePath(`/reportes/${parsed.data.ticketId}`);
  revalidatePath(`/admin/tickets/${parsed.data.ticketId}`);
  redirect(`/reportes/${parsed.data.ticketId}?message=Comentario+enviado`);
}

export async function addAdminTicketCommentAction(formData: FormData) {
  const context = await requirePermission("triage", "ticket");
  const parsed = ticketCommentSchema.safeParse({
    ticketId: formData.get("ticketId"),
    body: formData.get("body"),
  });
  if (!parsed.success)
    redirect("/admin/tickets?error=El+comentario+no+es+válido");
  const isInternal = formData.get("visibility") === "internal";
  try {
    await addTicketComment(db, {
      ...parsed.data,
      tenantId: context.membership.tenantId,
      authorId: context.user.id,
      isInternal,
      access: "staff",
    });
  } catch (error) {
    if (error instanceof TicketServiceError)
      redirect(adminTicketPath(parsed.data.ticketId, "error", error.message));
    throw error;
  }
  revalidatePath(`/admin/tickets/${parsed.data.ticketId}`);
  if (!isInternal) revalidatePath(`/reportes/${parsed.data.ticketId}`);
  redirect(
    adminTicketPath(
      parsed.data.ticketId,
      "message",
      isInternal ? "Nota interna guardada." : "Comentario enviado.",
    ),
  );
}

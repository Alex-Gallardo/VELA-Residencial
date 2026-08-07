"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { moderationDecisionSchema } from "@/lib/validations/attachment";
import {
  ModerationServiceError,
  reviewModerationItem,
} from "@/server/services/moderation-service";

export async function reviewModerationAction(formData: FormData) {
  const context = await requirePermission("moderate", "moderation");
  const parsed = moderationDecisionSchema.safeParse({
    moderationId: formData.get("moderationId"),
    decision: formData.get("decision"),
    reason: formData.get("reason"),
  });
  if (!parsed.success)
    redirect("/admin/moderacion?error=Completa+el+motivo+de+la+decisión");
  try {
    await reviewModerationItem(db, {
      ...parsed.data,
      tenantId: context.membership.tenantId,
      reviewerId: context.user.id,
    });
  } catch (error) {
    if (error instanceof ModerationServiceError)
      redirect(`/admin/moderacion?error=${encodeURIComponent(error.message)}`);
    throw error;
  }
  revalidatePath("/admin/moderacion");
  revalidatePath("/reportes");
  redirect("/admin/moderacion?message=Decisión+guardada+y+auditada");
}

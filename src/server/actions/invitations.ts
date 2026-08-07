"use server";

import { HouseholdRelation, RoleName } from "@prisma/client";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requirePermission } from "@/lib/auth";
import { invitationEmail } from "@/server/services/invitation-email";
import {
  createInvitation,
  InvitationError,
  revokeInvitation,
} from "@/server/services/invitation-service";

const invitationSchema = z.object({
  email: z.string().trim().email(),
  dwellingId: z.string().trim().min(1),
  relation: z.nativeEnum(HouseholdRelation),
  role: z.nativeEnum(RoleName).default(RoleName.RESIDENTE),
});

async function sendInvitationEmail(input: {
  to: string;
  invitationUrl: string;
  tenantName: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.INVITATION_FROM_EMAIL;
  if (!apiKey || !from) return { delivered: false as const };
  const email = invitationEmail(input);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      ...email,
    }),
  });
  if (!response.ok)
    throw new Error("No se pudo enviar el correo de invitación");
  return { delivered: true as const };
}

export async function createInvitationAction(formData: FormData) {
  const context = await requirePermission("invite", "invitation");
  const parsed = invitationSchema.safeParse({
    email: formData.get("email"),
    dwellingId: formData.get("dwellingId"),
    relation: formData.get("relation"),
    role: formData.get("role") || RoleName.RESIDENTE,
  });
  if (!parsed.success)
    redirect("/admin/invitaciones?error=Revisa+los+datos+de+la+invitación");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  let result;
  try {
    result = await createInvitation({
      ...parsed.data,
      tenantId: context.membership.tenantId,
      createdById: context.user.id,
      appUrl,
    });
  } catch (error) {
    if (error instanceof InvitationError)
      redirect(
        `/admin/invitaciones?error=${encodeURIComponent(error.message)}`,
      );
    throw error;
  }
  const { invitation, url } = result;

  let delivered = false;
  try {
    ({ delivered } = await sendInvitationEmail({
      to: invitation.email,
      invitationUrl: url,
      tenantName: context.membership.tenant.name,
    }));
  } catch {
    // The secure preview link remains available even when the optional email
    // provider is not configured or temporarily fails.
  }

  const params = new URLSearchParams({
    message: delivered
      ? "Invitación creada y enviada."
      : "Invitación creada. Comparte el enlace seguro mostrado abajo.",
    link: url,
  });
  redirect(`/admin/invitaciones?${params.toString()}`);
}

export async function revokeInvitationAction(formData: FormData) {
  const context = await requirePermission("revoke", "invitation");
  const invitationId = z.string().min(1).parse(formData.get("invitationId"));
  try {
    await revokeInvitation({
      invitationId,
      tenantId: context.membership.tenantId,
      actorId: context.user.id,
    });
  } catch (error) {
    if (error instanceof InvitationError)
      redirect(
        `/admin/invitaciones?error=${encodeURIComponent(error.message)}`,
      );
    throw error;
  }
  redirect("/admin/invitaciones?message=Invitación+revocada");
}

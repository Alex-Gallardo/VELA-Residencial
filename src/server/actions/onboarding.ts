"use server";

import { InvitationStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/lib/db";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { recordAuditEvent } from "@/server/services/audit-service";
import { findInvitationByToken } from "@/server/services/invitation-service";
import { grantMembershipRole } from "@/server/services/membership-service";

const accountSchema = z.object({
  token: z.string().min(32),
  fullName: z.string().trim().min(2).max(100),
  password: z.string().max(72).optional(),
});

const onboardingSchema = z.object({
  token: z.string().min(32),
  fullName: z.string().trim().min(2).max(100),
  householdName: z.string().trim().min(2).max(100),
  phone: z.string().trim().max(30).optional(),
});

function invitationError(token: string, message: string) {
  return `/invitacion/${encodeURIComponent(token)}?error=${encodeURIComponent(message)}`;
}

export async function acceptInvitationAccountAction(formData: FormData) {
  const parsed = accountSchema.safeParse({
    token: formData.get("token"),
    fullName: formData.get("fullName"),
    password: formData.get("password"),
  });
  const rawToken = String(formData.get("token") ?? "");
  if (!parsed.success)
    redirect(
      invitationError(
        rawToken,
        "Completa tu nombre y usa una contraseña de 8 caracteres.",
      ),
    );

  const invitation = await findInvitationByToken(parsed.data.token);
  if (!invitation)
    redirect(
      invitationError(
        parsed.data.token,
        "La invitación venció o fue revocada.",
      ),
    );

  const supabase = await createClient();
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  if (currentUser) {
    if (currentUser.email?.toLowerCase() !== invitation.email.toLowerCase())
      redirect(
        invitationError(
          parsed.data.token,
          "Cierra la sesión actual y entra con el correo invitado.",
        ),
      );
    await db.user.upsert({
      where: { id: currentUser.id },
      update: { fullName: parsed.data.fullName },
      create: {
        id: currentUser.id,
        email: invitation.email,
        fullName: parsed.data.fullName,
      },
    });
    redirect(`/onboarding?token=${encodeURIComponent(parsed.data.token)}`);
  }

  if (!parsed.data.password || parsed.data.password.length < 8)
    redirect(
      invitationError(
        parsed.data.token,
        "La contraseña debe tener al menos 8 caracteres.",
      ),
    );

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: invitation.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.fullName },
  });
  if (error || !data.user) {
    const next = `/invitacion/${encodeURIComponent(parsed.data.token)}`;
    redirect(
      `/login?message=${encodeURIComponent("La cuenta ya puede existir. Inicia sesión para continuar.")}&next=${encodeURIComponent(next)}`,
    );
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: invitation.email,
    password: parsed.data.password,
  });
  if (signInError)
    redirect(
      invitationError(
        parsed.data.token,
        "La cuenta se creó, pero debes iniciar sesión.",
      ),
    );

  await db.user.upsert({
    where: { id: data.user.id },
    update: { fullName: parsed.data.fullName },
    create: {
      id: data.user.id,
      email: invitation.email,
      fullName: parsed.data.fullName,
    },
  });
  redirect(`/onboarding?token=${encodeURIComponent(parsed.data.token)}`);
}

export async function completeOnboardingAction(formData: FormData) {
  const parsed = onboardingSchema.safeParse({
    token: formData.get("token"),
    fullName: formData.get("fullName"),
    householdName: formData.get("householdName"),
    phone: formData.get("phone") || undefined,
  });
  if (!parsed.success)
    redirect(
      `/onboarding?token=${encodeURIComponent(String(formData.get("token") ?? ""))}&error=${encodeURIComponent("Revisa los datos de tu hogar.")}`,
    );

  const invitation = await findInvitationByToken(parsed.data.token);
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!invitation || !authUser)
    redirect("/login?error=La+sesión+o+la+invitación+ya+no+es+válida");
  if (authUser.email?.toLowerCase() !== invitation.email.toLowerCase())
    redirect(
      `/onboarding?token=${encodeURIComponent(parsed.data.token)}&error=Correo+incorrecto`,
    );
  if (!invitation.dwellingId || !invitation.relation)
    redirect(
      `/onboarding?token=${encodeURIComponent(parsed.data.token)}&error=Invitación+incompleta`,
    );

  await db.$transaction(async (transaction) => {
    const claimed = await transaction.invitation.updateMany({
      where: {
        id: invitation.id,
        status: InvitationStatus.PENDIENTE,
        expiresAt: { gt: new Date() },
      },
      data: { status: InvitationStatus.ACEPTADA },
    });
    if (claimed.count !== 1)
      throw new Error("Invitation is no longer available");

    const user = await transaction.user.upsert({
      where: { id: authUser.id },
      update: {
        email: invitation.email,
        fullName: parsed.data.fullName,
        phone: parsed.data.phone || null,
      },
      create: {
        id: authUser.id,
        email: invitation.email,
        fullName: parsed.data.fullName,
        phone: parsed.data.phone || null,
      },
    });
    const membership = await transaction.membership.upsert({
      where: {
        tenantId_userId: { tenantId: invitation.tenantId, userId: user.id },
      },
      update: { active: true },
      create: { tenantId: invitation.tenantId, userId: user.id },
    });
    await grantMembershipRole(transaction, {
      tenantId: invitation.tenantId,
      membershipId: membership.id,
      role: invitation.role,
      actorId: invitation.createdById,
    });

    let household = await transaction.household.findFirst({
      where: {
        tenantId: invitation.tenantId,
        dwellingId: invitation.dwellingId!,
        active: true,
      },
    });
    household ??= await transaction.household.create({
      data: {
        tenantId: invitation.tenantId,
        dwellingId: invitation.dwellingId!,
        name: parsed.data.householdName,
      },
    });

    const existingMember = await transaction.householdMember.findFirst({
      where: { householdId: household.id, userId: user.id },
    });
    if (existingMember) {
      await transaction.householdMember.update({
        where: { id: existingMember.id },
        data: {
          fullName: parsed.data.fullName,
          relation: invitation.relation!,
          isPrimary: true,
        },
      });
    } else {
      await transaction.householdMember.create({
        data: {
          tenantId: invitation.tenantId,
          householdId: household.id,
          userId: user.id,
          fullName: parsed.data.fullName,
          relation: invitation.relation!,
          isPrimary: true,
        },
      });
    }

    await recordAuditEvent(transaction, {
      tenantId: invitation.tenantId,
      actorId: user.id,
      action: "invitation.accepted",
      entity: "Invitation",
      entityId: invitation.id,
      metadata: { dwellingId: invitation.dwellingId, role: invitation.role },
    });
  });

  redirect("/inicio?message=Bienvenido+a+Vela");
}

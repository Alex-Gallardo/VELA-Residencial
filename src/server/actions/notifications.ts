"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  notificationPreferenceSchema,
  pushSubscriptionSchema,
} from "@/lib/validations/notice";
import { recordAuditEvent } from "@/server/services/audit-service";

function timeToMinutes(value: FormDataEntryValue | null) {
  if (!value) return null;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value));
  return match ? Number(match[1]) * 60 + Number(match[2]) : Number.NaN;
}

export async function updateNotificationPreferencesAction(formData: FormData) {
  const context = await requirePermission("read", "notification");
  const parsed = notificationPreferenceSchema.safeParse({
    inAppEnabled: formData.get("inAppEnabled") === "on",
    pushEnabled: formData.get("pushEnabled") === "on",
    emailEnabled: formData.get("emailEnabled") === "on",
    quietHoursStart: timeToMinutes(formData.get("quietHoursStart")),
    quietHoursEnd: timeToMinutes(formData.get("quietHoursEnd")),
    timeZone: formData.get("timeZone") || "America/Guatemala",
  });
  if (!parsed.success)
    redirect(
      `/perfil?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Preferencias inválidas.")}`,
    );

  await db.$transaction(async (transaction) => {
    await transaction.notificationPreference.upsert({
      where: {
        tenantId_userId: {
          tenantId: context.membership.tenantId,
          userId: context.user.id,
        },
      },
      update: parsed.data,
      create: {
        ...parsed.data,
        tenantId: context.membership.tenantId,
        userId: context.user.id,
      },
    });
    await recordAuditEvent(transaction, {
      tenantId: context.membership.tenantId,
      actorId: context.user.id,
      action: "notification.preferences_updated",
      entity: "NotificationPreference",
      entityId: context.user.id,
      metadata: parsed.data,
    });
  });
  revalidatePath("/perfil");
  redirect("/perfil?message=Preferencias+guardadas");
}

export async function markNotificationAction(formData: FormData) {
  const context = await requirePermission("read", "notification");
  const notificationId = String(formData.get("notificationId") ?? "");
  const unread = formData.get("unread") === "1";
  if (!notificationId) redirect("/notificaciones?error=Notificación+inválida");
  await db.notification.updateMany({
    where: {
      id: notificationId,
      tenantId: context.membership.tenantId,
      userId: context.user.id,
    },
    data: { readAt: unread ? null : new Date() },
  });
  revalidatePath("/notificaciones");
}

export async function markAllNotificationsReadAction() {
  const context = await requirePermission("read", "notification");
  await db.notification.updateMany({
    where: {
      tenantId: context.membership.tenantId,
      userId: context.user.id,
      channel: "IN_APP",
      readAt: null,
    },
    data: { readAt: new Date() },
  });
  revalidatePath("/notificaciones");
}

export async function savePushSubscriptionAction(
  payload: unknown,
  userAgent?: string,
) {
  const context = await requirePermission("read", "notification");
  const parsed = pushSubscriptionSchema.safeParse(payload);
  if (!parsed.success) return { error: "Suscripción push inválida." };
  const stored = await db.pushSubscription.findUnique({
    where: { endpoint: parsed.data.endpoint },
  });
  if (
    stored &&
    (stored.tenantId !== context.membership.tenantId ||
      stored.userId !== context.user.id)
  )
    return { error: "La suscripción ya pertenece a otra cuenta." };
  if (stored)
    await db.pushSubscription.update({
      where: { id: stored.id },
      data: {
        p256dh: parsed.data.keys.p256dh,
        auth: parsed.data.keys.auth,
        userAgent: userAgent?.slice(0, 500),
      },
    });
  else
    await db.pushSubscription.create({
      data: {
        tenantId: context.membership.tenantId,
        userId: context.user.id,
        endpoint: parsed.data.endpoint,
        p256dh: parsed.data.keys.p256dh,
        auth: parsed.data.keys.auth,
        userAgent: userAgent?.slice(0, 500),
      },
    });
  revalidatePath("/perfil");
  return { success: true };
}

export async function removePushSubscriptionAction(endpoint: string) {
  const context = await requirePermission("read", "notification");
  await db.pushSubscription.deleteMany({
    where: {
      endpoint,
      tenantId: context.membership.tenantId,
      userId: context.user.id,
    },
  });
  revalidatePath("/perfil");
  return { success: true };
}

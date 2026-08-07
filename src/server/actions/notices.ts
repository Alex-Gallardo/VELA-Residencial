"use server";

import { NotificationChannel } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { createNoticeSchema } from "@/lib/validations/notice";
import { dispatchPendingNotifications } from "@/server/services/notification-delivery";
import {
  createNotice,
  markNoticeRead,
  NoticeServiceError,
} from "@/server/services/notice-service";

function parseBrowserDateTime(
  value: FormDataEntryValue | null,
  timezoneOffset: number,
) {
  if (!value) return undefined;
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::\d{2})?$/.exec(
    String(value),
  );
  if (!match) return value;
  const utcLike = Date.parse(`${match[1]}:00.000Z`);
  return new Date(utcLike + timezoneOffset * 60_000);
}

export async function createNoticeAction(formData: FormData) {
  const context = await requirePermission("create", "notice");
  const scope = String(formData.get("audienceScope") ?? "");
  const requestedOffset = Number(formData.get("timezoneOffset") ?? 360);
  const timezoneOffset =
    Number.isInteger(requestedOffset) && Math.abs(requestedOffset) <= 840
      ? requestedOffset
      : 360;
  const parsed = createNoticeSchema.safeParse({
    type: formData.get("type"),
    title: formData.get("title"),
    body: formData.get("body"),
    audience: {
      scope,
      values: scope === "ALL" ? [] : formData.getAll("audienceValues"),
    },
    channels: formData.getAll("channels"),
    requiresReadReceipt: formData.get("requiresReadReceipt") === "on",
    publishedAt: parseBrowserDateTime(
      formData.get("publishedAt"),
      timezoneOffset,
    ),
    expiresAt: parseBrowserDateTime(formData.get("expiresAt"), timezoneOffset),
  });
  if (!parsed.success) {
    redirect(
      `/admin/avisos?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Revisa los datos del aviso.")}`,
    );
  }

  try {
    const result = await createNotice(db, {
      ...parsed.data,
      tenantId: context.membership.tenantId,
      actorId: context.user.id,
    });
    if (result.notice.deliveredAt) {
      const queued = await db.notification.findMany({
        where: {
          tenantId: context.membership.tenantId,
          linkUrl: `/avisos/${result.notice.id}`,
          channel: {
            in: [NotificationChannel.PUSH, NotificationChannel.EMAIL],
          },
          sentAt: null,
        },
        select: { id: true },
      });
      await dispatchPendingNotifications({
        notificationIds: queued.map(({ id }) => id),
      });
    }
    revalidatePath("/avisos");
    revalidatePath("/notificaciones");
    revalidatePath("/inicio");
    revalidatePath("/admin/avisos");
    const message = result.notice.deliveredAt
      ? `Aviso publicado para ${result.recipientCount} destinatario(s).`
      : "Aviso programado correctamente.";
    redirect(`/admin/avisos?message=${encodeURIComponent(message)}`);
  } catch (error) {
    if (error instanceof NoticeServiceError)
      redirect(`/admin/avisos?error=${encodeURIComponent(error.message)}`);
    throw error;
  }
}

export async function markNoticeReadAction(formData: FormData) {
  const context = await requirePermission("read", "notice");
  const noticeId = String(formData.get("noticeId") ?? "");
  if (!noticeId) redirect("/avisos?error=Aviso+inválido");
  try {
    await markNoticeRead(db, {
      tenantId: context.membership.tenantId,
      userId: context.user.id,
      noticeId,
    });
  } catch (error) {
    if (error instanceof NoticeServiceError)
      redirect(
        `/avisos/${noticeId}?error=${encodeURIComponent(error.message)}`,
      );
    throw error;
  }
  revalidatePath(`/avisos/${noticeId}`);
  revalidatePath("/avisos");
  revalidatePath("/notificaciones");
  redirect(`/avisos/${noticeId}?message=Lectura+confirmada`);
}

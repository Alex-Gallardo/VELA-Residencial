import "server-only";

import { NotificationChannel, NotificationType } from "@prisma/client";
import { render } from "@react-email/render";
import webpush from "web-push";

import { NotificationEmail } from "@/emails/notification-email";
import { db } from "@/lib/db";
import {
  defaultDeliveryPreferences,
  isChannelEnabled,
  isQuietTime,
} from "@/server/services/notification-preferences";

function absoluteAppUrl(linkUrl?: string | null) {
  if (!linkUrl) return null;
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return new URL(linkUrl, base).toString();
}

async function sendEmail(input: {
  to: string;
  title: string;
  body: string;
  linkUrl?: string | null;
  tenantName: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.NOTIFICATION_FROM_EMAIL ?? process.env.INVITATION_FROM_EMAIL;
  if (!apiKey || !from) return false;
  const html = await render(
    NotificationEmail({
      title: input.title,
      body: input.body,
      actionUrl: absoluteAppUrl(input.linkUrl),
      tenantName: input.tenantName,
    }),
  );
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.title,
      html,
    }),
  });
  return response.ok;
}

function configureWebPush() {
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

async function sendPush(input: {
  tenantId: string;
  userId: string;
  title: string;
  body: string;
  linkUrl?: string | null;
}) {
  if (!configureWebPush()) return false;
  const subscriptions = await db.pushSubscription.findMany({
    where: { tenantId: input.tenantId, userId: input.userId },
  });
  let delivered = false;
  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        JSON.stringify({
          title: input.title,
          body: input.body,
          url: input.linkUrl ?? "/notificaciones",
        }),
      );
      delivered = true;
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await db.pushSubscription.delete({ where: { id: subscription.id } });
      }
    }
  }
  return delivered;
}

export async function dispatchPendingNotifications(input?: {
  notificationIds?: string[];
  limit?: number;
  now?: Date;
}) {
  if (input?.notificationIds && input.notificationIds.length === 0)
    return { processed: 0, delivered: 0, deferred: 0 };
  const now = input?.now ?? new Date();
  const notifications = await db.notification.findMany({
    where: {
      sentAt: null,
      channel: { in: [NotificationChannel.EMAIL, NotificationChannel.PUSH] },
      ...(input?.notificationIds?.length
        ? { id: { in: input.notificationIds } }
        : {}),
    },
    include: { user: true, tenant: true },
    orderBy: { createdAt: "asc" },
    take: input?.limit ?? 100,
  });
  let delivered = 0;
  let deferred = 0;
  const tenantChannels = new Map<string, NotificationChannel[]>();

  for (const notification of notifications) {
    let allowedChannels = tenantChannels.get(notification.tenantId);
    if (!allowedChannels) {
      const settings = await db.tenantSettings.findUnique({
        where: { tenantId: notification.tenantId },
        select: { notificationChannels: true },
      });
      allowedChannels = settings?.notificationChannels ?? [
        NotificationChannel.IN_APP,
        NotificationChannel.PUSH,
        NotificationChannel.EMAIL,
      ];
      tenantChannels.set(notification.tenantId, allowedChannels);
    }
    if (!allowedChannels.includes(notification.channel)) {
      await db.notification.delete({ where: { id: notification.id } });
      continue;
    }
    const preferences =
      (await db.notificationPreference.findUnique({
        where: {
          tenantId_userId: {
            tenantId: notification.tenantId,
            userId: notification.userId,
          },
        },
      })) ?? defaultDeliveryPreferences;
    const critical = notification.type === NotificationType.ALERTA;
    if (!isChannelEnabled(preferences, notification.channel)) {
      await db.notification.delete({ where: { id: notification.id } });
      continue;
    }
    if (!critical && isQuietTime(preferences, now)) {
      deferred += 1;
      continue;
    }

    let success = false;
    try {
      success =
        notification.channel === NotificationChannel.EMAIL
          ? await sendEmail({
              to: notification.user.email,
              title: notification.title,
              body: notification.body,
              linkUrl: notification.linkUrl,
              tenantName: notification.tenant.name,
            })
          : await sendPush({
              tenantId: notification.tenantId,
              userId: notification.userId,
              title: notification.title,
              body: notification.body,
              linkUrl: notification.linkUrl,
            });
    } catch {
      // Delivery is best-effort. The unsent row remains queued for the cron.
    }
    if (success) {
      await db.notification.update({
        where: { id: notification.id },
        data: { sentAt: now },
      });
      delivered += 1;
    } else {
      deferred += 1;
    }
  }
  return { processed: notifications.length, delivered, deferred };
}

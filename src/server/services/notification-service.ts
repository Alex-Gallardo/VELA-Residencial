import {
  NotificationChannel,
  NotificationType,
  RoleName,
  type PrismaClient,
} from "@prisma/client";

import {
  defaultDeliveryPreferences,
  isChannelEnabled,
} from "@/server/services/notification-preferences";
import { getTenantNotificationChannels } from "@/server/services/tenant-settings";

export async function enqueueUserNotification(
  database: PrismaClient,
  input: {
    tenantId: string;
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    linkUrl?: string;
    channels?: NotificationChannel[];
  },
) {
  const channels = input.channels ?? [
    NotificationChannel.IN_APP,
    NotificationChannel.PUSH,
    NotificationChannel.EMAIL,
  ];
  const [preferences, pushCount, tenantChannels] = await Promise.all([
    database.notificationPreference.findUnique({
      where: {
        tenantId_userId: {
          tenantId: input.tenantId,
          userId: input.userId,
        },
      },
    }),
    database.pushSubscription.count({
      where: { tenantId: input.tenantId, userId: input.userId },
    }),
    getTenantNotificationChannels(database, input.tenantId),
  ]);
  const effective = preferences ?? defaultDeliveryPreferences;
  const enabledChannels = channels.filter(
    (channel) =>
      tenantChannels.includes(channel) &&
      isChannelEnabled(effective, channel) &&
      (channel !== NotificationChannel.PUSH || pushCount > 0),
  );
  if (!enabledChannels.length) return [];

  return Promise.all(
    enabledChannels.map((channel) =>
      database.notification.create({
        data: {
          tenantId: input.tenantId,
          userId: input.userId,
          type: input.type,
          channel,
          title: input.title,
          body: input.body,
          linkUrl: input.linkUrl,
          sentAt: channel === NotificationChannel.IN_APP ? new Date() : null,
        },
      }),
    ),
  );
}

export async function enqueueTicketUpdateNotification(
  database: PrismaClient,
  input: { tenantId: string; ticketId: string; message: string },
) {
  const ticket = await database.ticket.findFirst({
    where: { tenantId: input.tenantId, id: input.ticketId },
    select: { id: true, number: true, title: true, createdById: true },
  });
  if (!ticket) return [];
  return enqueueUserNotification(database, {
    tenantId: input.tenantId,
    userId: ticket.createdById,
    type: NotificationType.TICKET_UPDATE,
    title: `Actualización del reporte #${String(ticket.number).padStart(4, "0")}`,
    body: `${ticket.title}: ${input.message}`,
    linkUrl: `/reportes/${ticket.id}`,
  });
}

export async function enqueueNewTicketNotifications(
  database: PrismaClient,
  input: { tenantId: string; ticketId: string },
) {
  const ticket = await database.ticket.findFirst({
    where: { tenantId: input.tenantId, id: input.ticketId },
    select: { id: true, number: true, title: true, createdById: true },
  });
  if (!ticket) return [];
  const notifiedStaffRoles: RoleName[] = [
    RoleName.ADMIN_GENERAL,
    RoleName.OPERACIONES,
    RoleName.SEGURIDAD,
  ];
  const staffMemberships = await database.membership.findMany({
    where: {
      tenantId: input.tenantId,
      active: true,
      roles: {
        some: {
          role: {
            in: notifiedStaffRoles,
          },
        },
      },
    },
    select: { userId: true, roles: true },
  });
  const now = new Date();
  const staff = staffMemberships.filter((membership) =>
    membership.roles.some(
      ({ role, expiresAt }) =>
        notifiedStaffRoles.includes(role) && (!expiresAt || expiresAt > now),
    ),
  );
  const resident = await enqueueUserNotification(database, {
    tenantId: input.tenantId,
    userId: ticket.createdById,
    type: NotificationType.TICKET_UPDATE,
    title: `Reporte #${String(ticket.number).padStart(4, "0")} recibido`,
    body: "Tu reporte fue recibido y ya está en la bandeja de administración.",
    linkUrl: `/reportes/${ticket.id}`,
  });
  const staffNotifications = await Promise.all(
    staff
      .filter(({ userId }) => userId !== ticket.createdById)
      .map(({ userId }) =>
        enqueueUserNotification(database, {
          tenantId: input.tenantId,
          userId,
          type: NotificationType.TICKET_UPDATE,
          title: `Nuevo reporte #${String(ticket.number).padStart(4, "0")}`,
          body: ticket.title,
          linkUrl: `/admin/tickets/${ticket.id}`,
          channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
        }),
      ),
  );
  return [...resident, ...staffNotifications.flat()];
}

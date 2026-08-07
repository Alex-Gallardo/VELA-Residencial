import { NotificationChannel, type PrismaClient } from "@prisma/client";

export const DEFAULT_TENANT_CHANNELS: NotificationChannel[] = [
  NotificationChannel.IN_APP,
  NotificationChannel.PUSH,
  NotificationChannel.EMAIL,
];

export async function getTenantNotificationChannels(
  database: PrismaClient,
  tenantId: string,
) {
  const settings = await database.tenantSettings.findUnique({
    where: { tenantId },
    select: { notificationChannels: true },
  });
  return settings?.notificationChannels ?? DEFAULT_TENANT_CHANNELS;
}

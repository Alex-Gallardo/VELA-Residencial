import {
  NoticeType,
  NotificationChannel,
  NotificationType,
  Prisma,
  type PrismaClient,
} from "@prisma/client";

import type { NoticeAudience } from "@/lib/validations/notice";
import { noticeAudienceSchema } from "@/lib/validations/notice";
import { recordAuditEvent } from "@/server/services/audit-service";
import { isNoticeAudienceMember } from "@/server/services/notice-audience";
import {
  defaultDeliveryPreferences,
  isChannelEnabled,
} from "@/server/services/notification-preferences";
import { getTenantNotificationChannels } from "@/server/services/tenant-settings";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

export class NoticeServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NoticeServiceError";
  }
}

type NoticeCreationInput = {
  tenantId: string;
  actorId: string;
  type: NoticeType;
  title: string;
  body: string;
  audience: NoticeAudience;
  channels: NotificationChannel[];
  requiresReadReceipt: boolean;
  publishedAt: Date;
  expiresAt?: Date;
};

async function resolveRecipients(
  database: DatabaseClient,
  tenantId: string,
  audience: NoticeAudience,
  now: Date,
) {
  const memberships = await database.membership.findMany({
    where: { tenantId, active: true },
    include: {
      roles: true,
      user: {
        include: {
          householdMembers: {
            where: { tenantId, active: true, household: { active: true } },
            include: { household: { include: { dwelling: true } } },
          },
        },
      },
    },
  });
  return memberships
    .filter((membership) =>
      isNoticeAudienceMember(
        audience,
        {
          roles: membership.roles,
          dwellings: membership.user.householdMembers.map(
            ({ household }) => household.dwelling,
          ),
        },
        now,
      ),
    )
    .map(({ user }) => user);
}

async function publishNoticeRows(
  transaction: Prisma.TransactionClient,
  noticeId: string,
  now: Date,
) {
  await transaction.$queryRaw`
    SELECT "id" FROM "Notice" WHERE "id" = ${noticeId} FOR UPDATE
  `;
  const notice = await transaction.notice.findUnique({
    where: { id: noticeId },
  });
  if (!notice) throw new NoticeServiceError("El aviso no existe.");
  if (notice.deliveredAt) return { notice, recipientCount: 0 };
  if (!notice.publishedAt || notice.publishedAt > now)
    throw new NoticeServiceError(
      "El aviso todavía no está programado para envío.",
    );
  if (notice.expiresAt && notice.expiresAt <= now)
    throw new NoticeServiceError("El aviso expiró antes de poder publicarse.");

  const audience = noticeAudienceSchema.parse(notice.audience);
  const recipients = await resolveRecipients(
    transaction,
    notice.tenantId,
    audience,
    now,
  );
  const [preferences, pushSubscriptions, tenantSettings] = await Promise.all([
    transaction.notificationPreference.findMany({
      where: {
        tenantId: notice.tenantId,
        userId: { in: recipients.map(({ id }) => id) },
      },
    }),
    transaction.pushSubscription.findMany({
      where: {
        tenantId: notice.tenantId,
        userId: { in: recipients.map(({ id }) => id) },
      },
      select: { userId: true },
    }),
    transaction.tenantSettings.findUnique({
      where: { tenantId: notice.tenantId },
      select: { notificationChannels: true },
    }),
  ]);
  const tenantChannels =
    tenantSettings?.notificationChannels ??
    (Object.values(NotificationChannel).filter(
      (channel) => channel !== NotificationChannel.SMS,
    ) as NotificationChannel[]);
  const preferencesByUser = new Map(
    preferences.map((preference) => [preference.userId, preference]),
  );
  const usersWithPush = new Set(pushSubscriptions.map(({ userId }) => userId));
  const notificationType =
    notice.type === NoticeType.ALERTA_CRITICA
      ? NotificationType.ALERTA
      : NotificationType.AVISO;

  if (recipients.length) {
    await transaction.noticeReceipt.createMany({
      data: recipients.map(({ id: userId }) => ({
        tenantId: notice.tenantId,
        noticeId: notice.id,
        userId,
      })),
      skipDuplicates: true,
    });

    const notifications = recipients.flatMap((user) => {
      const preference =
        preferencesByUser.get(user.id) ?? defaultDeliveryPreferences;
      return notice.channels
        .filter((channel) => {
          if (!tenantChannels.includes(channel)) return false;
          if (
            channel === NotificationChannel.IN_APP &&
            notice.type === NoticeType.ALERTA_CRITICA
          )
            return true;
          if (!isChannelEnabled(preference, channel)) return false;
          return (
            channel !== NotificationChannel.PUSH || usersWithPush.has(user.id)
          );
        })
        .map((channel) => ({
          tenantId: notice.tenantId,
          userId: user.id,
          type: notificationType,
          channel,
          title: notice.title,
          body: notice.body,
          linkUrl: `/avisos/${notice.id}`,
          sentAt: channel === NotificationChannel.IN_APP ? now : null,
        }));
    });
    if (notifications.length)
      await transaction.notification.createMany({ data: notifications });
  }

  const delivered = await transaction.notice.update({
    where: { id: notice.id },
    data: { deliveredAt: now },
  });
  await recordAuditEvent(transaction, {
    tenantId: notice.tenantId,
    actorId: notice.createdById,
    action: "notice.published",
    entity: "Notice",
    entityId: notice.id,
    metadata: {
      recipientCount: recipients.length,
      channels: notice.channels,
      audience: notice.audience,
    },
  });
  return { notice: delivered, recipientCount: recipients.length };
}

export async function publishNotice(
  database: PrismaClient,
  noticeId: string,
  now = new Date(),
) {
  return database.$transaction((transaction) =>
    publishNoticeRows(transaction, noticeId, now),
  );
}

export async function createNotice(
  database: PrismaClient,
  input: NoticeCreationInput,
  now = new Date(),
) {
  const tenantChannels = await getTenantNotificationChannels(
    database,
    input.tenantId,
  );
  const disabledChannel = input.channels.find(
    (channel) => !tenantChannels.includes(channel),
  );
  if (disabledChannel)
    throw new NoticeServiceError(
      "Uno de los canales seleccionados está desactivado en la configuración.",
    );
  const notice = await database.$transaction(async (transaction) => {
    const created = await transaction.notice.create({
      data: {
        tenantId: input.tenantId,
        type: input.type,
        title: input.title,
        body: input.body,
        audience: input.audience as Prisma.InputJsonValue,
        channels: input.channels,
        requiresReadReceipt: input.requiresReadReceipt,
        publishedAt: input.publishedAt,
        expiresAt: input.expiresAt ?? null,
        createdById: input.actorId,
      },
    });
    await recordAuditEvent(transaction, {
      tenantId: input.tenantId,
      actorId: input.actorId,
      action: input.publishedAt <= now ? "notice.created" : "notice.scheduled",
      entity: "Notice",
      entityId: created.id,
      metadata: {
        audience: input.audience,
        channels: input.channels,
        publishedAt: input.publishedAt.toISOString(),
      },
    });
    return created;
  });
  if (notice.publishedAt && notice.publishedAt <= now) {
    return publishNotice(database, notice.id, now);
  }
  return { notice, recipientCount: 0 };
}

export async function publishDueNotices(
  database: PrismaClient,
  now = new Date(),
) {
  const due = await database.notice.findMany({
    where: {
      deliveredAt: null,
      publishedAt: { lte: now },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: { publishedAt: "asc" },
    take: 100,
    select: { id: true },
  });
  const results = [];
  for (const notice of due) {
    results.push(await publishNotice(database, notice.id, now));
  }
  return results;
}

export async function markNoticeRead(
  database: PrismaClient,
  input: { tenantId: string; noticeId: string; userId: string },
  now = new Date(),
) {
  return database.$transaction(async (transaction) => {
    const updated = await transaction.noticeReceipt.updateMany({
      where: {
        tenantId: input.tenantId,
        noticeId: input.noticeId,
        userId: input.userId,
        readAt: null,
      },
      data: { readAt: now },
    });
    if (updated.count !== 1)
      throw new NoticeServiceError(
        "El aviso no pertenece a tu audiencia o ya fue confirmado.",
      );
    await transaction.notification.updateMany({
      where: {
        tenantId: input.tenantId,
        userId: input.userId,
        linkUrl: `/avisos/${input.noticeId}`,
        readAt: null,
      },
      data: { readAt: now },
    });
  });
}

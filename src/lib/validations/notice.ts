import { NoticeType, NotificationChannel, RoleName } from "@prisma/client";
import { z } from "zod";

const nonEmptyValues = z.array(z.string().trim().min(1)).min(1).max(100);

export const noticeAudienceSchema = z.discriminatedUnion("scope", [
  z.object({ scope: z.literal("ALL"), values: z.array(z.never()).default([]) }),
  z.object({ scope: z.literal("ZONE"), values: nonEmptyValues }),
  z.object({ scope: z.literal("DWELLING"), values: nonEmptyValues }),
  z.object({
    scope: z.literal("ROLE"),
    values: z.array(z.nativeEnum(RoleName)).min(1).max(8),
  }),
]);

export type NoticeAudience = z.infer<typeof noticeAudienceSchema>;

export const createNoticeSchema = z
  .object({
    type: z.nativeEnum(NoticeType),
    title: z.string().trim().min(4).max(120),
    body: z.string().trim().min(10).max(5_000),
    audience: noticeAudienceSchema,
    channels: z
      .array(z.nativeEnum(NotificationChannel))
      .min(1)
      .transform((channels) => [...new Set(channels)]),
    requiresReadReceipt: z.boolean().default(false),
    publishedAt: z.coerce.date(),
    expiresAt: z.coerce.date().optional(),
  })
  .superRefine((value, context) => {
    if (value.expiresAt && value.expiresAt <= value.publishedAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expiresAt"],
        message: "La vigencia debe terminar después de la publicación.",
      });
    }
    if (
      value.type === NoticeType.ALERTA_CRITICA &&
      !value.channels.includes(NotificationChannel.IN_APP)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["channels"],
        message: "Una alerta crítica siempre debe incluir el canal in-app.",
      });
    }
    if (value.channels.includes(NotificationChannel.SMS)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["channels"],
        message: "SMS permanece fuera del MVP hasta configurar un proveedor.",
      });
    }
  });

export const notificationPreferenceSchema = z
  .object({
    inAppEnabled: z.boolean(),
    pushEnabled: z.boolean(),
    emailEnabled: z.boolean(),
    quietHoursStart: z.number().int().min(0).max(1_439).nullable(),
    quietHoursEnd: z.number().int().min(0).max(1_439).nullable(),
    timeZone: z.string().trim().min(1).max(100),
  })
  .superRefine((value, context) => {
    const hasStart = value.quietHoursStart !== null;
    const hasEnd = value.quietHoursEnd !== null;
    if (hasStart !== hasEnd || value.quietHoursStart === value.quietHoursEnd) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["quietHoursStart"],
        message: "Indica un horario silencioso completo y válido.",
      });
    }
    try {
      new Intl.DateTimeFormat("es", { timeZone: value.timeZone }).format();
    } catch {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["timeZone"],
        message: "La zona horaria no es válida.",
      });
    }
  });

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(2_048),
  keys: z.object({
    p256dh: z.string().min(20).max(500),
    auth: z.string().min(8).max(500),
  }),
});

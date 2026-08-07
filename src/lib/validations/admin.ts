import {
  DwellingType,
  HouseholdRelation,
  NotificationChannel,
  RoleName,
  TicketCategory,
} from "@prisma/client";
import { z } from "zod";

const optionalTrimmed = z
  .string()
  .trim()
  .max(120)
  .optional()
  .transform((value) => value || undefined);

export const dwellingSchema = z.object({
  code: z.string().trim().min(2).max(80),
  type: z.nativeEnum(DwellingType),
  zone: optionalTrimmed,
});

export const householdSchema = z.object({
  dwellingId: z.string().trim().min(1),
  name: optionalTrimmed,
});

export const householdMemberSchema = z.object({
  householdId: z.string().trim().min(1),
  fullName: z.string().trim().min(2).max(120),
  relation: z.nativeEnum(HouseholdRelation),
  isPrimary: z.boolean().default(false),
});

export const categoryConfigSchema = z.object({
  category: z.nativeEnum(TicketCategory),
  slaHours: z.coerce
    .number()
    .int()
    .min(1)
    .max(24 * 90),
  defaultRole: z.nativeEnum(RoleName).nullable(),
  active: z.boolean(),
});

export const zoneConfigSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export const tenantSettingsSchema = z
  .object({
    notificationChannels: z
      .array(z.nativeEnum(NotificationChannel))
      .min(1)
      .transform((channels) => [...new Set(channels)]),
    emergencyContacts: z
      .array(z.string().trim().min(3).max(120))
      .max(10)
      .transform((contacts) => [...new Set(contacts)]),
  })
  .superRefine((value, context) => {
    if (!value.notificationChannels.includes(NotificationChannel.IN_APP))
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["notificationChannels"],
        message: "El canal en la aplicación debe permanecer activo.",
      });
  });

export const roleGrantSchema = z.object({
  membershipId: z.string().trim().min(1),
  role: z.nativeEnum(RoleName),
  expiresAt: z.coerce.date().optional(),
});

export const roleRevokeSchema = z.object({
  membershipId: z.string().trim().min(1),
  role: z.nativeEnum(RoleName),
});

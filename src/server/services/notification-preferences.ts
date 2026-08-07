import { NotificationChannel } from "@prisma/client";

export type DeliveryPreferences = {
  inAppEnabled: boolean;
  pushEnabled: boolean;
  emailEnabled: boolean;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
  timeZone: string;
};

export const defaultDeliveryPreferences: DeliveryPreferences = {
  inAppEnabled: true,
  pushEnabled: true,
  emailEnabled: true,
  quietHoursStart: null,
  quietHoursEnd: null,
  timeZone: "America/Guatemala",
};

export function isChannelEnabled(
  preferences: DeliveryPreferences,
  channel: NotificationChannel,
) {
  if (channel === NotificationChannel.IN_APP) return preferences.inAppEnabled;
  if (channel === NotificationChannel.PUSH) return preferences.pushEnabled;
  if (channel === NotificationChannel.EMAIL) return preferences.emailEnabled;
  return false;
}

export function minutesInTimeZone(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find(({ type }) => type === "hour")?.value ?? 0);
  const minute = Number(
    parts.find(({ type }) => type === "minute")?.value ?? 0,
  );
  return hour * 60 + minute;
}

export function isQuietTime(
  preferences: DeliveryPreferences,
  now = new Date(),
) {
  const { quietHoursStart: start, quietHoursEnd: end } = preferences;
  if (start === null || end === null) return false;
  const current = minutesInTimeZone(now, preferences.timeZone);
  return start < end
    ? current >= start && current < end
    : current >= start || current < end;
}

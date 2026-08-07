import { NotificationChannel } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  isChannelEnabled,
  isQuietTime,
} from "../../src/server/services/notification-preferences";

const preferences = {
  inAppEnabled: true,
  pushEnabled: false,
  emailEnabled: true,
  quietHoursStart: 22 * 60,
  quietHoursEnd: 6 * 60,
  timeZone: "America/Guatemala",
};

describe("preferencias de notificación", () => {
  it("respeta canales desactivados", () => {
    expect(isChannelEnabled(preferences, NotificationChannel.PUSH)).toBe(false);
    expect(isChannelEnabled(preferences, NotificationChannel.EMAIL)).toBe(true);
  });

  it("calcula horarios silenciosos que cruzan medianoche", () => {
    expect(isQuietTime(preferences, new Date("2026-08-08T05:00:00Z"))).toBe(
      true,
    );
    expect(isQuietTime(preferences, new Date("2026-08-08T18:00:00Z"))).toBe(
      false,
    );
  });
});

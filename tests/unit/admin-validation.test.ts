import { NotificationChannel, RoleName } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { tenantSettingsSchema } from "../../src/lib/validations/admin";
import { assertRoleGrantExpiration } from "../../src/server/services/role-policy";

describe("configuración administrativa", () => {
  it("mantiene in-app como canal de seguridad obligatorio", () => {
    expect(
      tenantSettingsSchema.safeParse({
        notificationChannels: [NotificationChannel.EMAIL],
        emergencyContacts: [],
      }).success,
    ).toBe(false);
    expect(
      tenantSettingsSchema.safeParse({
        notificationChannels: [
          NotificationChannel.IN_APP,
          NotificationChannel.EMAIL,
        ],
        emergencyContacts: ["Seguridad: 5555-0101"],
      }).success,
    ).toBe(true);
  });

  it("limita break-glass a una vigencia futura de hasta 24 horas", () => {
    const now = new Date("2026-08-07T12:00:00Z");
    expect(() =>
      assertRoleGrantExpiration(
        RoleName.SOPORTE_SISTEMA,
        new Date("2026-08-07T20:00:00Z"),
        now,
      ),
    ).not.toThrow();
    expect(() =>
      assertRoleGrantExpiration(RoleName.SOPORTE_SISTEMA, undefined, now),
    ).toThrow(/expiración futura/);
    expect(() =>
      assertRoleGrantExpiration(
        RoleName.SOPORTE_SISTEMA,
        new Date("2026-08-08T13:00:00Z"),
        now,
      ),
    ).toThrow(/24 horas/);
    expect(() =>
      assertRoleGrantExpiration(
        RoleName.ADMIN_GENERAL,
        new Date("2026-08-07T13:00:00Z"),
        now,
      ),
    ).toThrow(/Sólo el rol de soporte/);
  });
});

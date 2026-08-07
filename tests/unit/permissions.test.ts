import { RoleName } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { activeRoles, can } from "../../src/lib/permissions";

function user(role: RoleName, expiresAt?: Date | null) {
  return { roles: [{ role, expiresAt }] };
}

describe("RBAC", () => {
  it("permite al administrador administrar invitaciones y auditoría", () => {
    expect(can(user(RoleName.ADMIN_GENERAL), "invite", "invitation")).toBe(
      true,
    );
    expect(can(user(RoleName.ADMIN_GENERAL), "audit", "audit_log")).toBe(true);
  });

  it("niega a residentes y operadores la administración de invitaciones", () => {
    expect(can(user(RoleName.RESIDENTE), "invite", "invitation")).toBe(false);
    expect(can(user(RoleName.OPERACIONES), "revoke", "invitation")).toBe(false);
  });

  it("reserva el triage para personal operativo", () => {
    expect(can(user(RoleName.RESIDENTE), "triage", "ticket")).toBe(false);
    expect(can(user(RoleName.OPERACIONES), "triage", "ticket")).toBe(true);
    expect(can(user(RoleName.SEGURIDAD), "triage", "ticket")).toBe(true);
  });

  it("reserva la moderación al moderador y administrador", () => {
    expect(can(user(RoleName.MODERADOR), "read", "moderation")).toBe(true);
    expect(can(user(RoleName.MODERADOR), "moderate", "moderation")).toBe(true);
    expect(can(user(RoleName.ADMIN_GENERAL), "moderate", "moderation")).toBe(
      true,
    );
    expect(can(user(RoleName.RESIDENTE), "read", "moderation")).toBe(false);
    expect(can(user(RoleName.OPERACIONES), "moderate", "moderation")).toBe(
      false,
    );
  });

  it("mantiene los permisos operativos y de comunicación separados", () => {
    expect(can(user(RoleName.OPERACIONES), "update", "ticket")).toBe(true);
    expect(can(user(RoleName.OPERACIONES), "create", "notice")).toBe(false);
    expect(can(user(RoleName.COMUNICACIONES), "create", "notice")).toBe(true);
    expect(can(user(RoleName.COMUNICACIONES), "update", "ticket")).toBe(false);
  });

  it("ignora roles temporales vencidos", () => {
    const now = new Date("2026-08-06T12:00:00Z");
    const actor = user(
      RoleName.ADMIN_GENERAL,
      new Date("2026-08-06T11:59:59Z"),
    );
    expect(activeRoles(actor, now)).toEqual([]);
    expect(can(actor, "invite", "invitation", now)).toBe(false);
  });
});

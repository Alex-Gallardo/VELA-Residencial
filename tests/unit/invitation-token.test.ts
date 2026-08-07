import { describe, expect, it } from "vitest";

import {
  createInvitationToken,
  hashInvitationToken,
  invitationExpiresAt,
  isInvitationUsable,
} from "../../src/lib/invitation-token";

describe("invitaciones", () => {
  it("genera tokens únicos y sólo persiste un hash irreversible", () => {
    const first = createInvitationToken();
    const second = createInvitationToken();
    expect(first.token).not.toBe(second.token);
    expect(first.digest).toBe(hashInvitationToken(first.token));
    expect(first.digest).not.toContain(first.token);
    expect(first.digest).toHaveLength(64);
  });

  it("vence exactamente siete días después", () => {
    const now = new Date("2026-08-06T00:00:00Z");
    expect(invitationExpiresAt(now).toISOString()).toBe(
      "2026-08-13T00:00:00.000Z",
    );
  });

  it("rechaza invitaciones vencidas, aceptadas o revocadas", () => {
    const now = new Date("2026-08-06T00:00:00Z");
    const future = new Date("2026-08-07T00:00:00Z");
    expect(
      isInvitationUsable({ status: "PENDIENTE", expiresAt: future }, now),
    ).toBe(true);
    expect(
      isInvitationUsable({ status: "ACEPTADA", expiresAt: future }, now),
    ).toBe(false);
    expect(
      isInvitationUsable({ status: "REVOCADA", expiresAt: future }, now),
    ).toBe(false);
    expect(
      isInvitationUsable({ status: "PENDIENTE", expiresAt: now }, now),
    ).toBe(false);
  });
});

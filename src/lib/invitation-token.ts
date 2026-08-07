import { createHash, randomBytes } from "node:crypto";

export const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

export function createInvitationToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, digest: hashInvitationToken(token) };
}

export function hashInvitationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function invitationExpiresAt(now = new Date()) {
  return new Date(now.getTime() + INVITATION_LIFETIME_MS);
}

export function isInvitationUsable(
  invitation: { status: string; expiresAt: Date },
  now = new Date(),
) {
  return invitation.status === "PENDIENTE" && invitation.expiresAt > now;
}

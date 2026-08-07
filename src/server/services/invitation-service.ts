import {
  InvitationStatus,
  type HouseholdRelation,
  type RoleName,
} from "@prisma/client";

import {
  createInvitationToken,
  hashInvitationToken,
  invitationExpiresAt,
  isInvitationUsable,
} from "@/lib/invitation-token";
import { db } from "@/lib/db";
import { recordAuditEvent } from "@/server/services/audit-service";

type CreateInvitationInput = {
  tenantId: string;
  email: string;
  dwellingId?: string | null;
  relation?: HouseholdRelation | null;
  role: RoleName;
  createdById: string;
  appUrl: string;
};

export class InvitationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvitationError";
  }
}

export async function createInvitation(input: CreateInvitationInput) {
  const { token, digest } = createInvitationToken();
  const email = input.email.trim().toLowerCase();

  const invitation = await db.$transaction(async (transaction) => {
    if (input.dwellingId) {
      const dwelling = await transaction.dwelling.findFirst({
        where: { id: input.dwellingId, tenantId: input.tenantId },
        select: { id: true },
      });
      if (!dwelling)
        throw new InvitationError("La vivienda no pertenece al residencial");
    }

    await transaction.invitation.updateMany({
      where: {
        tenantId: input.tenantId,
        email,
        status: InvitationStatus.PENDIENTE,
      },
      data: { status: InvitationStatus.REVOCADA },
    });

    const created = await transaction.invitation.create({
      data: {
        tenantId: input.tenantId,
        email,
        dwellingId: input.dwellingId,
        relation: input.relation,
        role: input.role,
        token: digest,
        expiresAt: invitationExpiresAt(),
        createdById: input.createdById,
      },
    });

    await recordAuditEvent(transaction, {
      tenantId: input.tenantId,
      actorId: input.createdById,
      action: "invitation.created",
      entity: "Invitation",
      entityId: created.id,
      metadata: { email, role: input.role },
    });

    return created;
  });

  const baseUrl = input.appUrl.replace(/\/$/, "");
  return { invitation, url: `${baseUrl}/invitacion/${token}` };
}

export async function findInvitationByToken(token: string) {
  if (!token || token.length < 32) return null;

  const invitation = await db.invitation.findUnique({
    where: { token: hashInvitationToken(token) },
    include: { tenant: true },
  });

  if (!invitation || !isInvitationUsable(invitation)) return null;
  return invitation;
}

export async function revokeInvitation(input: {
  invitationId: string;
  tenantId: string;
  actorId: string;
}) {
  return db.$transaction(async (transaction) => {
    const changed = await transaction.invitation.updateMany({
      where: {
        id: input.invitationId,
        tenantId: input.tenantId,
        status: InvitationStatus.PENDIENTE,
      },
      data: { status: InvitationStatus.REVOCADA },
    });
    if (changed.count !== 1)
      throw new InvitationError("La invitación ya no se puede revocar");
    const invitation = await transaction.invitation.findUniqueOrThrow({
      where: { id: input.invitationId },
    });
    await recordAuditEvent(transaction, {
      tenantId: input.tenantId,
      actorId: input.actorId,
      action: "invitation.revoked",
      entity: "Invitation",
      entityId: invitation.id,
      metadata: { email: invitation.email },
    });
    return invitation;
  });
}

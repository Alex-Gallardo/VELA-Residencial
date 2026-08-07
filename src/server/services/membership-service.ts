import type { Prisma, PrismaClient, RoleName } from "@prisma/client";

import { recordAuditEvent } from "@/server/services/audit-service";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

type GrantRoleInput = {
  tenantId: string;
  membershipId: string;
  role: RoleName;
  actorId?: string | null;
  expiresAt?: Date | null;
};

export async function grantMembershipRole(
  database: DatabaseClient,
  input: GrantRoleInput,
) {
  const membershipRole = await database.membershipRole.upsert({
    where: {
      membershipId_role: {
        membershipId: input.membershipId,
        role: input.role,
      },
    },
    update: {
      expiresAt: input.expiresAt,
      grantedById: input.actorId,
    },
    create: {
      membershipId: input.membershipId,
      role: input.role,
      expiresAt: input.expiresAt,
      grantedById: input.actorId,
    },
  });

  await recordAuditEvent(database, {
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: "membership.role_granted",
    entity: "MembershipRole",
    entityId: membershipRole.id,
    metadata: { membershipId: input.membershipId, role: input.role },
  });

  return membershipRole;
}

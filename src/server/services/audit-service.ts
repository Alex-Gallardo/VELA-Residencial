import type { Prisma, PrismaClient } from "@prisma/client";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

export type AuditEvent = {
  tenantId: string;
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
  ip?: string | null;
};

export function recordAuditEvent(database: DatabaseClient, event: AuditEvent) {
  return database.auditLog.create({
    data: {
      tenantId: event.tenantId,
      actorId: event.actorId,
      action: event.action,
      entity: event.entity,
      entityId: event.entityId,
      metadata: event.metadata,
      ip: event.ip,
    },
  });
}

import {
  AttachmentStatus,
  Prisma,
  type PrismaClient,
  RoleName,
  TicketStatus,
} from "@prisma/client";

import type { CreateTicketInput } from "@/lib/validations/ticket";
import { recordAuditEvent } from "@/server/services/audit-service";
import {
  duplicateTitleSimilarity,
  normalizeDuplicateText,
} from "@/server/services/duplicate-detection";
import { calculateSlaDueAt } from "@/server/services/sla-service";
import { assertTicketTransition } from "@/server/services/ticket-state-machine";

export class TicketServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TicketServiceError";
  }
}

type CreateTicketServiceInput = CreateTicketInput & {
  tenantId: string;
  userId: string;
};

const OPEN_TICKET_STATUSES: TicketStatus[] = [
  TicketStatus.ENVIADO,
  TicketStatus.EN_REVISION,
  TicketStatus.PENDIENTE_INFO,
  TicketStatus.ASIGNADO,
  TicketStatus.EN_PROCESO,
  TicketStatus.ESCALADO,
  TicketStatus.REABIERTO,
];

export async function findPotentialTicketDuplicate(
  database: PrismaClient,
  input: {
    tenantId: string;
    userId: string;
    category: CreateTicketInput["category"];
    dwellingId: string;
    title: string;
  },
) {
  const candidates = await database.ticket.findMany({
    where: {
      tenantId: input.tenantId,
      category: input.category,
      dwellingId: input.dwellingId,
      status: { in: OPEN_TICKET_STATUSES },
      createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
    select: { id: true, number: true, title: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return (
    candidates.find(
      (candidate) =>
        duplicateTitleSimilarity(candidate.title, input.title) >= 0.6,
    ) ?? null
  );
}

export async function createTicket(
  database: PrismaClient,
  input: CreateTicketServiceInput,
) {
  return database.$transaction(
    async (transaction) => {
      const householdMember = await transaction.householdMember.findFirst({
        where: {
          tenantId: input.tenantId,
          userId: input.userId,
          household: {
            active: true,
            dwellingId: input.dwellingId,
            tenantId: input.tenantId,
          },
        },
        select: { id: true },
      });
      if (!householdMember)
        throw new TicketServiceError(
          "La vivienda no está asociada a tu cuenta en este residencial.",
        );

      const category = await transaction.categoryConfig.findUnique({
        where: {
          tenantId_category: {
            tenantId: input.tenantId,
            category: input.category,
          },
        },
      });
      if (!category?.active)
        throw new TicketServiceError("La categoría no está habilitada.");

      await transaction.$queryRaw`
        SELECT pg_advisory_xact_lock(hashtextextended(${`${input.tenantId}:${input.userId}`}, 0))::text
      `;
      const now = new Date();
      const [lastHour, lastDay, exactDuplicates] = await Promise.all([
        transaction.ticket.count({
          where: {
            tenantId: input.tenantId,
            createdById: input.userId,
            createdAt: { gte: new Date(now.getTime() - 60 * 60 * 1000) },
          },
        }),
        transaction.ticket.count({
          where: {
            tenantId: input.tenantId,
            createdById: input.userId,
            createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
          },
        }),
        transaction.ticket.findMany({
          where: {
            tenantId: input.tenantId,
            createdById: input.userId,
            category: input.category,
            dwellingId: input.dwellingId,
            createdAt: { gte: new Date(now.getTime() - 10 * 60 * 1000) },
          },
          select: { number: true, title: true },
        }),
      ]);
      if (lastHour >= 5 || lastDay >= 15)
        throw new TicketServiceError(
          "Alcanzaste el límite temporal de reportes. Espera antes de enviar otro.",
        );
      const exactDuplicate = exactDuplicates.find(
        (candidate) =>
          normalizeDuplicateText(candidate.title) ===
          normalizeDuplicateText(input.title),
      );
      if (exactDuplicate)
        throw new TicketServiceError(
          `Este reporte ya fue enviado como #${String(exactDuplicate.number).padStart(4, "0")}.`,
        );

      if (input.duplicateOfId) {
        const duplicateOf = await transaction.ticket.findFirst({
          where: {
            id: input.duplicateOfId,
            tenantId: input.tenantId,
            category: input.category,
            dwellingId: input.dwellingId,
            status: { in: OPEN_TICKET_STATUSES },
          },
          select: { id: true },
        });
        if (!duplicateOf)
          throw new TicketServiceError(
            "El reporte similar ya no está disponible para vincularlo.",
          );
      }

      if (input.attachmentId) {
        const attachment = await transaction.attachment.findFirst({
          where: {
            id: input.attachmentId,
            tenantId: input.tenantId,
            uploadedById: input.userId,
            ticketId: null,
            status: {
              in: [
                AttachmentStatus.SUBIDO,
                AttachmentStatus.PROCESANDO,
                AttachmentStatus.LISTO,
              ],
            },
          },
          select: { id: true },
        });
        if (!attachment)
          throw new TicketServiceError(
            "La imagen no terminó de cargarse o no pertenece a tu cuenta.",
          );
      }

      await transaction.$queryRaw`
        SELECT pg_advisory_xact_lock(hashtextextended(${input.tenantId}, 1))::text
      `;
      const latest = await transaction.ticket.aggregate({
        where: { tenantId: input.tenantId },
        _max: { number: true },
      });
      const number = (latest._max.number ?? 0) + 1;
      const createdAt = new Date();
      const ticket = await transaction.ticket.create({
        data: {
          tenantId: input.tenantId,
          number,
          title: input.title,
          description: input.description,
          category: input.category,
          createdById: input.userId,
          dwellingId: input.dwellingId,
          locationText: input.locationText || null,
          duplicateOfId: input.duplicateOfId || null,
          status: TicketStatus.ENVIADO,
          slaDueAt: calculateSlaDueAt(createdAt, category.slaHours),
          createdAt,
        },
      });

      if (input.attachmentId) {
        const bound = await transaction.attachment.updateMany({
          where: {
            id: input.attachmentId,
            tenantId: input.tenantId,
            uploadedById: input.userId,
            ticketId: null,
          },
          data: { ticketId: ticket.id },
        });
        if (bound.count !== 1)
          throw new TicketServiceError("No se pudo vincular la imagen.");
      }

      await transaction.ticketActivity.create({
        data: {
          tenantId: input.tenantId,
          ticketId: ticket.id,
          actorId: input.userId,
          toStatus: TicketStatus.ENVIADO,
          note: "Reporte creado",
        },
      });
      await recordAuditEvent(transaction, {
        tenantId: input.tenantId,
        actorId: input.userId,
        action: "ticket.created",
        entity: "Ticket",
        entityId: ticket.id,
        metadata: {
          number,
          category: input.category,
          attachmentId: input.attachmentId ?? null,
          duplicateOfId: input.duplicateOfId ?? null,
        },
      });
      return ticket;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  );
}

export async function assignTicket(
  database: PrismaClient,
  input: {
    tenantId: string;
    ticketId: string;
    assigneeId: string;
    actorId: string;
  },
) {
  return database.$transaction(async (transaction) => {
    const [ticket, assigneeMembership] = await Promise.all([
      transaction.ticket.findFirst({
        where: { id: input.ticketId, tenantId: input.tenantId },
      }),
      transaction.membership.findUnique({
        where: {
          tenantId_userId: {
            tenantId: input.tenantId,
            userId: input.assigneeId,
          },
        },
        include: { roles: true, user: true },
      }),
    ]);
    if (!ticket) throw new TicketServiceError("Reporte no encontrado.");
    const hasActiveStaffRole = assigneeMembership?.roles.some(
      ({ role, expiresAt }) =>
        role !== RoleName.RESIDENTE && (!expiresAt || expiresAt > new Date()),
    );
    if (!assigneeMembership?.active || !hasActiveStaffRole)
      throw new TicketServiceError(
        "El responsable debe ser personal activo del residencial.",
      );
    const finalizedStatuses: TicketStatus[] = [
      TicketStatus.RESUELTO,
      TicketStatus.CERRADO,
      TicketStatus.DUPLICADO,
      TicketStatus.RECHAZADO,
    ];
    if (finalizedStatuses.includes(ticket.status))
      throw new TicketServiceError(
        "Un reporte finalizado no se puede asignar.",
      );

    const assignableStatuses: TicketStatus[] = [
      TicketStatus.ENVIADO,
      TicketStatus.EN_REVISION,
      TicketStatus.PENDIENTE_INFO,
      TicketStatus.ESCALADO,
      TicketStatus.REABIERTO,
    ];
    const shouldMoveToAssigned = assignableStatuses.includes(ticket.status);
    if (shouldMoveToAssigned)
      assertTicketTransition(ticket.status, TicketStatus.ASIGNADO);
    const nextStatus = shouldMoveToAssigned
      ? TicketStatus.ASIGNADO
      : ticket.status;
    const updated = await transaction.ticket.update({
      where: { id: ticket.id },
      data: {
        assigneeId: input.assigneeId,
        status: nextStatus,
        ackAt: ticket.ackAt ?? new Date(),
      },
    });
    await transaction.ticketActivity.create({
      data: {
        tenantId: input.tenantId,
        ticketId: ticket.id,
        actorId: input.actorId,
        fromStatus: shouldMoveToAssigned ? ticket.status : null,
        toStatus: shouldMoveToAssigned ? nextStatus : null,
        note: `Asignado a ${assigneeMembership.user.fullName ?? assigneeMembership.user.email}`,
      },
    });
    await recordAuditEvent(transaction, {
      tenantId: input.tenantId,
      actorId: input.actorId,
      action: "ticket.assigned",
      entity: "Ticket",
      entityId: ticket.id,
      metadata: { assigneeId: input.assigneeId, status: nextStatus },
    });
    return updated;
  });
}

export async function transitionTicket(
  database: PrismaClient,
  input: {
    tenantId: string;
    ticketId: string;
    actorId: string;
    toStatus: TicketStatus;
    note?: string;
  },
) {
  return database.$transaction(async (transaction) => {
    const ticket = await transaction.ticket.findFirst({
      where: { id: input.ticketId, tenantId: input.tenantId },
    });
    if (!ticket) throw new TicketServiceError("Reporte no encontrado.");
    assertTicketTransition(ticket.status, input.toStatus);

    const now = new Date();
    const data: Prisma.TicketUncheckedUpdateInput = {
      status: input.toStatus,
      ackAt: ticket.ackAt ?? now,
    };
    if (input.toStatus === TicketStatus.RESUELTO) data.resolvedAt = now;
    if (input.toStatus === TicketStatus.CERRADO) data.closedAt = now;
    if (input.toStatus === TicketStatus.REABIERTO) {
      data.resolvedAt = null;
      data.closedAt = null;
    }
    const updated = await transaction.ticket.update({
      where: { id: ticket.id },
      data,
    });
    await transaction.ticketActivity.create({
      data: {
        tenantId: input.tenantId,
        ticketId: ticket.id,
        actorId: input.actorId,
        fromStatus: ticket.status,
        toStatus: input.toStatus,
        note: input.note || null,
      },
    });
    await recordAuditEvent(transaction, {
      tenantId: input.tenantId,
      actorId: input.actorId,
      action: "ticket.status_changed",
      entity: "Ticket",
      entityId: ticket.id,
      metadata: { from: ticket.status, to: input.toStatus },
    });
    return updated;
  });
}

export async function addTicketComment(
  database: PrismaClient,
  input: {
    tenantId: string;
    ticketId: string;
    authorId: string;
    body: string;
    isInternal: boolean;
    access: "resident" | "staff";
  },
) {
  return database.$transaction(async (transaction) => {
    const ticket = await transaction.ticket.findFirst({
      where: {
        id: input.ticketId,
        tenantId: input.tenantId,
        ...(input.access === "resident" ? { createdById: input.authorId } : {}),
      },
      select: { id: true },
    });
    if (!ticket) throw new TicketServiceError("Reporte no encontrado.");
    if (input.isInternal && input.access !== "staff")
      throw new TicketServiceError(
        "Una nota interna requiere permisos de personal.",
      );

    const comment = await transaction.ticketComment.create({
      data: {
        tenantId: input.tenantId,
        ticketId: ticket.id,
        authorId: input.authorId,
        body: input.body,
        isInternal: input.isInternal,
      },
    });
    if (input.isInternal) {
      await recordAuditEvent(transaction, {
        tenantId: input.tenantId,
        actorId: input.authorId,
        action: "ticket.internal_note_added",
        entity: "TicketComment",
        entityId: comment.id,
        metadata: { ticketId: ticket.id },
      });
    }
    return comment;
  });
}

import {
  InvitationStatus,
  ModerationStatus,
  NoticeType,
  TicketStatus,
  type PrismaClient,
} from "@prisma/client";

const FINAL_TICKET_STATUSES: TicketStatus[] = [
  TicketStatus.RESUELTO,
  TicketStatus.CERRADO,
  TicketStatus.DUPLICADO,
  TicketStatus.RECHAZADO,
];

const OPEN_TICKET_STATUSES = Object.values(TicketStatus).filter(
  (status) => !FINAL_TICKET_STATUSES.includes(status),
);

function averageHours(values: number[]) {
  if (!values.length) return null;
  return (
    values.reduce((sum, value) => sum + value, 0) / values.length / 3_600_000
  );
}

function percentage(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0;
}

export async function getDashboardMetrics(
  database: PrismaClient,
  tenantId: string,
  now = new Date(),
) {
  const riskBoundary = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const [
    tickets,
    slaRisk,
    moderationPending,
    criticalReceipts,
    activity,
    invitations,
  ] = await Promise.all([
    database.ticket.findMany({
      where: { tenantId },
      select: {
        status: true,
        category: true,
        duplicateOfId: true,
        createdAt: true,
        ackAt: true,
        resolvedAt: true,
        slaDueAt: true,
      },
    }),
    database.ticket.findMany({
      where: {
        tenantId,
        status: { in: OPEN_TICKET_STATUSES },
        slaDueAt: { lte: riskBoundary },
      },
      select: {
        id: true,
        number: true,
        title: true,
        status: true,
        slaDueAt: true,
      },
      orderBy: { slaDueAt: "asc" },
      take: 8,
    }),
    database.moderationItem.count({
      where: { tenantId, status: ModerationStatus.PENDIENTE },
    }),
    database.noticeReceipt.findMany({
      where: {
        tenantId,
        notice: { type: NoticeType.ALERTA_CRITICA, deliveredAt: { not: null } },
      },
      select: { readAt: true },
    }),
    database.auditLog.findMany({
      where: { tenantId },
      include: { actor: { select: { fullName: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    database.invitation.groupBy({
      by: ["status"],
      where: { tenantId },
      _count: true,
    }),
  ]);

  const ticketsByStatus = Object.fromEntries(
    Object.values(TicketStatus).map((status) => [
      status,
      tickets.filter((ticket) => ticket.status === status).length,
    ]),
  ) as Record<TicketStatus, number>;
  const ticketsByCategory = new Map<string, number>();
  for (const ticket of tickets)
    ticketsByCategory.set(
      ticket.category,
      (ticketsByCategory.get(ticket.category) ?? 0) + 1,
    );

  const firstResponseHours = averageHours(
    tickets.flatMap((ticket) =>
      ticket.ackAt ? [ticket.ackAt.getTime() - ticket.createdAt.getTime()] : [],
    ),
  );
  const resolutionHours = averageHours(
    tickets.flatMap((ticket) =>
      ticket.resolvedAt
        ? [ticket.resolvedAt.getTime() - ticket.createdAt.getTime()]
        : [],
    ),
  );
  const resolvedWithSla = tickets.filter(
    (ticket) => ticket.resolvedAt && ticket.slaDueAt,
  );
  const slaMet = resolvedWithSla.filter(
    (ticket) => ticket.resolvedAt! <= ticket.slaDueAt!,
  ).length;
  const invitationTotal = invitations.reduce(
    (total, item) => total + item._count,
    0,
  );
  const acceptedInvitations =
    invitations.find(({ status }) => status === InvitationStatus.ACEPTADA)
      ?._count ?? 0;

  return {
    ticketTotal: tickets.length,
    ticketsByStatus,
    ticketsByCategory: [...ticketsByCategory.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count),
    slaRisk,
    firstResponseHours,
    resolutionHours,
    slaCompliance: percentage(slaMet, resolvedWithSla.length),
    duplicateRate: percentage(
      tickets.filter(({ duplicateOfId }) => duplicateOfId).length,
      tickets.length,
    ),
    moderationPending,
    criticalReadRate: percentage(
      criticalReceipts.filter(({ readAt }) => readAt).length,
      criticalReceipts.length,
    ),
    criticalReceiptTotal: criticalReceipts.length,
    invitationAcceptance: percentage(acceptedInvitations, invitationTotal),
    activity,
  };
}

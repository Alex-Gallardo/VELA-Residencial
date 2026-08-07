import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { arch, platform, tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";

import {
  AttachmentStatus,
  ModerationStatus,
  NoticeType,
  NotificationChannel,
  PrismaClient,
  RoleName,
  TicketCategory,
  TicketStatus,
} from "@prisma/client";
import EmbeddedPostgres from "embedded-postgres";

import { grantMembershipRole } from "../src/server/services/membership-service";
import {
  ModerationServiceError,
  reviewModerationItem,
} from "../src/server/services/moderation-service";
import {
  createNotice,
  markNoticeRead,
  publishDueNotices,
} from "../src/server/services/notice-service";
import {
  addTicketComment,
  assignTicket,
  createTicket,
  TicketServiceError,
  transitionTicket,
} from "../src/server/services/ticket-service";

const DATABASE_NAME = "vela_test";
const DATABASE_USER = "postgres";
const DATABASE_PASSWORD = "vela-local-test";

async function findFreePort() {
  const server = createServer();
  await new Promise<void>((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolvePromise);
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("No se pudo reservar un puerto local");
  await new Promise<void>((resolvePromise, reject) =>
    server.close((error) => (error ? reject(error) : resolvePromise())),
  );
  return address.port;
}

function runNpm(args: string[]) {
  const npmCli = process.env.npm_execpath;
  if (!npmCli) throw new Error("npm_execpath no esta disponible");
  execFileSync(process.execPath, [npmCli, ...args], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });
}

async function bootstrapSupabasePrimitives(databaseUrl: string) {
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  try {
    await prisma.$executeRawUnsafe("CREATE SCHEMA IF NOT EXISTS auth");
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        CREATE ROLE authenticated NOLOGIN;
      EXCEPTION WHEN duplicate_object THEN
        NULL;
      END
      $$
    `);
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION auth.uid()
      RETURNS uuid
      LANGUAGE sql
      STABLE
      AS $$
        SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$
    `);
  } finally {
    await prisma.$disconnect();
  }
}

async function visibleDwellingTenants(prisma: PrismaClient, userId: string) {
  return prisma.$transaction(async (transaction) => {
    await transaction.$executeRawUnsafe("SET LOCAL ROLE authenticated");
    await transaction.$executeRawUnsafe(
      "SELECT set_config('request.jwt.claim.sub', $1, true)",
      userId,
    );
    return transaction.$queryRaw<Array<{ tenantId: string }>>`
      SELECT "tenantId" FROM "Dwelling" ORDER BY "tenantId"
    `;
  });
}

async function visibleTicketComments(
  prisma: PrismaClient,
  userId: string,
  ticketId: string,
) {
  return prisma.$transaction(async (transaction) => {
    await transaction.$executeRawUnsafe("SET LOCAL ROLE authenticated");
    await transaction.$executeRawUnsafe(
      "SELECT set_config('request.jwt.claim.sub', $1, true)",
      userId,
    );
    return transaction.$queryRaw<Array<{ body: string; isInternal: boolean }>>`
      SELECT "body", "isInternal"
      FROM "TicketComment"
      WHERE "ticketId" = ${ticketId}
      ORDER BY "createdAt"
    `;
  });
}

async function visibleModerationItems(prisma: PrismaClient, userId: string) {
  return prisma.$transaction(async (transaction) => {
    await transaction.$executeRawUnsafe("SET LOCAL ROLE authenticated");
    await transaction.$executeRawUnsafe(
      "SELECT set_config('request.jwt.claim.sub', $1, true)",
      userId,
    );
    return transaction.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "ModerationItem"
    `;
  });
}

async function visibleNotices(prisma: PrismaClient, userId: string) {
  return prisma.$transaction(async (transaction) => {
    await transaction.$executeRawUnsafe("SET LOCAL ROLE authenticated");
    await transaction.$executeRawUnsafe(
      "SELECT set_config('request.jwt.claim.sub', $1, true)",
      userId,
    );
    return transaction.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Notice" ORDER BY "createdAt"
    `;
  });
}

async function noticeRlsDiagnostics(
  prisma: PrismaClient,
  userId: string,
  noticeId: string,
) {
  return prisma.$transaction(async (transaction) => {
    await transaction.$executeRawUnsafe("SET LOCAL ROLE authenticated");
    await transaction.$executeRawUnsafe(
      "SELECT set_config('request.jwt.claim.sub', $1, true)",
      userId,
    );
    return transaction.$queryRaw`
      SELECT
        auth.uid()::text AS uid,
        public.auth_can_access_notice(${noticeId}) AS can_access,
        (SELECT count(*)::int FROM "NoticeReceipt" WHERE "noticeId" = ${noticeId}) AS visible_receipts,
        now() AS database_now
    `;
  });
}

async function canInsertAttachment(
  prisma: PrismaClient,
  input: { userId: string; tenantId: string },
) {
  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe("SET LOCAL ROLE authenticated");
      await transaction.$executeRawUnsafe(
        "SELECT set_config('request.jwt.claim.sub', $1, true)",
        input.userId,
      );
      await transaction.$executeRaw`
        INSERT INTO "Attachment" (
          "id", "tenantId", "uploadedById", "mimeType", "sizeBytes", "updatedAt"
        ) VALUES (
          'rls-forbidden-attachment', ${input.tenantId}, ${input.userId},
          'image/jpeg', 32, CURRENT_TIMESTAMP
        )
      `;
    });
    return true;
  } catch {
    return false;
  }
}

async function stopPostgres(postgres: EmbeddedPostgres, databaseDir: string) {
  const platformName = platform() === "win32" ? "windows" : platform();
  const binaryPackage = `@embedded-postgres/${platformName}-${arch()}`;
  const binaries = (await import(binaryPackage)) as { pg_ctl: string };
  execFileSync(
    binaries.pg_ctl,
    ["stop", "-D", databaseDir, "-m", "fast", "-w"],
    { stdio: "inherit" },
  );
  (postgres as unknown as { process?: undefined }).process = undefined;
}

async function main() {
  const port = await findFreePort();
  const databaseDir = await mkdtemp(join(tmpdir(), "vela-postgres-"));
  const resolvedTemp = resolve(tmpdir()) + sep;
  const resolvedDatabaseDir = resolve(databaseDir);
  if (!resolvedDatabaseDir.startsWith(resolvedTemp))
    throw new Error("Directorio temporal fuera del area permitida");

  const postgres = new EmbeddedPostgres({
    databaseDir,
    user: DATABASE_USER,
    password: DATABASE_PASSWORD,
    port,
    persistent: true,
    onLog: () => undefined,
    onError: (message) => console.error(message),
  });

  let started = false;
  try {
    await postgres.initialise();
    await postgres.start();
    started = true;
    await postgres.createDatabase(DATABASE_NAME);

    const databaseUrl = `postgresql://${DATABASE_USER}:${DATABASE_PASSWORD}@127.0.0.1:${port}/${DATABASE_NAME}`;
    process.env.DATABASE_URL = databaseUrl;
    process.env.DIRECT_URL = databaseUrl;

    await bootstrapSupabasePrimitives(databaseUrl);
    runNpm(["run", "db:deploy"]);
    runNpm(["run", "db:seed"]);
    runNpm(["run", "db:seed"]);

    const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
    try {
      const [tenants, users, dwellings, categories, tickets] =
        await Promise.all([
          prisma.tenant.count({ where: { slug: "los-robles-demo" } }),
          prisma.user.count({ where: { email: { endsWith: "@vela.demo" } } }),
          prisma.dwelling.count({
            where: { tenant: { slug: "los-robles-demo" } },
          }),
          prisma.categoryConfig.count({
            where: { tenant: { slug: "los-robles-demo" } },
          }),
          prisma.ticket.count({
            where: { tenant: { slug: "los-robles-demo" } },
          }),
        ]);

      if (
        tenants !== 1 ||
        users !== 2 ||
        dwellings !== 1 ||
        categories !== 9 ||
        tickets !== 1
      ) {
        throw new Error(
          `Seed inesperado: tenants=${tenants}, users=${users}, dwellings=${dwellings}, categories=${categories}, tickets=${tickets}`,
        );
      }

      const tenantB = await prisma.tenant.create({
        data: { name: "Residencial Encinos", slug: "encinos-rls-test" },
      });
      const userB = await prisma.user.create({
        data: {
          id: "00000000-0000-4000-8000-000000000099",
          email: "rls-b@vela.demo",
          fullName: "Usuario Tenant B",
        },
      });
      const membershipB = await prisma.membership.create({
        data: { tenantId: tenantB.id, userId: userB.id },
      });
      await prisma.membershipRole.create({
        data: { membershipId: membershipB.id, role: RoleName.RESIDENTE },
      });
      await prisma.dwelling.create({
        data: { tenantId: tenantB.id, code: "Casa B-1" },
      });

      const tenantAId = "vela_demo_tenant";
      const [visibleToA, visibleToB] = await Promise.all([
        visibleDwellingTenants(prisma, "00000000-0000-4000-8000-000000000002"),
        visibleDwellingTenants(prisma, userB.id),
      ]);
      if (
        visibleToA.length !== 1 ||
        visibleToA[0]?.tenantId !== tenantAId ||
        visibleToB.length !== 1 ||
        visibleToB[0]?.tenantId !== tenantB.id
      ) {
        throw new Error(
          `Aislamiento RLS invalido: A=${JSON.stringify(visibleToA)}, B=${JSON.stringify(visibleToB)}`,
        );
      }

      const adminId = "00000000-0000-4000-8000-000000000001";
      const residentId = "00000000-0000-4000-8000-000000000002";
      const otherResidentId = "00000000-0000-4000-8000-000000000003";
      const otherResident = await prisma.user.create({
        data: {
          id: otherResidentId,
          email: "residente-calle5@vela.demo",
          fullName: "Residente Calle 5",
        },
      });
      const otherMembership = await prisma.membership.create({
        data: { tenantId: tenantAId, userId: otherResident.id },
      });
      await prisma.membershipRole.create({
        data: { membershipId: otherMembership.id, role: RoleName.RESIDENTE },
      });
      const otherDwelling = await prisma.dwelling.create({
        data: {
          tenantId: tenantAId,
          code: "Casa 13",
          zone: "Calle 5",
        },
      });
      await prisma.household.create({
        data: {
          tenantId: tenantAId,
          dwellingId: otherDwelling.id,
          name: "Familia Calle 5",
          members: {
            create: {
              tenantId: tenantAId,
              userId: otherResident.id,
              fullName: otherResident.fullName ?? "Residente Calle 5",
              relation: "PROPIETARIO",
              isPrimary: true,
            },
          },
        },
      });
      const adminMembership = await prisma.membership.findUniqueOrThrow({
        where: { tenantId_userId: { tenantId: tenantAId, userId: adminId } },
      });
      await grantMembershipRole(prisma, {
        tenantId: tenantAId,
        membershipId: adminMembership.id,
        role: RoleName.FINANZAS,
        actorId: adminId,
      });
      const auditedRoleChanges = await prisma.auditLog.count({
        where: {
          tenantId: tenantAId,
          action: "membership.role_granted",
          entityId: { not: null },
        },
      });
      if (auditedRoleChanges !== 1)
        throw new Error("El cambio de rol no genero un AuditLog");

      const noticeNow = new Date();
      const publishedNotice = await createNotice(
        prisma,
        {
          tenantId: tenantAId,
          actorId: adminId,
          type: NoticeType.ALERTA_CRITICA,
          title: "Corte temporal en Calle 4",
          body: "El servicio de agua se suspenderá por mantenimiento preventivo.",
          audience: { scope: "ZONE", values: ["Calle 4"] },
          channels: [NotificationChannel.IN_APP],
          requiresReadReceipt: true,
          publishedAt: new Date(noticeNow.getTime() - 60_000),
        },
        noticeNow,
      );
      const [residentNotices, otherResidentNotices, adminNotices] =
        await Promise.all([
          visibleNotices(prisma, residentId),
          visibleNotices(prisma, otherResidentId),
          visibleNotices(prisma, adminId),
        ]);
      if (
        publishedNotice.recipientCount !== 1 ||
        residentNotices.length !== 1 ||
        otherResidentNotices.length !== 0 ||
        adminNotices.length !== 1
      ) {
        const diagnostics = await noticeRlsDiagnostics(
          prisma,
          residentId,
          publishedNotice.notice.id,
        );
        throw new Error(
          `Segmentación/RLS de avisos inválida: destinatarios=${publishedNotice.recipientCount}, residente=${residentNotices.length}, fuera=${otherResidentNotices.length}, admin=${adminNotices.length}, aviso=${JSON.stringify(publishedNotice.notice)}, diagnóstico=${JSON.stringify(diagnostics)}`,
        );
      }
      await markNoticeRead(
        prisma,
        {
          tenantId: tenantAId,
          noticeId: publishedNotice.notice.id,
          userId: residentId,
        },
        noticeNow,
      );
      const [receipt, inAppNotification] = await Promise.all([
        prisma.noticeReceipt.findUniqueOrThrow({
          where: {
            noticeId_userId: {
              noticeId: publishedNotice.notice.id,
              userId: residentId,
            },
          },
        }),
        prisma.notification.findFirstOrThrow({
          where: {
            tenantId: tenantAId,
            userId: residentId,
            linkUrl: `/avisos/${publishedNotice.notice.id}`,
          },
        }),
      ]);
      if (!receipt.readAt || !inAppNotification.readAt)
        throw new Error(
          "El acuse de lectura no sincronizó aviso y notificación",
        );

      const scheduledAt = new Date(noticeNow.getTime() + 60 * 60 * 1000);
      const scheduled = await createNotice(
        prisma,
        {
          tenantId: tenantAId,
          actorId: adminId,
          type: NoticeType.COMUNICADO_ADMIN,
          title: "Asamblea mensual programada",
          body: "La asamblea mensual se realizará en el salón comunitario.",
          audience: { scope: "ROLE", values: [RoleName.RESIDENTE] },
          channels: [NotificationChannel.IN_APP],
          requiresReadReceipt: true,
          publishedAt: scheduledAt,
        },
        noticeNow,
      );
      if (scheduled.notice.deliveredAt)
        throw new Error("El aviso programado se publicó antes de tiempo");
      const due = await publishDueNotices(
        prisma,
        new Date(scheduledAt.getTime() + 1_000),
      );
      if (due.length !== 1 || due[0]?.recipientCount !== 2)
        throw new Error("El procesador no publicó el aviso programado");

      const ticketInput = {
        tenantId: tenantAId,
        userId: residentId,
        category: TicketCategory.MANTENIMIENTO,
        description:
          "La llave principal pierde agua continuamente desde esta manana.",
        locationText: "Casa 12, entrada principal",
        dwellingId: "vela_demo_dwelling_001",
      };
      const [firstCreatedTicket, secondCreatedTicket] = await Promise.all([
        createTicket(prisma, {
          ...ticketInput,
          title: "Fuga en llave principal",
        }),
        createTicket(prisma, {
          ...ticketInput,
          title: "Revision de tuberia exterior",
        }),
      ]);
      const consecutiveNumbers = [
        firstCreatedTicket.number,
        secondCreatedTicket.number,
      ].sort((left, right) => left - right);
      if (consecutiveNumbers[0] !== 2 || consecutiveNumbers[1] !== 3)
        throw new Error(
          `Correlativo concurrente invalido: ${consecutiveNumbers.join(", ")}`,
        );
      if (
        !firstCreatedTicket.slaDueAt ||
        firstCreatedTicket.slaDueAt.getTime() -
          firstCreatedTicket.createdAt.getTime() !==
          48 * 60 * 60 * 1000
      )
        throw new Error(
          "El SLA de categoria no se calculo al crear el reporte",
        );

      let duplicateBlocked = false;
      try {
        await createTicket(prisma, {
          ...ticketInput,
          title: "  FÚGA en llave principal! ",
        });
      } catch (error) {
        duplicateBlocked =
          error instanceof TicketServiceError &&
          error.message.includes("ya fue enviado");
      }
      if (!duplicateBlocked)
        throw new Error("El duplicado exacto no fue bloqueado");

      const attachment = await prisma.attachment.create({
        data: {
          tenantId: tenantAId,
          ticketId: firstCreatedTicket.id,
          uploadedById: residentId,
          status: AttachmentStatus.LISTO,
          storageKey: "processed/test/image.webp",
          originalName: "evidencia.jpg",
          mimeType: "image/webp",
          sizeBytes: 128,
          checksumSha256: "a".repeat(64),
          width: 100,
          height: 80,
          exifStripped: true,
          processedAt: new Date(),
        },
      });
      const moderation = await prisma.moderationItem.create({
        data: {
          tenantId: tenantAId,
          attachmentId: attachment.id,
          status: ModerationStatus.EN_REVISION_HUMANA,
          provider: "deferred",
          labels: [{ name: "provider_pending", confidence: null }],
        },
      });
      await reviewModerationItem(prisma, {
        moderationId: moderation.id,
        tenantId: tenantAId,
        reviewerId: adminId,
        decision: "APROBADO",
        reason: "Contenido residencial permitido.",
      });
      const failedAttachment = await prisma.attachment.create({
        data: {
          tenantId: tenantAId,
          ticketId: firstCreatedTicket.id,
          uploadedById: residentId,
          status: AttachmentStatus.FALLIDO,
          quarantineKey: "quarantine/test/failed.jpg",
          originalName: "fallida.jpg",
          mimeType: "image/jpeg",
          sizeBytes: 64,
          failureReason: "Error transitorio",
        },
      });
      const failedModeration = await prisma.moderationItem.create({
        data: {
          tenantId: tenantAId,
          attachmentId: failedAttachment.id,
          status: ModerationStatus.EN_REVISION_HUMANA,
          provider: "deferred",
          labels: [{ name: "provider_pending", confidence: null }],
        },
      });
      let failedReviewBlocked = false;
      try {
        await reviewModerationItem(prisma, {
          moderationId: failedModeration.id,
          tenantId: tenantAId,
          reviewerId: adminId,
          decision: "APROBADO",
          reason: "No debe aceptarse todavía.",
        });
      } catch (error) {
        failedReviewBlocked = error instanceof ModerationServiceError;
      }
      const [reviewed, residentModeration, moderatorModeration, rawInsert] =
        await Promise.all([
          prisma.moderationItem.findUniqueOrThrow({
            where: { id: moderation.id },
          }),
          visibleModerationItems(prisma, residentId),
          visibleModerationItems(prisma, adminId),
          canInsertAttachment(prisma, {
            userId: residentId,
            tenantId: tenantAId,
          }),
        ]);
      if (
        reviewed.status !== ModerationStatus.APROBADO ||
        reviewed.reviewedById !== adminId ||
        !reviewed.reviewedAt ||
        !failedReviewBlocked
      )
        throw new Error("La decisión humana no quedó registrada");
      if (
        residentModeration.length !== 0 ||
        moderatorModeration.length !== 2 ||
        rawInsert
      )
        throw new Error(
          `RLS de adjuntos/moderación inválido: residente=${residentModeration.length}, moderador=${moderatorModeration.length}, inserción=${rawInsert}`,
        );

      await assignTicket(prisma, {
        tenantId: tenantAId,
        ticketId: firstCreatedTicket.id,
        assigneeId: adminId,
        actorId: adminId,
      });
      await transitionTicket(prisma, {
        tenantId: tenantAId,
        ticketId: firstCreatedTicket.id,
        actorId: adminId,
        toStatus: TicketStatus.EN_PROCESO,
      });
      const resolvedTicket = await transitionTicket(prisma, {
        tenantId: tenantAId,
        ticketId: firstCreatedTicket.id,
        actorId: adminId,
        toStatus: TicketStatus.RESUELTO,
        note: "Reparacion finalizada",
      });
      if (!resolvedTicket.resolvedAt)
        throw new Error("Resolver el reporte no registro resolvedAt");

      const publicBody = "La reparacion fue completada y verificada.";
      const internalBody = "Nota interna exclusiva para operaciones.";
      await addTicketComment(prisma, {
        tenantId: tenantAId,
        ticketId: firstCreatedTicket.id,
        authorId: adminId,
        body: publicBody,
        isInternal: false,
        access: "staff",
      });
      await addTicketComment(prisma, {
        tenantId: tenantAId,
        ticketId: firstCreatedTicket.id,
        authorId: adminId,
        body: internalBody,
        isInternal: true,
        access: "staff",
      });

      const [activities, residentComments, staffComments, statusAudits] =
        await Promise.all([
          prisma.ticketActivity.findMany({
            where: { ticketId: firstCreatedTicket.id },
            orderBy: { createdAt: "asc" },
            select: { toStatus: true },
          }),
          visibleTicketComments(prisma, residentId, firstCreatedTicket.id),
          visibleTicketComments(prisma, adminId, firstCreatedTicket.id),
          prisma.auditLog.count({
            where: {
              tenantId: tenantAId,
              entityId: firstCreatedTicket.id,
              action: "ticket.status_changed",
            },
          }),
        ]);
      const activityStatuses = activities.flatMap(({ toStatus }) =>
        toStatus ? [toStatus] : [],
      );
      const expectedStatuses = [
        TicketStatus.ENVIADO,
        TicketStatus.ASIGNADO,
        TicketStatus.EN_PROCESO,
        TicketStatus.RESUELTO,
      ];
      if (
        activityStatuses.length !== expectedStatuses.length ||
        activityStatuses.some(
          (status, index) => status !== expectedStatuses[index],
        )
      )
        throw new Error(
          `Historial de estados invalido: ${activityStatuses.join(", ")}`,
        );
      if (
        residentComments.length !== 1 ||
        residentComments[0]?.body !== publicBody ||
        residentComments[0]?.isInternal
      )
        throw new Error(
          `RLS expuso una nota interna al residente: ${JSON.stringify(residentComments)}`,
        );
      if (staffComments.length !== 2 || statusAudits !== 2)
        throw new Error(
          `Visibilidad o auditoria incompleta: staff=${staffComments.length}, audits=${statusAudits}`,
        );

      await createTicket(prisma, {
        ...ticketInput,
        title: "Revisión preventiva del contador",
      });
      await createTicket(prisma, {
        ...ticketInput,
        title: "Humedad en pared del patio",
      });
      let rateLimitBlocked = false;
      try {
        await createTicket(prisma, {
          ...ticketInput,
          title: "Solicitud adicional sobre tubería",
        });
      } catch (error) {
        rateLimitBlocked =
          error instanceof TicketServiceError &&
          error.message.includes("límite temporal");
      }
      const moderationAudits = await prisma.auditLog.count({
        where: {
          tenantId: tenantAId,
          action: "moderation.reviewed",
          entityId: moderation.id,
        },
      });
      if (!rateLimitBlocked || moderationAudits !== 1)
        throw new Error(
          `Controles Sprint 3 incompletos: rateLimit=${rateLimitBlocked}, moderationAudits=${moderationAudits}`,
        );

      console.log(
        "✓ Migraciones, RLS, correlativo, SLA, moderación, avisos segmentados/programados, notificaciones, rate limit y auditoría verificados",
      );
    } finally {
      await prisma.$disconnect();
    }
  } finally {
    if (started) await stopPostgres(postgres, resolvedDatabaseDir);
    await rm(resolvedDatabaseDir, {
      recursive: true,
      force: true,
      maxRetries: 8,
      retryDelay: 250,
    });
  }
}

main().catch((error: unknown) => {
  console.error(
    `✗ ${error instanceof Error ? error.message : "Fallo desconocido al verificar PostgreSQL"}`,
  );
  process.exitCode = 1;
});

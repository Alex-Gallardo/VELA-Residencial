import { randomBytes } from "node:crypto";

import {
  HouseholdRelation,
  PrismaClient,
  RoleName,
  TicketCategory,
  TicketStatus,
} from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const prisma = new PrismaClient();
const AUTH_MARKER = "-s2-e2e-";
const TENANT_PREFIX = "sprint-2-e2e-";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error("Faltan credenciales administrativas de Supabase");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function publicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Faltan credenciales publicas de Supabase");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function cleanup() {
  const supabase = adminClient();
  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error) throw error;
  for (const user of data.users) {
    if (user.email?.includes(AUTH_MARKER)) {
      const deletion = await supabase.auth.admin.deleteUser(user.id);
      if (deletion.error) throw deletion.error;
    }
  }

  await prisma.tenant.deleteMany({
    where: { slug: { startsWith: TENANT_PREFIX } },
  });
  await prisma.user.deleteMany({ where: { email: { contains: AUTH_MARKER } } });
  console.log(JSON.stringify({ cleaned: true }));
}

async function createAuthUser(
  email: string,
  password: string,
  fullName: string,
) {
  const { data, error } = await adminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user)
    throw error ?? new Error(`No se creo el usuario ${email}`);

  const verifier = publicClient();
  const { error: loginError } = await verifier.auth.signInWithPassword({
    email,
    password,
  });
  if (loginError)
    throw new Error(
      `La fixture no puede iniciar sesion: ${loginError.message}`,
    );
  await verifier.auth.signOut();
  return data.user;
}

async function setup() {
  await cleanup();
  const suffix = Date.now().toString(36);
  const adminEmail = `admin${AUTH_MARKER}${suffix}@vela.demo`;
  const residentEmail = `resident${AUTH_MARKER}${suffix}@vela.demo`;
  const password = `Vela!${randomBytes(18).toString("base64url")}`;
  const adminAuth = await createAuthUser(
    adminEmail,
    password,
    "Administracion Sprint 2",
  );
  const residentAuth = await createAuthUser(
    residentEmail,
    password,
    "Residente Sprint 2",
  );

  const tenant = await prisma.tenant.create({
    data: {
      name: "Residencial Prueba Sprint 2",
      slug: `${TENANT_PREFIX}${suffix}`,
      plan: "test",
    },
  });
  const [admin, resident] = await Promise.all([
    prisma.user.create({
      data: {
        id: adminAuth.id,
        email: adminEmail,
        fullName: "Administracion Sprint 2",
      },
    }),
    prisma.user.create({
      data: {
        id: residentAuth.id,
        email: residentEmail,
        fullName: "Residente Sprint 2",
      },
    }),
  ]);
  const [adminMembership, residentMembership, dwelling] = await Promise.all([
    prisma.membership.create({
      data: { tenantId: tenant.id, userId: admin.id },
    }),
    prisma.membership.create({
      data: { tenantId: tenant.id, userId: resident.id },
    }),
    prisma.dwelling.create({
      data: {
        tenantId: tenant.id,
        code: "Casa E2E-02",
        zone: "Zona de pruebas",
      },
    }),
  ]);
  await Promise.all([
    prisma.membershipRole.create({
      data: {
        membershipId: adminMembership.id,
        role: RoleName.ADMIN_GENERAL,
      },
    }),
    prisma.membershipRole.create({
      data: {
        membershipId: residentMembership.id,
        role: RoleName.RESIDENTE,
      },
    }),
    prisma.categoryConfig.createMany({
      data: Object.values(TicketCategory).map((category) => ({
        tenantId: tenant.id,
        category,
        slaHours: category === TicketCategory.SEGURIDAD ? 4 : 48,
      })),
    }),
  ]);
  await prisma.household.create({
    data: {
      tenantId: tenant.id,
      dwellingId: dwelling.id,
      name: "Familia E2E",
      members: {
        create: {
          tenantId: tenant.id,
          userId: resident.id,
          relation: HouseholdRelation.PROPIETARIO,
          fullName: resident.fullName ?? "Residente Sprint 2",
        },
      },
    },
  });

  console.log(
    JSON.stringify({
      adminEmail,
      residentEmail,
      password,
      tenantId: tenant.id,
      adminId: admin.id,
      residentId: resident.id,
    }),
  );
}

async function verify() {
  const tenant = await prisma.tenant.findFirstOrThrow({
    where: { slug: { startsWith: TENANT_PREFIX } },
  });
  const ticket = await prisma.ticket.findFirstOrThrow({
    where: { tenantId: tenant.id },
    include: {
      activities: { orderBy: { createdAt: "asc" } },
      comments: true,
      assignee: true,
    },
  });
  const statusHistory = ticket.activities.flatMap(({ toStatus }) =>
    toStatus ? [toStatus] : [],
  );
  const expectedHistory = [
    TicketStatus.ENVIADO,
    TicketStatus.ASIGNADO,
    TicketStatus.EN_PROCESO,
    TicketStatus.RESUELTO,
  ];
  const publicComments = ticket.comments.filter(
    ({ isInternal }) => !isInternal,
  );
  const internalComments = ticket.comments.filter(
    ({ isInternal }) => isInternal,
  );
  const [createdAudits, assignedAudits, statusAudits, internalNoteAudits] =
    await Promise.all([
      prisma.auditLog.count({
        where: { tenantId: tenant.id, action: "ticket.created" },
      }),
      prisma.auditLog.count({
        where: { tenantId: tenant.id, action: "ticket.assigned" },
      }),
      prisma.auditLog.count({
        where: { tenantId: tenant.id, action: "ticket.status_changed" },
      }),
      prisma.auditLog.count({
        where: { tenantId: tenant.id, action: "ticket.internal_note_added" },
      }),
    ]);
  const hasExpectedHistory =
    statusHistory.length === expectedHistory.length &&
    statusHistory.every((status, index) => status === expectedHistory[index]);
  const slaHours = ticket.slaDueAt
    ? (ticket.slaDueAt.getTime() - ticket.createdAt.getTime()) /
      (60 * 60 * 1000)
    : null;
  if (
    ticket.number !== 1 ||
    ticket.status !== TicketStatus.RESUELTO ||
    !ticket.resolvedAt ||
    !ticket.assignee ||
    slaHours !== 48 ||
    !hasExpectedHistory ||
    publicComments.length !== 2 ||
    internalComments.length !== 1 ||
    createdAudits !== 1 ||
    assignedAudits !== 1 ||
    statusAudits !== 2 ||
    internalNoteAudits !== 1
  ) {
    throw new Error(
      `La persistencia E2E no cumple SPRINT-2: ${JSON.stringify({
        number: ticket.number,
        status: ticket.status,
        hasResolvedAt: Boolean(ticket.resolvedAt),
        assignee: ticket.assignee?.email,
        slaHours,
        statusHistory,
        publicComments: publicComments.length,
        internalComments: internalComments.length,
        createdAudits,
        assignedAudits,
        statusAudits,
        internalNoteAudits,
      })}`,
    );
  }
  console.log(
    JSON.stringify({
      verified: true,
      ticket: `#${ticket.number.toString().padStart(3, "0")}`,
      status: ticket.status,
      assignee: ticket.assignee.email,
      slaHours,
      statusHistory,
      publicComments: publicComments.length,
      internalComments: internalComments.length,
      audits: {
        created: createdAudits,
        assigned: assignedAudits,
        statusChanges: statusAudits,
        internalNotes: internalNoteAudits,
      },
    }),
  );
}

const mode = process.argv[2];
const task =
  mode === "cleanup" ? cleanup() : mode === "verify" ? verify() : setup();
task
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());

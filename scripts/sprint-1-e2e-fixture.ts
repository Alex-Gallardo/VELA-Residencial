import { randomBytes } from "node:crypto";

import { PrismaClient, RoleName } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const prisma = new PrismaClient();

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error("Faltan credenciales administrativas de Supabase");
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
    if (user.email?.includes("-s1-e2e-")) {
      const deletion = await supabase.auth.admin.deleteUser(user.id);
      if (deletion.error) throw deletion.error;
    }
  }

  await prisma.tenant.deleteMany({
    where: { slug: { startsWith: "sprint-1-e2e-" } },
  });
  await prisma.user.deleteMany({ where: { email: { contains: "-s1-e2e-" } } });
  console.log(JSON.stringify({ cleaned: true }));
}

async function setup() {
  await cleanup();
  const suffix = Date.now().toString(36);
  const adminEmail = `admin-s1-e2e-${suffix}@vela.demo`;
  const residentEmail = `resident-s1-e2e-${suffix}@vela.demo`;
  const password = `Vela!${randomBytes(18).toString("base64url")}`;
  const supabase = adminClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email: adminEmail,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Administración E2E" },
  });
  if (error || !data.user)
    throw error ?? new Error("No se creó el usuario E2E");

  const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!publicUrl || !anonKey)
    throw new Error("Faltan credenciales públicas de Supabase");
  const authVerifier = createClient(publicUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: loginError } = await authVerifier.auth.signInWithPassword({
    email: adminEmail,
    password,
  });
  if (loginError)
    throw new Error(
      `La fixture no puede iniciar sesión: ${loginError.message}`,
    );
  await authVerifier.auth.signOut();

  const tenant = await prisma.tenant.create({
    data: {
      name: "Residencial Prueba Sprint 1",
      slug: `sprint-1-e2e-${suffix}`,
      plan: "test",
    },
  });
  const user = await prisma.user.create({
    data: {
      id: data.user.id,
      email: adminEmail,
      fullName: "Administración E2E",
    },
  });
  const membership = await prisma.membership.create({
    data: { tenantId: tenant.id, userId: user.id },
  });
  await prisma.membershipRole.create({
    data: { membershipId: membership.id, role: RoleName.ADMIN_GENERAL },
  });
  const dwelling = await prisma.dwelling.create({
    data: { tenantId: tenant.id, code: "Casa E2E-01", zone: "Zona de prueba" },
  });

  console.log(
    JSON.stringify({
      adminEmail,
      residentEmail,
      password,
      tenantId: tenant.id,
      dwellingId: dwelling.id,
    }),
  );
}

async function verify() {
  const tenant = await prisma.tenant.findFirstOrThrow({
    where: { slug: { startsWith: "sprint-1-e2e-" } },
  });
  const resident = await prisma.user.findFirstOrThrow({
    where: { email: { startsWith: "resident-s1-e2e-" } },
    include: {
      memberships: {
        where: { tenantId: tenant.id, active: true },
        include: { roles: true },
      },
      householdMembers: { where: { tenantId: tenant.id } },
    },
  });
  const [acceptedInvitations, acceptedAudits, roleAudits] = await Promise.all([
    prisma.invitation.count({
      where: { tenantId: tenant.id, email: resident.email, status: "ACEPTADA" },
    }),
    prisma.auditLog.count({
      where: { tenantId: tenant.id, action: "invitation.accepted" },
    }),
    prisma.auditLog.count({
      where: { tenantId: tenant.id, action: "membership.role_granted" },
    }),
  ]);
  const roles = resident.memberships.flatMap((membership) =>
    membership.roles.map(({ role }) => role),
  );
  if (
    acceptedInvitations !== 1 ||
    acceptedAudits !== 1 ||
    roleAudits !== 1 ||
    !roles.includes(RoleName.RESIDENTE) ||
    resident.householdMembers.length !== 1
  ) {
    throw new Error("La persistencia E2E no cumple los criterios de SPRINT-1");
  }
  console.log(
    JSON.stringify({
      verified: true,
      acceptedInvitations,
      acceptedAudits,
      roleAudits,
      residentRoles: roles,
      householdMembers: resident.householdMembers.length,
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

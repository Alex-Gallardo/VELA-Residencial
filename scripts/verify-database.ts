import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { arch, platform, tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";

import { PrismaClient, RoleName } from "@prisma/client";
import EmbeddedPostgres from "embedded-postgres";

import { grantMembershipRole } from "../src/server/services/membership-service";

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

      console.log(
        "✓ Migraciones, seed idempotente, RLS multi-tenant y auditoria verificados",
      );
    } finally {
      await prisma.$disconnect();
    }
  } finally {
    if (started) await stopPostgres(postgres, resolvedDatabaseDir);
    await rm(resolvedDatabaseDir, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(
    `✗ ${error instanceof Error ? error.message : "Fallo desconocido al verificar PostgreSQL"}`,
  );
  process.exitCode = 1;
});

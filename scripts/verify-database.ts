import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { arch, platform, tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";

import { PrismaClient } from "@prisma/client";
import EmbeddedPostgres from "embedded-postgres";

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
  if (!npmCli) throw new Error("npm_execpath no está disponible");
  execFileSync(process.execPath, [npmCli, ...args], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });
}

async function stopPostgres(postgres: EmbeddedPostgres, databaseDir: string) {
  const platformName = platform() === "win32" ? "windows" : platform();
  const binaryPackage = `@embedded-postgres/${platformName}-${arch()}`;
  const binaries = (await import(binaryPackage)) as { pg_ctl: string };
  execFileSync(
    binaries.pg_ctl,
    ["stop", "-D", databaseDir, "-m", "fast", "-w"],
    {
      stdio: "inherit",
    },
  );
  (postgres as unknown as { process?: undefined }).process = undefined;
}

async function main() {
  const port = await findFreePort();
  const databaseDir = await mkdtemp(join(tmpdir(), "vela-postgres-"));
  const resolvedTemp = resolve(tmpdir()) + sep;
  const resolvedDatabaseDir = resolve(databaseDir);
  if (!resolvedDatabaseDir.startsWith(resolvedTemp))
    throw new Error("Directorio temporal fuera del área permitida");

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

    runNpm(["run", "db:migrate", "--", "--name", "init", "--skip-generate"]);
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
      console.log(
        "✓ Migración aplicada y seed idempotente verificado en PostgreSQL temporal",
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

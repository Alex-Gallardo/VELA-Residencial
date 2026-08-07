import { PrismaClient } from "@prisma/client";
import * as Sentry from "@sentry/node";
import { config } from "dotenv";
import { PostHog } from "posthog-node";

import { getPublicSupabaseEnv } from "../src/lib/env";

config({ path: ".env.local" });

async function verifySupabase() {
  const env = getPublicSupabaseEnv();
  const response = await fetch(
    `${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`,
    {
      headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY },
    },
  );
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`Supabase REST respondió ${response.status}: ${detail}`);
  }
}

async function verifyDatabase() {
  const prisma = new PrismaClient();
  try {
    await prisma.$queryRaw`SELECT 1`;
  } finally {
    await prisma.$disconnect();
  }
}

async function verifyTelemetry() {
  const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!sentryDsn || !posthogKey)
    throw new Error("Faltan NEXT_PUBLIC_SENTRY_DSN o NEXT_PUBLIC_POSTHOG_KEY");

  Sentry.init({ dsn: sentryDsn });
  Sentry.captureMessage("VELA Sprint 0 verification");
  if (!(await Sentry.flush(5_000)))
    throw new Error("Sentry no confirmó el envío dentro del tiempo límite");

  const posthog = new PostHog(posthogKey, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
  });
  posthog.capture({
    distinctId: "sprint-0-verifier",
    event: "telemetry_test",
    properties: { sprint: 0 },
  });
  await posthog.shutdown();
}

async function main() {
  await verifySupabase();
  console.log("✓ Supabase REST accesible");
  await verifyDatabase();
  console.log("✓ Postgres accesible mediante Prisma");
  await verifyTelemetry();
  console.log("✓ Eventos de prueba enviados a Sentry y PostHog");
}

main().catch((error: unknown) => {
  console.error(
    `✗ ${error instanceof Error ? error.message : "Verificación desconocida"}`,
  );
  process.exitCode = 1;
});

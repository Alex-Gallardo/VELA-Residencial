import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole)
    throw new Error("Faltan credenciales de Supabase en .env.local");

  const supabase = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const prisma = new PrismaClient();
  try {
    const [{ data: bucket, error }, policies, migration] = await Promise.all([
      supabase.storage.getBucket("attachments"),
      prisma.$queryRaw<
        Array<{ tablename: string; policyname: string; cmd: string }>
      >`
        SELECT tablename, policyname, cmd
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN ('Attachment', 'ModerationItem')
        ORDER BY tablename, policyname
      `,
      prisma.$queryRaw<
        Array<{ migration_name: string; finished_at: Date | null }>
      >`
        SELECT migration_name, finished_at
        FROM "_prisma_migrations"
        WHERE migration_name = '20260807120000_sprint_3_secure_attachments'
          AND rolled_back_at IS NULL
      `,
    ]);
    if (error || !bucket) throw new Error("El bucket attachments no existe");
    if (bucket.public) throw new Error("El bucket attachments quedó público");
    if (bucket.file_size_limit !== 6 * 1024 * 1024)
      throw new Error("El límite del bucket no es 6 MB");
    const allowed = [...(bucket.allowed_mime_types ?? [])].sort();
    const expected = ["image/jpeg", "image/png", "image/webp"].sort();
    if (JSON.stringify(allowed) !== JSON.stringify(expected))
      throw new Error(`MIME inesperados en bucket: ${allowed.join(", ")}`);
    if (migration.length !== 1 || !migration[0]?.finished_at)
      throw new Error("La migración Sprint 3 no está finalizada");

    const attachmentWrites = policies.filter(
      (policy) => policy.tablename === "Attachment" && policy.cmd !== "SELECT",
    );
    const moderationWrites = policies.filter(
      (policy) =>
        policy.tablename === "ModerationItem" && policy.cmd !== "SELECT",
    );
    if (attachmentWrites.length || moderationWrites.length)
      throw new Error("Persisten políticas de escritura directa inseguras");
    if (
      !policies.some(
        (policy) =>
          policy.tablename === "Attachment" && policy.cmd === "SELECT",
      ) ||
      !policies.some(
        (policy) =>
          policy.tablename === "ModerationItem" && policy.cmd === "SELECT",
      )
    )
      throw new Error("Faltan políticas de lectura aislada");

    console.log(
      "✓ Supabase cloud: migración aplicada, bucket privado limitado y RLS sin escrituras cliente",
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(
    `✗ ${error instanceof Error ? error.message : "Verificación cloud fallida"}`,
  );
  process.exitCode = 1;
});

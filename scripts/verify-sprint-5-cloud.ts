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
  const verificationKey = `_verification/sprint-5-${Date.now()}.pdf`;
  try {
    const [{ data: bucket, error }, migration, policies] = await Promise.all([
      supabase.storage.getBucket("documents"),
      prisma.$queryRaw<
        Array<{ migration_name: string; finished_at: Date | null }>
      >`
        SELECT migration_name, finished_at
        FROM "_prisma_migrations"
        WHERE migration_name = '20260807230000_sprint_5_admin_documents'
          AND rolled_back_at IS NULL
      `,
      prisma.$queryRaw<
        Array<{ tablename: string; policyname: string; cmd: string }>
      >`
        SELECT tablename, policyname, cmd
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN (
            'Document', 'AuditLog', 'ZoneConfig', 'TenantSettings'
          )
        ORDER BY tablename, policyname
      `,
    ]);
    if (error || !bucket) throw new Error("El bucket documents no existe");
    if (bucket.public) throw new Error("El bucket documents quedó público");
    if (bucket.file_size_limit !== 10 * 1024 * 1024)
      throw new Error("El bucket documents no conserva el límite de 10 MB");
    if (
      JSON.stringify(bucket.allowed_mime_types ?? []) !==
      JSON.stringify(["application/pdf"])
    )
      throw new Error("El bucket documents permite tipos distintos de PDF");
    if (migration.length !== 1 || !migration[0]?.finished_at)
      throw new Error("La migración Sprint 5 no está finalizada");

    const expectedPolicies = [
      ["Document", "current_document_select"],
      ["AuditLog", "tenant_admin_or_support_select"],
      ["ZoneConfig", "tenant_admin_manage"],
      ["ZoneConfig", "tenant_member_select"],
      ["TenantSettings", "tenant_admin_manage"],
      ["TenantSettings", "tenant_member_select"],
    ];
    for (const [table, policy] of expectedPolicies)
      if (
        !policies.some(
          (item) => item.tablename === table && item.policyname === policy,
        )
      )
        throw new Error(`Falta la política ${table}.${policy}`);

    const pdf = new TextEncoder().encode("%PDF-1.4\n%%EOF\n");
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(verificationKey, pdf, {
        contentType: "application/pdf",
        upsert: false,
      });
    if (uploadError)
      throw new Error(`La carga PDF falló: ${uploadError.message}`);
    const { data: downloaded, error: downloadError } = await supabase.storage
      .from("documents")
      .download(verificationKey);
    if (
      downloadError ||
      !downloaded ||
      !(await downloaded.text()).startsWith("%PDF-")
    )
      throw new Error("No se pudo verificar el PDF privado en Storage");

    console.log(
      "✓ Supabase cloud: migración Sprint 5, RLS y bucket PDF privado verificados",
    );
  } finally {
    await supabase.storage.from("documents").remove([verificationKey]);
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(
    `✗ ${error instanceof Error ? error.message : "Verificación Sprint 5 cloud fallida"}`,
  );
  process.exitCode = 1;
});

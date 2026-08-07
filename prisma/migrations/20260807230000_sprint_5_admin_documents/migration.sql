-- Sprint 5: admin configuration, resident lifecycle and versioned documents.

-- MembershipRole.expiresAt is a timestamp without timezone (Prisma DateTime).
-- Compare against an explicit UTC wall-clock value so break-glass expiration
-- does not depend on the PostgreSQL server timezone.
CREATE OR REPLACE FUNCTION public.auth_has_tenant_role(
  target_tenant text,
  allowed_roles text[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public."Membership" m
    JOIN public."MembershipRole" mr ON mr."membershipId" = m.id
    WHERE m."tenantId" = target_tenant
      AND m."userId" = auth.uid()::text
      AND m.active = true
      AND mr.role::text = ANY (allowed_roles)
      AND (
        mr."expiresAt" IS NULL
        OR mr."expiresAt" > (now() AT TIME ZONE 'UTC')
      )
  );
$$;

ALTER TABLE public."HouseholdMember"
  ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "leftAt" TIMESTAMP(3);

ALTER TABLE public."Document"
  ADD COLUMN "seriesId" TEXT,
  ADD COLUMN "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
  ADD COLUMN "sizeBytes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "isCurrent" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "uploadedById" TEXT;

UPDATE public."Document" SET "seriesId" = id WHERE "seriesId" IS NULL;
ALTER TABLE public."Document" ALTER COLUMN "seriesId" SET NOT NULL;

ALTER TABLE public."Document"
  ADD CONSTRAINT "Document_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES public."User"(id)
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Document_storageKey_key"
  ON public."Document"("storageKey");
CREATE UNIQUE INDEX "Document_tenantId_seriesId_version_key"
  ON public."Document"("tenantId", "seriesId", "version");
CREATE INDEX "Document_tenantId_category_isCurrent_publishedAt_idx"
  ON public."Document"("tenantId", "category", "isCurrent", "publishedAt");

CREATE TABLE public."ZoneConfig" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ZoneConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ZoneConfig_tenantId_name_key"
  ON public."ZoneConfig"("tenantId", "name");
CREATE INDEX "ZoneConfig_tenantId_active_idx"
  ON public."ZoneConfig"("tenantId", "active");
ALTER TABLE public."ZoneConfig"
  ADD CONSTRAINT "ZoneConfig_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id)
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE public."TenantSettings" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "notificationChannels" "NotificationChannel"[] NOT NULL
    DEFAULT ARRAY['IN_APP', 'PUSH', 'EMAIL']::"NotificationChannel"[],
  "emergencyContacts" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TenantSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenantSettings_tenantId_key"
  ON public."TenantSettings"("tenantId");
ALTER TABLE public."TenantSettings"
  ADD CONSTRAINT "TenantSettings_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed zones from the data that already exists. IDs only need to be stable
-- inside this migration; Prisma creates future rows with cuid values.
INSERT INTO public."ZoneConfig" (id, "tenantId", name, active, "updatedAt")
SELECT md5("tenantId" || ':' || zone), "tenantId", zone, true, CURRENT_TIMESTAMP
FROM public."Dwelling"
WHERE zone IS NOT NULL AND btrim(zone) <> ''
GROUP BY "tenantId", zone
ON CONFLICT ("tenantId", name) DO NOTHING;

INSERT INTO public."TenantSettings" (id, "tenantId", "updatedAt")
SELECT md5(id || ':settings'), id, CURRENT_TIMESTAMP FROM public."Tenant"
ON CONFLICT ("tenantId") DO NOTHING;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public."ZoneConfig", public."TenantSettings"
  TO authenticated;

ALTER TABLE public."ZoneConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."TenantSettings" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_member_select ON public."ZoneConfig"
FOR SELECT TO authenticated
USING ("tenantId" IN (SELECT public.auth_tenant_ids()));
CREATE POLICY tenant_admin_manage ON public."ZoneConfig"
FOR ALL TO authenticated
USING (public.auth_has_tenant_role("tenantId", ARRAY['ADMIN_GENERAL']))
WITH CHECK (public.auth_has_tenant_role("tenantId", ARRAY['ADMIN_GENERAL']));

CREATE POLICY tenant_member_select ON public."TenantSettings"
FOR SELECT TO authenticated
USING ("tenantId" IN (SELECT public.auth_tenant_ids()));
CREATE POLICY tenant_admin_manage ON public."TenantSettings"
FOR ALL TO authenticated
USING (public.auth_has_tenant_role("tenantId", ARRAY['ADMIN_GENERAL']))
WITH CHECK (public.auth_has_tenant_role("tenantId", ARRAY['ADMIN_GENERAL']));

-- Residents only see the currently published version. Communications and the
-- general administrator retain the existing management policy for all versions.
DROP POLICY IF EXISTS tenant_member_select ON public."Document";
CREATE POLICY current_document_select ON public."Document"
FOR SELECT TO authenticated
USING (
  "tenantId" IN (SELECT public.auth_tenant_ids())
  AND "isCurrent" = true
  AND "publishedAt" <= (now() AT TIME ZONE 'UTC')
);

-- Temporary support is allowed to inspect audit evidence only while its role
-- is active; auth_has_tenant_role already evaluates expiresAt.
DROP POLICY IF EXISTS tenant_admin_select ON public."AuditLog";
CREATE POLICY tenant_admin_or_support_select ON public."AuditLog"
FOR SELECT TO authenticated
USING (
  public.auth_has_tenant_role(
    "tenantId",
    ARRAY['ADMIN_GENERAL', 'SOPORTE_SISTEMA']
  )
);

-- Private PDF bucket. Upload and download happen through short-lived signed
-- URLs created by the trusted server; no object policy grants direct access.
DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets (
      id,
      name,
      public,
      file_size_limit,
      allowed_mime_types
    ) VALUES (
      'documents',
      'documents',
      false,
      10485760,
      ARRAY['application/pdf']
    )
    ON CONFLICT (id) DO UPDATE SET
      public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;
  END IF;
END
$$;

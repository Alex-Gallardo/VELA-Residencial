-- Sprint 3: private, sanitized attachments with human moderation.
CREATE TYPE "AttachmentStatus" AS ENUM (
  'PENDIENTE_SUBIDA',
  'SUBIDO',
  'PROCESANDO',
  'LISTO',
  'RECHAZADO',
  'FALLIDO'
);

CREATE TYPE "ModerationDecisionSource" AS ENUM (
  'REGLAS_LOCALES',
  'PROVEEDOR',
  'HUMANA'
);

ALTER TABLE "Attachment"
  ALTER COLUMN "storageKey" DROP NOT NULL,
  ADD COLUMN "uploadedById" TEXT,
  ADD COLUMN "status" "AttachmentStatus" NOT NULL DEFAULT 'PENDIENTE_SUBIDA',
  ADD COLUMN "quarantineKey" TEXT,
  ADD COLUMN "originalName" TEXT,
  ADD COLUMN "checksumSha256" TEXT,
  ADD COLUMN "width" INTEGER,
  ADD COLUMN "height" INTEGER,
  ADD COLUMN "failureReason" TEXT,
  ADD COLUMN "processedAt" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Preserve ownership for any pre-Sprint-3 attachment already linked to a ticket.
UPDATE "Attachment" AS attachment
SET "uploadedById" = ticket."createdById"
FROM "Ticket" AS ticket
WHERE attachment."ticketId" = ticket."id"
  AND attachment."uploadedById" IS NULL;

ALTER TABLE "Attachment"
  ADD CONSTRAINT "Attachment_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Attachment_uploadedById_idx" ON "Attachment"("uploadedById");
CREATE INDEX "Attachment_tenantId_status_idx" ON "Attachment"("tenantId", "status");
CREATE INDEX "Attachment_tenantId_checksumSha256_idx" ON "Attachment"("tenantId", "checksumSha256");

ALTER TABLE "ModerationItem"
  ADD COLUMN "decisionSource" "ModerationDecisionSource",
  ADD COLUMN "decisionReason" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "ModerationItem"
  ADD CONSTRAINT "ModerationItem_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Attachment metadata is readable only through the existing ticket boundary.
-- All writes are server-side with the Supabase service role.
DROP POLICY IF EXISTS parent_ticket_create ON public."Attachment";
DROP POLICY IF EXISTS parent_ticket_select ON public."Attachment";
CREATE POLICY parent_ticket_select ON public."Attachment"
FOR SELECT TO authenticated
USING (
  "tenantId" IN (SELECT public.auth_tenant_ids())
  AND (
    ("ticketId" IS NULL AND "uploadedById" = auth.uid()::text)
    OR ("ticketId" IS NOT NULL AND public.auth_can_access_ticket("ticketId"))
  )
);

DROP POLICY IF EXISTS tenant_moderator_manage ON public."ModerationItem";
CREATE POLICY tenant_moderator_select ON public."ModerationItem"
FOR SELECT TO authenticated
USING (
  public.auth_has_tenant_role("tenantId", ARRAY['ADMIN_GENERAL', 'MODERADOR'])
);

-- Create/update the real Supabase bucket when the Storage extension is present.
-- Plain PostgreSQL verification environments intentionally skip this block.
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
      'attachments',
      'attachments',
      false,
      6291456,
      ARRAY['image/jpeg', 'image/png', 'image/webp']
    )
    ON CONFLICT (id) DO UPDATE SET
      public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;
  END IF;
END
$$;

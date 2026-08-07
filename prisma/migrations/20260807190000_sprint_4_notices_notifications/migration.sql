-- Sprint 4: segmented notices, delivery channels, preferences and Web Push.

ALTER TABLE public."Notice"
  ADD COLUMN "channels" "NotificationChannel"[] NOT NULL
    DEFAULT ARRAY['IN_APP']::"NotificationChannel"[],
  ADD COLUMN "deliveredAt" TIMESTAMP(3);

CREATE INDEX "Notice_tenantId_publishedAt_deliveredAt_idx"
  ON public."Notice"("tenantId", "publishedAt", "deliveredAt");
CREATE INDEX "Notification_channel_sentAt_createdAt_idx"
  ON public."Notification"("channel", "sentAt", "createdAt");

CREATE TABLE public."NotificationPreference" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
  "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
  "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
  "quietHoursStart" INTEGER,
  "quietHoursEnd" INTEGER,
  "timeZone" TEXT NOT NULL DEFAULT 'America/Guatemala',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NotificationPreference_quiet_hours_check" CHECK (
    ("quietHoursStart" IS NULL AND "quietHoursEnd" IS NULL)
    OR (
      "quietHoursStart" BETWEEN 0 AND 1439
      AND "quietHoursEnd" BETWEEN 0 AND 1439
      AND "quietHoursStart" <> "quietHoursEnd"
    )
  )
);

CREATE UNIQUE INDEX "NotificationPreference_tenantId_userId_key"
  ON public."NotificationPreference"("tenantId", "userId");
CREATE INDEX "NotificationPreference_userId_idx"
  ON public."NotificationPreference"("userId");

ALTER TABLE public."NotificationPreference"
  ADD CONSTRAINT "NotificationPreference_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES public."Tenant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "NotificationPreference_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES public."User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE public."PushSubscription" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PushSubscription_endpoint_key"
  ON public."PushSubscription"("endpoint");
CREATE INDEX "PushSubscription_tenantId_userId_idx"
  ON public."PushSubscription"("tenantId", "userId");

ALTER TABLE public."PushSubscription"
  ADD CONSTRAINT "PushSubscription_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES public."Tenant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "PushSubscription_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES public."User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public."NotificationPreference", public."PushSubscription"
  TO authenticated;

ALTER TABLE public."NotificationPreference" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PushSubscription" ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.auth_can_access_notice(target_notice text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public."Notice" notice
    JOIN public."NoticeReceipt" receipt ON receipt."noticeId" = notice.id
    WHERE notice.id = target_notice
      AND notice."tenantId" IN (SELECT public.auth_tenant_ids())
      AND receipt."userId" = auth.uid()::text
      AND notice."deliveredAt" IS NOT NULL
      AND notice."publishedAt" <= (now() AT TIME ZONE 'UTC')
      AND (
        notice."expiresAt" IS NULL
        OR notice."expiresAt" > (now() AT TIME ZONE 'UTC')
      )
  )
$$;

REVOKE ALL ON FUNCTION public.auth_can_access_notice(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_can_access_notice(text) TO authenticated;

-- A resident sees a notice only after it was delivered to their audience.
-- Communications staff retains access through communications_manage.
DROP POLICY IF EXISTS tenant_member_select ON public."Notice";
CREATE POLICY targeted_notice_select ON public."Notice"
FOR SELECT TO authenticated
USING (
  public.auth_can_access_notice(id)
);

-- Audience rows are created by the trusted server. Residents can read their
-- own receipt; communications staff can aggregate delivery/read metrics.
DROP POLICY IF EXISTS own_receipt_create ON public."NoticeReceipt";
DROP POLICY IF EXISTS own_receipt_update ON public."NoticeReceipt";
CREATE POLICY communications_receipt_select ON public."NoticeReceipt"
FOR SELECT TO authenticated
USING (
  public.auth_has_tenant_role(
    "tenantId",
    ARRAY['ADMIN_GENERAL', 'COMUNICACIONES']
  )
);

CREATE POLICY own_preferences_manage ON public."NotificationPreference"
FOR ALL TO authenticated
USING (
  "userId" = auth.uid()::text
  AND "tenantId" IN (SELECT public.auth_tenant_ids())
)
WITH CHECK (
  "userId" = auth.uid()::text
  AND "tenantId" IN (SELECT public.auth_tenant_ids())
);

CREATE POLICY own_push_subscriptions_manage ON public."PushSubscription"
FOR ALL TO authenticated
USING (
  "userId" = auth.uid()::text
  AND "tenantId" IN (SELECT public.auth_tenant_ids())
)
WITH CHECK (
  "userId" = auth.uid()::text
  AND "tenantId" IN (SELECT public.auth_tenant_ids())
);

-- Supabase Realtime only exists in cloud projects; local PostgreSQL skips it.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
    AND NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'Notification'
    )
  THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public."Notification";
  END IF;
END
$$;

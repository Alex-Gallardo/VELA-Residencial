-- Sprint 1: Supabase Auth-aware tenant isolation.
-- Application servers use the database owner for trusted mutations; authenticated
-- browser access is constrained by the policies below.

CREATE OR REPLACE FUNCTION public.auth_tenant_ids()
RETURNS SETOF text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT m."tenantId"
  FROM public."Membership" m
  WHERE m."userId" = auth.uid()::text
    AND m.active = true;
$$;

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
      AND (mr."expiresAt" IS NULL OR mr."expiresAt" > now())
  );
$$;

CREATE OR REPLACE FUNCTION public.auth_is_tenant_staff(target_tenant text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.auth_has_tenant_role(
    target_tenant,
    ARRAY[
      'ADMIN_GENERAL', 'OPERACIONES', 'COMUNICACIONES', 'FINANZAS',
      'MODERADOR', 'SEGURIDAD', 'SOPORTE_SISTEMA'
    ]
  );
$$;

CREATE OR REPLACE FUNCTION public.auth_can_access_ticket(target_ticket text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public."Ticket" t
    WHERE t.id = target_ticket
      AND t."tenantId" IN (SELECT public.auth_tenant_ids())
      AND (
        t."createdById" = auth.uid()::text
        OR public.auth_is_tenant_staff(t."tenantId")
      )
  );
$$;

REVOKE ALL ON FUNCTION public.auth_tenant_ids() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_has_tenant_role(text, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_is_tenant_staff(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_can_access_ticket(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_tenant_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_has_tenant_role(text, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_is_tenant_staff(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_can_access_ticket(text) TO authenticated;

GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

ALTER TABLE public."Tenant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Membership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MembershipRole" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Dwelling" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Household" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."HouseholdMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Ticket" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."TicketActivity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."TicketComment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Attachment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ModerationItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Notice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."NoticeReceipt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Document" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Invitation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CategoryConfig" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_member_select ON public."Tenant"
FOR SELECT TO authenticated
USING (id IN (SELECT public.auth_tenant_ids()));

CREATE POLICY self_select ON public."User"
FOR SELECT TO authenticated
USING (id = auth.uid()::text);

CREATE POLICY own_or_staff_select ON public."Membership"
FOR SELECT TO authenticated
USING (
  "userId" = auth.uid()::text
  OR public.auth_is_tenant_staff("tenantId")
);

CREATE POLICY tenant_admin_manage ON public."Membership"
FOR ALL TO authenticated
USING (public.auth_has_tenant_role("tenantId", ARRAY['ADMIN_GENERAL']))
WITH CHECK (public.auth_has_tenant_role("tenantId", ARRAY['ADMIN_GENERAL']));

CREATE POLICY own_or_staff_select ON public."MembershipRole"
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public."Membership" m
    WHERE m.id = "membershipId"
      AND (
        m."userId" = auth.uid()::text
        OR public.auth_is_tenant_staff(m."tenantId")
      )
  )
);

CREATE POLICY tenant_admin_manage ON public."MembershipRole"
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public."Membership" m
    WHERE m.id = "membershipId"
      AND public.auth_has_tenant_role(m."tenantId", ARRAY['ADMIN_GENERAL'])
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public."Membership" m
    WHERE m.id = "membershipId"
      AND public.auth_has_tenant_role(m."tenantId", ARRAY['ADMIN_GENERAL'])
  )
);

-- Tenant-readable directory data. Mutations remain staff-only.
CREATE POLICY tenant_member_select ON public."Dwelling"
FOR SELECT TO authenticated USING ("tenantId" IN (SELECT public.auth_tenant_ids()));
CREATE POLICY tenant_admin_manage ON public."Dwelling"
FOR ALL TO authenticated
USING (public.auth_has_tenant_role("tenantId", ARRAY['ADMIN_GENERAL']))
WITH CHECK (public.auth_has_tenant_role("tenantId", ARRAY['ADMIN_GENERAL']));

CREATE POLICY tenant_member_select ON public."Household"
FOR SELECT TO authenticated USING ("tenantId" IN (SELECT public.auth_tenant_ids()));
CREATE POLICY tenant_admin_manage ON public."Household"
FOR ALL TO authenticated
USING (public.auth_has_tenant_role("tenantId", ARRAY['ADMIN_GENERAL']))
WITH CHECK (public.auth_has_tenant_role("tenantId", ARRAY['ADMIN_GENERAL']));

CREATE POLICY tenant_member_select ON public."HouseholdMember"
FOR SELECT TO authenticated USING ("tenantId" IN (SELECT public.auth_tenant_ids()));
CREATE POLICY tenant_admin_manage ON public."HouseholdMember"
FOR ALL TO authenticated
USING (public.auth_has_tenant_role("tenantId", ARRAY['ADMIN_GENERAL']))
WITH CHECK (public.auth_has_tenant_role("tenantId", ARRAY['ADMIN_GENERAL']));

CREATE POLICY own_or_staff_select ON public."Ticket"
FOR SELECT TO authenticated
USING (
  "tenantId" IN (SELECT public.auth_tenant_ids())
  AND ("createdById" = auth.uid()::text OR public.auth_is_tenant_staff("tenantId"))
);
CREATE POLICY tenant_member_create ON public."Ticket"
FOR INSERT TO authenticated
WITH CHECK (
  "tenantId" IN (SELECT public.auth_tenant_ids())
  AND "createdById" = auth.uid()::text
);
CREATE POLICY own_or_staff_update ON public."Ticket"
FOR UPDATE TO authenticated
USING (
  "tenantId" IN (SELECT public.auth_tenant_ids())
  AND ("createdById" = auth.uid()::text OR public.auth_is_tenant_staff("tenantId"))
)
WITH CHECK ("tenantId" IN (SELECT public.auth_tenant_ids()));
CREATE POLICY tenant_admin_delete ON public."Ticket"
FOR DELETE TO authenticated
USING (public.auth_has_tenant_role("tenantId", ARRAY['ADMIN_GENERAL']));

CREATE POLICY parent_ticket_select ON public."TicketActivity"
FOR SELECT TO authenticated USING (public.auth_can_access_ticket("ticketId"));
CREATE POLICY parent_ticket_staff_create ON public."TicketActivity"
FOR INSERT TO authenticated
WITH CHECK (
  public.auth_can_access_ticket("ticketId")
  AND public.auth_is_tenant_staff("tenantId")
);

CREATE POLICY parent_ticket_select ON public."TicketComment"
FOR SELECT TO authenticated
USING (
  public.auth_can_access_ticket("ticketId")
  AND (NOT "isInternal" OR public.auth_is_tenant_staff("tenantId"))
);
CREATE POLICY parent_ticket_create ON public."TicketComment"
FOR INSERT TO authenticated
WITH CHECK (
  public.auth_can_access_ticket("ticketId")
  AND "authorId" = auth.uid()::text
  AND (NOT "isInternal" OR public.auth_is_tenant_staff("tenantId"))
);

CREATE POLICY parent_ticket_select ON public."Attachment"
FOR SELECT TO authenticated
USING (
  "tenantId" IN (SELECT public.auth_tenant_ids())
  AND ("ticketId" IS NULL OR public.auth_can_access_ticket("ticketId"))
);
CREATE POLICY parent_ticket_create ON public."Attachment"
FOR INSERT TO authenticated
WITH CHECK (
  "tenantId" IN (SELECT public.auth_tenant_ids())
  AND ("ticketId" IS NULL OR public.auth_can_access_ticket("ticketId"))
);

CREATE POLICY tenant_moderator_manage ON public."ModerationItem"
FOR ALL TO authenticated
USING (
  public.auth_has_tenant_role("tenantId", ARRAY['ADMIN_GENERAL', 'MODERADOR'])
)
WITH CHECK (
  public.auth_has_tenant_role("tenantId", ARRAY['ADMIN_GENERAL', 'MODERADOR'])
);

CREATE POLICY tenant_member_select ON public."Notice"
FOR SELECT TO authenticated USING ("tenantId" IN (SELECT public.auth_tenant_ids()));
CREATE POLICY communications_manage ON public."Notice"
FOR ALL TO authenticated
USING (
  public.auth_has_tenant_role("tenantId", ARRAY['ADMIN_GENERAL', 'COMUNICACIONES'])
)
WITH CHECK (
  public.auth_has_tenant_role("tenantId", ARRAY['ADMIN_GENERAL', 'COMUNICACIONES'])
);

CREATE POLICY own_receipt_select ON public."NoticeReceipt"
FOR SELECT TO authenticated
USING ("userId" = auth.uid()::text AND "tenantId" IN (SELECT public.auth_tenant_ids()));
CREATE POLICY own_receipt_create ON public."NoticeReceipt"
FOR INSERT TO authenticated
WITH CHECK ("userId" = auth.uid()::text AND "tenantId" IN (SELECT public.auth_tenant_ids()));
CREATE POLICY own_receipt_update ON public."NoticeReceipt"
FOR UPDATE TO authenticated
USING ("userId" = auth.uid()::text)
WITH CHECK ("userId" = auth.uid()::text AND "tenantId" IN (SELECT public.auth_tenant_ids()));

CREATE POLICY own_notification_select ON public."Notification"
FOR SELECT TO authenticated
USING ("userId" = auth.uid()::text AND "tenantId" IN (SELECT public.auth_tenant_ids()));
CREATE POLICY own_notification_update ON public."Notification"
FOR UPDATE TO authenticated
USING ("userId" = auth.uid()::text)
WITH CHECK ("userId" = auth.uid()::text AND "tenantId" IN (SELECT public.auth_tenant_ids()));

CREATE POLICY tenant_member_select ON public."Document"
FOR SELECT TO authenticated USING ("tenantId" IN (SELECT public.auth_tenant_ids()));
CREATE POLICY communications_manage ON public."Document"
FOR ALL TO authenticated
USING (
  public.auth_has_tenant_role("tenantId", ARRAY['ADMIN_GENERAL', 'COMUNICACIONES'])
)
WITH CHECK (
  public.auth_has_tenant_role("tenantId", ARRAY['ADMIN_GENERAL', 'COMUNICACIONES'])
);

CREATE POLICY tenant_admin_manage ON public."Invitation"
FOR ALL TO authenticated
USING (public.auth_has_tenant_role("tenantId", ARRAY['ADMIN_GENERAL']))
WITH CHECK (public.auth_has_tenant_role("tenantId", ARRAY['ADMIN_GENERAL']));

CREATE POLICY tenant_admin_select ON public."AuditLog"
FOR SELECT TO authenticated
USING (public.auth_has_tenant_role("tenantId", ARRAY['ADMIN_GENERAL']));

CREATE POLICY tenant_member_select ON public."CategoryConfig"
FOR SELECT TO authenticated USING ("tenantId" IN (SELECT public.auth_tenant_ids()));
CREATE POLICY tenant_admin_manage ON public."CategoryConfig"
FOR ALL TO authenticated
USING (public.auth_has_tenant_role("tenantId", ARRAY['ADMIN_GENERAL']))
WITH CHECK (public.auth_has_tenant_role("tenantId", ARRAY['ADMIN_GENERAL']));

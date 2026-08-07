import "server-only";

import type { Action, Resource } from "@/lib/permissions";
import { AuthorizationError, can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

export async function getAuthContext() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  const user = await db.user.findUnique({
    where: { id: authUser.id },
    include: {
      memberships: {
        where: { active: true, tenant: { active: true } },
        include: { tenant: true, roles: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  const membership = user?.memberships[0] ?? null;
  return { authUser, user, membership };
}

export async function requireAuthContext() {
  const context = await getAuthContext();
  if (!context?.user) throw new AuthorizationError("Debes iniciar sesion.");
  return { ...context, user: context.user };
}

export async function requireTenantContext() {
  const context = await requireAuthContext();
  if (!context.membership)
    throw new AuthorizationError(
      "Tu cuenta aun no pertenece a un residencial.",
    );
  return { ...context, membership: context.membership };
}

export async function requirePermission(action: Action, resource: Resource) {
  const context = await requireTenantContext();
  if (!can(context.membership, action, resource))
    throw new AuthorizationError();
  return context;
}

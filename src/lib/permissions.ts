import type { RoleName } from "@prisma/client";

export type Action =
  | "read"
  | "create"
  | "update"
  | "delete"
  | "invite"
  | "revoke"
  | "manage_roles"
  | "triage"
  | "moderate"
  | "audit";

export type Resource =
  | "tenant"
  | "membership"
  | "invitation"
  | "ticket"
  | "notice"
  | "document"
  | "notification"
  | "audit_log";

export type PermissionUser = {
  roles: ReadonlyArray<{
    role: RoleName;
    expiresAt?: Date | null;
  }>;
};

type Rule = `${Action}:${Resource}` | "*:*";

const permissions: Record<RoleName, readonly Rule[]> = {
  ADMIN_GENERAL: ["*:*"] as const,
  SOPORTE_SISTEMA: ["read:tenant", "read:audit_log", "audit:audit_log"],
  OPERACIONES: [
    "read:tenant",
    "read:membership",
    "read:ticket",
    "create:ticket",
    "update:ticket",
    "triage:ticket",
    "read:notice",
    "read:document",
    "read:notification",
  ],
  COMUNICACIONES: [
    "read:tenant",
    "read:membership",
    "read:notice",
    "create:notice",
    "update:notice",
    "delete:notice",
    "read:document",
    "create:document",
    "update:document",
    "delete:document",
    "read:notification",
  ],
  FINANZAS: [
    "read:tenant",
    "read:membership",
    "read:document",
    "read:notification",
  ],
  MODERADOR: [
    "read:tenant",
    "read:ticket",
    "update:ticket",
    "triage:ticket",
    "moderate:ticket",
    "read:notice",
    "read:document",
  ],
  SEGURIDAD: [
    "read:tenant",
    "read:ticket",
    "create:ticket",
    "update:ticket",
    "triage:ticket",
    "read:notice",
    "read:document",
    "read:notification",
  ],
  RESIDENTE: [
    "read:tenant",
    "read:ticket",
    "create:ticket",
    "update:ticket",
    "read:notice",
    "read:document",
    "read:notification",
  ],
};

export function activeRoles(user: PermissionUser, now = new Date()) {
  return user.roles
    .filter(({ expiresAt }) => !expiresAt || expiresAt > now)
    .map(({ role }) => role);
}

export function can(
  user: PermissionUser,
  action: Action,
  resource: Resource,
  now = new Date(),
) {
  const requested: Rule = `${action}:${resource}`;
  return activeRoles(user, now).some((role) => {
    const rules = permissions[role];
    return rules.some((rule) => rule === "*:*" || rule === requested);
  });
}

export class AuthorizationError extends Error {
  readonly status = 403;

  constructor(message = "No tienes permiso para realizar esta accion.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

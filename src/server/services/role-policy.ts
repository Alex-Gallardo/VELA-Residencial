import { RoleName } from "@prisma/client";

export class RolePolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RolePolicyError";
  }
}

export function assertRoleGrantExpiration(
  role: RoleName,
  expiresAt: Date | undefined,
  now = new Date(),
) {
  if (role === RoleName.SOPORTE_SISTEMA) {
    if (!expiresAt || expiresAt <= now)
      throw new RolePolicyError(
        "El acceso de soporte requiere una expiración futura.",
      );
    if (expiresAt.getTime() > now.getTime() + 24 * 60 * 60 * 1000)
      throw new RolePolicyError(
        "El acceso de soporte no puede superar 24 horas.",
      );
  } else if (expiresAt) {
    throw new RolePolicyError("Sólo el rol de soporte admite expiración.");
  }
}

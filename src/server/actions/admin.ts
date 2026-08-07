"use server";

import { Prisma, RoleName } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  categoryConfigSchema,
  dwellingSchema,
  householdMemberSchema,
  householdSchema,
  roleGrantSchema,
  roleRevokeSchema,
  tenantSettingsSchema,
  zoneConfigSchema,
} from "@/lib/validations/admin";
import {
  addHouseholdMember,
  AdminServiceError,
  createDwelling,
  createHousehold,
  createZoneConfiguration,
  deleteEmptyDwelling,
  grantMembershipRole,
  moveOutHouseholdMember,
  revokeMembershipRole,
  setHouseholdActive,
  setMembershipActive,
  setZoneActive,
  updateCategoryConfiguration,
  updateDwelling,
  updateTenantSettings,
} from "@/server/services/admin-service";

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function serviceMessage(error: unknown) {
  if (error instanceof AdminServiceError) return error.message;
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  )
    return "Ya existe un registro con esos datos.";
  return null;
}

async function runAdminAction(
  path: string,
  message: string,
  operation: () => Promise<unknown>,
) {
  try {
    await operation();
  } catch (error) {
    const known = serviceMessage(error);
    if (known) fail(path, known);
    throw error;
  }
  revalidatePath(path);
  revalidatePath("/admin");
  redirect(`${path}?message=${encodeURIComponent(message)}`);
}

export async function createDwellingAction(formData: FormData) {
  const context = await requirePermission("create", "membership");
  const parsed = dwellingSchema.safeParse({
    code: formData.get("code"),
    type: formData.get("type"),
    zone: formData.get("zone"),
  });
  if (!parsed.success)
    fail("/admin/residentes", "Revisa los datos de la vivienda.");
  await runAdminAction("/admin/residentes", "Vivienda creada.", () =>
    createDwelling(db, {
      ...parsed.data,
      tenantId: context.membership.tenantId,
      actorId: context.user.id,
    }),
  );
}

export async function updateDwellingAction(formData: FormData) {
  const context = await requirePermission("update", "membership");
  const dwellingId = z.string().min(1).safeParse(formData.get("dwellingId"));
  const parsed = dwellingSchema.safeParse({
    code: formData.get("code"),
    type: formData.get("type"),
    zone: formData.get("zone"),
  });
  if (!dwellingId.success || !parsed.success)
    fail("/admin/residentes", "Revisa los datos de la vivienda.");
  await runAdminAction("/admin/residentes", "Vivienda actualizada.", () =>
    updateDwelling(db, {
      ...parsed.data,
      dwellingId: dwellingId.data,
      tenantId: context.membership.tenantId,
      actorId: context.user.id,
    }),
  );
}

export async function deleteDwellingAction(formData: FormData) {
  const context = await requirePermission("delete", "membership");
  const dwellingId = z.string().min(1).parse(formData.get("dwellingId"));
  await runAdminAction("/admin/residentes", "Vivienda eliminada.", () =>
    deleteEmptyDwelling(db, {
      dwellingId,
      tenantId: context.membership.tenantId,
      actorId: context.user.id,
    }),
  );
}

export async function createHouseholdAction(formData: FormData) {
  const context = await requirePermission("create", "membership");
  const parsed = householdSchema.safeParse({
    dwellingId: formData.get("dwellingId"),
    name: formData.get("name"),
  });
  if (!parsed.success) fail("/admin/residentes", "Revisa los datos del hogar.");
  await runAdminAction("/admin/residentes", "Hogar creado.", () =>
    createHousehold(db, {
      ...parsed.data,
      tenantId: context.membership.tenantId,
      actorId: context.user.id,
    }),
  );
}

export async function setHouseholdActiveAction(formData: FormData) {
  const context = await requirePermission("update", "membership");
  const householdId = z.string().min(1).parse(formData.get("householdId"));
  const active = formData.get("active") === "1";
  await runAdminAction(
    "/admin/residentes",
    active ? "Hogar reactivado." : "Hogar desactivado y accesos revisados.",
    () =>
      setHouseholdActive(db, {
        householdId,
        active,
        tenantId: context.membership.tenantId,
        actorId: context.user.id,
      }),
  );
}

export async function addHouseholdMemberAction(formData: FormData) {
  const context = await requirePermission("create", "membership");
  const parsed = householdMemberSchema.safeParse({
    householdId: formData.get("householdId"),
    fullName: formData.get("fullName"),
    relation: formData.get("relation"),
    isPrimary: formData.get("isPrimary") === "on",
  });
  if (!parsed.success)
    fail("/admin/residentes", "Revisa los datos del residente.");
  await runAdminAction(
    "/admin/residentes",
    "Residente agregado al hogar.",
    () =>
      addHouseholdMember(db, {
        ...parsed.data,
        tenantId: context.membership.tenantId,
        actorId: context.user.id,
      }),
  );
}

export async function moveOutHouseholdMemberAction(formData: FormData) {
  const context = await requirePermission("revoke", "membership");
  const memberId = z.string().min(1).parse(formData.get("memberId"));
  await runAdminAction(
    "/admin/residentes",
    "Salida registrada y acceso residencial actualizado.",
    () =>
      moveOutHouseholdMember(db, {
        memberId,
        tenantId: context.membership.tenantId,
        actorId: context.user.id,
      }),
  );
}

export async function grantMembershipRoleAction(formData: FormData) {
  const context = await requirePermission("manage_roles", "membership");
  const role = formData.get("role");
  const hours = Number(formData.get("supportHours") ?? 4);
  const expiresAt =
    role === RoleName.SOPORTE_SISTEMA &&
    Number.isInteger(hours) &&
    hours >= 1 &&
    hours <= 24
      ? new Date(Date.now() + hours * 60 * 60 * 1000)
      : undefined;
  const parsed = roleGrantSchema.safeParse({
    membershipId: formData.get("membershipId"),
    role,
    expiresAt,
  });
  if (!parsed.success) fail("/admin/usuarios", "Revisa el rol y su vigencia.");
  await runAdminAction("/admin/usuarios", "Rol asignado.", () =>
    grantMembershipRole(db, {
      ...parsed.data,
      tenantId: context.membership.tenantId,
      actorId: context.user.id,
    }),
  );
}

export async function revokeMembershipRoleAction(formData: FormData) {
  const context = await requirePermission("manage_roles", "membership");
  const parsed = roleRevokeSchema.safeParse({
    membershipId: formData.get("membershipId"),
    role: formData.get("role"),
  });
  if (!parsed.success) fail("/admin/usuarios", "Rol inválido.");
  await runAdminAction("/admin/usuarios", "Rol revocado.", () =>
    revokeMembershipRole(db, {
      ...parsed.data,
      tenantId: context.membership.tenantId,
      actorId: context.user.id,
    }),
  );
}

export async function setMembershipActiveAction(formData: FormData) {
  const context = await requirePermission("revoke", "membership");
  const membershipId = z.string().min(1).parse(formData.get("membershipId"));
  const active = formData.get("active") === "1";
  await runAdminAction(
    "/admin/usuarios",
    active ? "Usuario activado." : "Usuario desactivado.",
    () =>
      setMembershipActive(db, {
        membershipId,
        active,
        tenantId: context.membership.tenantId,
        actorId: context.user.id,
      }),
  );
}

export async function updateCategoryConfigurationAction(formData: FormData) {
  const context = await requirePermission("update", "tenant");
  const parsed = categoryConfigSchema.safeParse({
    category: formData.get("category"),
    slaHours: formData.get("slaHours"),
    defaultRole: formData.get("defaultRole") || null,
    active: formData.get("active") === "on",
  });
  if (!parsed.success)
    fail("/admin/configuracion", "Configuración de categoría inválida.");
  await runAdminAction("/admin/configuracion", "Categoría actualizada.", () =>
    updateCategoryConfiguration(db, {
      ...parsed.data,
      tenantId: context.membership.tenantId,
      actorId: context.user.id,
    }),
  );
}

export async function createZoneConfigurationAction(formData: FormData) {
  const context = await requirePermission("update", "tenant");
  const parsed = zoneConfigSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) fail("/admin/configuracion", "Nombre de zona inválido.");
  await runAdminAction("/admin/configuracion", "Zona guardada.", () =>
    createZoneConfiguration(db, {
      ...parsed.data,
      tenantId: context.membership.tenantId,
      actorId: context.user.id,
    }),
  );
}

export async function setZoneActiveAction(formData: FormData) {
  const context = await requirePermission("update", "tenant");
  const zoneId = z.string().min(1).parse(formData.get("zoneId"));
  const active = formData.get("active") === "1";
  await runAdminAction(
    "/admin/configuracion",
    active ? "Zona activada." : "Zona desactivada.",
    () =>
      setZoneActive(db, {
        zoneId,
        active,
        tenantId: context.membership.tenantId,
        actorId: context.user.id,
      }),
  );
}

export async function updateTenantSettingsAction(formData: FormData) {
  const context = await requirePermission("update", "tenant");
  const emergencyContacts = String(formData.get("emergencyContacts") ?? "")
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);
  const parsed = tenantSettingsSchema.safeParse({
    notificationChannels: formData.getAll("notificationChannels"),
    emergencyContacts,
  });
  if (!parsed.success)
    fail(
      "/admin/configuracion",
      parsed.error.issues[0]?.message ?? "Configuración de canales inválida.",
    );
  await runAdminAction("/admin/configuracion", "Canales actualizados.", () =>
    updateTenantSettings(db, {
      ...parsed.data,
      tenantId: context.membership.tenantId,
      actorId: context.user.id,
    }),
  );
}

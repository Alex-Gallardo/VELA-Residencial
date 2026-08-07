import {
  RoleName,
  type DwellingType,
  type HouseholdRelation,
  type NotificationChannel,
  type PrismaClient,
  type TicketCategory,
} from "@prisma/client";

import { recordAuditEvent } from "@/server/services/audit-service";
import {
  assertRoleGrantExpiration,
  RolePolicyError,
} from "@/server/services/role-policy";

export class AdminServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminServiceError";
  }
}

export async function createDwelling(
  database: PrismaClient,
  input: {
    tenantId: string;
    actorId: string;
    code: string;
    type: DwellingType;
    zone?: string;
  },
) {
  return database.$transaction(async (transaction) => {
    if (input.zone) {
      const zone = await transaction.zoneConfig.findUnique({
        where: {
          tenantId_name: { tenantId: input.tenantId, name: input.zone },
        },
      });
      if (!zone?.active)
        throw new AdminServiceError("La zona seleccionada no está activa.");
    }
    const dwelling = await transaction.dwelling.create({
      data: {
        tenantId: input.tenantId,
        code: input.code,
        type: input.type,
        zone: input.zone ?? null,
      },
    });
    await recordAuditEvent(transaction, {
      tenantId: input.tenantId,
      actorId: input.actorId,
      action: "dwelling.created",
      entity: "Dwelling",
      entityId: dwelling.id,
      metadata: { code: dwelling.code, zone: dwelling.zone },
    });
    return dwelling;
  });
}

export async function updateDwelling(
  database: PrismaClient,
  input: {
    tenantId: string;
    actorId: string;
    dwellingId: string;
    code: string;
    type: DwellingType;
    zone?: string;
  },
) {
  return database.$transaction(async (transaction) => {
    const current = await transaction.dwelling.findFirst({
      where: { id: input.dwellingId, tenantId: input.tenantId },
    });
    if (!current) throw new AdminServiceError("La vivienda no existe.");
    if (input.zone) {
      const zone = await transaction.zoneConfig.findUnique({
        where: {
          tenantId_name: { tenantId: input.tenantId, name: input.zone },
        },
      });
      if (!zone?.active)
        throw new AdminServiceError("La zona seleccionada no está activa.");
    }
    const dwelling = await transaction.dwelling.update({
      where: { id: current.id },
      data: { code: input.code, type: input.type, zone: input.zone ?? null },
    });
    await recordAuditEvent(transaction, {
      tenantId: input.tenantId,
      actorId: input.actorId,
      action: "dwelling.updated",
      entity: "Dwelling",
      entityId: dwelling.id,
      metadata: {
        before: { code: current.code, type: current.type, zone: current.zone },
        after: {
          code: dwelling.code,
          type: dwelling.type,
          zone: dwelling.zone,
        },
      },
    });
    return dwelling;
  });
}

export async function deleteEmptyDwelling(
  database: PrismaClient,
  input: { tenantId: string; actorId: string; dwellingId: string },
) {
  return database.$transaction(async (transaction) => {
    const dwelling = await transaction.dwelling.findFirst({
      where: { id: input.dwellingId, tenantId: input.tenantId },
      include: { _count: { select: { households: true, tickets: true } } },
    });
    if (!dwelling) throw new AdminServiceError("La vivienda no existe.");
    if (dwelling._count.households || dwelling._count.tickets)
      throw new AdminServiceError(
        "La vivienda conserva hogares o reportes y no se puede eliminar.",
      );
    await transaction.dwelling.delete({ where: { id: dwelling.id } });
    await recordAuditEvent(transaction, {
      tenantId: input.tenantId,
      actorId: input.actorId,
      action: "dwelling.deleted",
      entity: "Dwelling",
      entityId: dwelling.id,
      metadata: { code: dwelling.code },
    });
  });
}

export async function createHousehold(
  database: PrismaClient,
  input: {
    tenantId: string;
    actorId: string;
    dwellingId: string;
    name?: string;
  },
) {
  return database.$transaction(async (transaction) => {
    const dwelling = await transaction.dwelling.findFirst({
      where: { id: input.dwellingId, tenantId: input.tenantId },
      select: { id: true, code: true },
    });
    if (!dwelling)
      throw new AdminServiceError("La vivienda no pertenece al residencial.");
    const household = await transaction.household.create({
      data: {
        tenantId: input.tenantId,
        dwellingId: dwelling.id,
        name: input.name ?? null,
      },
    });
    await recordAuditEvent(transaction, {
      tenantId: input.tenantId,
      actorId: input.actorId,
      action: "household.created",
      entity: "Household",
      entityId: household.id,
      metadata: { dwellingId: dwelling.id, dwellingCode: dwelling.code },
    });
    return household;
  });
}

export async function setHouseholdActive(
  database: PrismaClient,
  input: {
    tenantId: string;
    actorId: string;
    householdId: string;
    active: boolean;
  },
) {
  return database.$transaction(async (transaction) => {
    const household = await transaction.household.findFirst({
      where: { id: input.householdId, tenantId: input.tenantId },
      include: { members: { where: { active: true } } },
    });
    if (!household) throw new AdminServiceError("El hogar no existe.");
    await transaction.household.update({
      where: { id: household.id },
      data: { active: input.active },
    });
    if (!input.active && household.members.length) {
      const now = new Date();
      await transaction.householdMember.updateMany({
        where: { householdId: household.id, active: true },
        data: { active: false, leftAt: now },
      });
      const userIds = household.members.flatMap(({ userId }) =>
        userId ? [userId] : [],
      );
      for (const userId of userIds) {
        const otherHomes = await transaction.householdMember.count({
          where: {
            tenantId: input.tenantId,
            userId,
            active: true,
            household: { active: true },
          },
        });
        if (!otherHomes)
          await transaction.membership.updateMany({
            where: { tenantId: input.tenantId, userId },
            data: { active: false },
          });
      }
    }
    await recordAuditEvent(transaction, {
      tenantId: input.tenantId,
      actorId: input.actorId,
      action: input.active ? "household.reactivated" : "household.deactivated",
      entity: "Household",
      entityId: household.id,
      metadata: { affectedMembers: household.members.length },
    });
  });
}

export async function addHouseholdMember(
  database: PrismaClient,
  input: {
    tenantId: string;
    actorId: string;
    householdId: string;
    fullName: string;
    relation: HouseholdRelation;
    isPrimary: boolean;
  },
) {
  return database.$transaction(async (transaction) => {
    const household = await transaction.household.findFirst({
      where: { id: input.householdId, tenantId: input.tenantId, active: true },
      select: { id: true },
    });
    if (!household) throw new AdminServiceError("El hogar no está activo.");
    if (input.isPrimary)
      await transaction.householdMember.updateMany({
        where: { householdId: household.id, active: true },
        data: { isPrimary: false },
      });
    const member = await transaction.householdMember.create({
      data: {
        tenantId: input.tenantId,
        householdId: household.id,
        fullName: input.fullName,
        relation: input.relation,
        isPrimary: input.isPrimary,
      },
    });
    await recordAuditEvent(transaction, {
      tenantId: input.tenantId,
      actorId: input.actorId,
      action: "household_member.created",
      entity: "HouseholdMember",
      entityId: member.id,
      metadata: { householdId: household.id, relation: member.relation },
    });
    return member;
  });
}

export async function moveOutHouseholdMember(
  database: PrismaClient,
  input: { tenantId: string; actorId: string; memberId: string },
) {
  return database.$transaction(async (transaction) => {
    const member = await transaction.householdMember.findFirst({
      where: { id: input.memberId, tenantId: input.tenantId, active: true },
    });
    if (!member) throw new AdminServiceError("El residente ya no está activo.");
    const now = new Date();
    await transaction.householdMember.update({
      where: { id: member.id },
      data: { active: false, leftAt: now, isPrimary: false },
    });
    let membershipRevoked = false;
    if (member.userId) {
      const otherHomes = await transaction.householdMember.count({
        where: {
          tenantId: input.tenantId,
          userId: member.userId,
          active: true,
          household: { active: true },
        },
      });
      if (!otherHomes) {
        const updated = await transaction.membership.updateMany({
          where: { tenantId: input.tenantId, userId: member.userId },
          data: { active: false },
        });
        membershipRevoked = updated.count > 0;
      }
    }
    await recordAuditEvent(transaction, {
      tenantId: input.tenantId,
      actorId: input.actorId,
      action: "household_member.moved_out",
      entity: "HouseholdMember",
      entityId: member.id,
      metadata: { userId: member.userId, membershipRevoked },
    });
  });
}

export async function grantMembershipRole(
  database: PrismaClient,
  input: {
    tenantId: string;
    actorId: string;
    membershipId: string;
    role: RoleName;
    expiresAt?: Date;
  },
  now = new Date(),
) {
  try {
    assertRoleGrantExpiration(input.role, input.expiresAt, now);
  } catch (error) {
    if (error instanceof RolePolicyError)
      throw new AdminServiceError(error.message);
    throw error;
  }
  return database.$transaction(async (transaction) => {
    const membership = await transaction.membership.findFirst({
      where: { id: input.membershipId, tenantId: input.tenantId, active: true },
      include: { user: true },
    });
    if (!membership) throw new AdminServiceError("El usuario no está activo.");
    const role = await transaction.membershipRole.upsert({
      where: {
        membershipId_role: {
          membershipId: membership.id,
          role: input.role,
        },
      },
      update: {
        expiresAt: input.expiresAt ?? null,
        grantedById: input.actorId,
      },
      create: {
        membershipId: membership.id,
        role: input.role,
        expiresAt: input.expiresAt ?? null,
        grantedById: input.actorId,
      },
    });
    await recordAuditEvent(transaction, {
      tenantId: input.tenantId,
      actorId: input.actorId,
      action: "user.role_granted",
      entity: "MembershipRole",
      entityId: role.id,
      metadata: {
        userId: membership.userId,
        email: membership.user.email,
        role: input.role,
        expiresAt: input.expiresAt?.toISOString() ?? null,
      },
    });
    return role;
  });
}

export async function revokeMembershipRole(
  database: PrismaClient,
  input: {
    tenantId: string;
    actorId: string;
    membershipId: string;
    role: RoleName;
  },
  now = new Date(),
) {
  return database.$transaction(async (transaction) => {
    const membership = await transaction.membership.findFirst({
      where: { id: input.membershipId, tenantId: input.tenantId },
      include: { user: true },
    });
    if (!membership) throw new AdminServiceError("El usuario no existe.");
    if (input.role === RoleName.ADMIN_GENERAL) {
      const admins = await transaction.membership.count({
        where: {
          tenantId: input.tenantId,
          active: true,
          roles: {
            some: {
              role: RoleName.ADMIN_GENERAL,
              OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            },
          },
        },
      });
      if (admins <= 1)
        throw new AdminServiceError(
          "No se puede revocar al último administrador.",
        );
    }
    const removed = await transaction.membershipRole.deleteMany({
      where: { membershipId: membership.id, role: input.role },
    });
    if (!removed.count)
      throw new AdminServiceError("El usuario no tiene ese rol.");
    await recordAuditEvent(transaction, {
      tenantId: input.tenantId,
      actorId: input.actorId,
      action: "user.role_revoked",
      entity: "MembershipRole",
      entityId: membership.id,
      metadata: { userId: membership.userId, role: input.role },
    });
  });
}

export async function setMembershipActive(
  database: PrismaClient,
  input: {
    tenantId: string;
    actorId: string;
    membershipId: string;
    active: boolean;
  },
) {
  return database.$transaction(async (transaction) => {
    const membership = await transaction.membership.findFirst({
      where: { id: input.membershipId, tenantId: input.tenantId },
      include: { roles: true },
    });
    if (!membership) throw new AdminServiceError("El usuario no existe.");
    if (!input.active && membership.userId === input.actorId)
      throw new AdminServiceError("No puedes desactivar tu propio acceso.");
    if (
      !input.active &&
      membership.roles.some(({ role }) => role === RoleName.ADMIN_GENERAL)
    ) {
      const admins = await transaction.membership.count({
        where: {
          tenantId: input.tenantId,
          active: true,
          roles: { some: { role: RoleName.ADMIN_GENERAL } },
        },
      });
      if (admins <= 1)
        throw new AdminServiceError(
          "No se puede desactivar al último administrador.",
        );
    }
    await transaction.membership.update({
      where: { id: membership.id },
      data: { active: input.active },
    });
    await recordAuditEvent(transaction, {
      tenantId: input.tenantId,
      actorId: input.actorId,
      action: input.active ? "membership.activated" : "membership.deactivated",
      entity: "Membership",
      entityId: membership.id,
      metadata: { userId: membership.userId },
    });
  });
}

export async function updateCategoryConfiguration(
  database: PrismaClient,
  input: {
    tenantId: string;
    actorId: string;
    category: TicketCategory;
    slaHours: number;
    defaultRole: RoleName | null;
    active: boolean;
  },
) {
  return database.$transaction(async (transaction) => {
    const config = await transaction.categoryConfig.upsert({
      where: {
        tenantId_category: {
          tenantId: input.tenantId,
          category: input.category,
        },
      },
      update: {
        slaHours: input.slaHours,
        defaultRole: input.defaultRole,
        active: input.active,
      },
      create: {
        tenantId: input.tenantId,
        category: input.category,
        slaHours: input.slaHours,
        defaultRole: input.defaultRole,
        active: input.active,
      },
    });
    await recordAuditEvent(transaction, {
      tenantId: input.tenantId,
      actorId: input.actorId,
      action: "configuration.category_updated",
      entity: "CategoryConfig",
      entityId: config.id,
      metadata: {
        category: config.category,
        slaHours: config.slaHours,
        defaultRole: config.defaultRole,
        active: config.active,
      },
    });
    return config;
  });
}

export async function createZoneConfiguration(
  database: PrismaClient,
  input: { tenantId: string; actorId: string; name: string },
) {
  return database.$transaction(async (transaction) => {
    const zone = await transaction.zoneConfig.upsert({
      where: {
        tenantId_name: { tenantId: input.tenantId, name: input.name },
      },
      update: { active: true },
      create: { tenantId: input.tenantId, name: input.name },
    });
    await recordAuditEvent(transaction, {
      tenantId: input.tenantId,
      actorId: input.actorId,
      action: "configuration.zone_created",
      entity: "ZoneConfig",
      entityId: zone.id,
      metadata: { name: zone.name },
    });
    return zone;
  });
}

export async function setZoneActive(
  database: PrismaClient,
  input: { tenantId: string; actorId: string; zoneId: string; active: boolean },
) {
  return database.$transaction(async (transaction) => {
    const zone = await transaction.zoneConfig.findFirst({
      where: { id: input.zoneId, tenantId: input.tenantId },
    });
    if (!zone) throw new AdminServiceError("La zona no existe.");
    await transaction.zoneConfig.update({
      where: { id: zone.id },
      data: { active: input.active },
    });
    await recordAuditEvent(transaction, {
      tenantId: input.tenantId,
      actorId: input.actorId,
      action: input.active
        ? "configuration.zone_activated"
        : "configuration.zone_deactivated",
      entity: "ZoneConfig",
      entityId: zone.id,
      metadata: { name: zone.name },
    });
  });
}

export async function updateTenantSettings(
  database: PrismaClient,
  input: {
    tenantId: string;
    actorId: string;
    notificationChannels: NotificationChannel[];
    emergencyContacts: string[];
  },
) {
  return database.$transaction(async (transaction) => {
    const settings = await transaction.tenantSettings.upsert({
      where: { tenantId: input.tenantId },
      update: {
        notificationChannels: input.notificationChannels,
        emergencyContacts: input.emergencyContacts,
      },
      create: {
        tenantId: input.tenantId,
        notificationChannels: input.notificationChannels,
        emergencyContacts: input.emergencyContacts,
      },
    });
    await recordAuditEvent(transaction, {
      tenantId: input.tenantId,
      actorId: input.actorId,
      action: "configuration.channels_updated",
      entity: "TenantSettings",
      entityId: settings.id,
      metadata: {
        notificationChannels: settings.notificationChannels,
        emergencyContacts: settings.emergencyContacts,
      },
    });
    return settings;
  });
}

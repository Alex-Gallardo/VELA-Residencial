import { PrismaClient, RoleName, TicketCategory } from "@prisma/client";

const prisma = new PrismaClient();

const DEMO = {
  tenantId: "vela_demo_tenant",
  adminId: "00000000-0000-4000-8000-000000000001",
  residentId: "00000000-0000-4000-8000-000000000002",
  dwellingId: "vela_demo_dwelling_001",
  householdId: "vela_demo_household_001",
} as const;

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: "los-robles-demo" },
    update: { active: true, name: "Residencial Los Robles (Demo)" },
    create: {
      id: DEMO.tenantId,
      name: "Residencial Los Robles (Demo)",
      slug: "los-robles-demo",
      plan: "pro",
    },
  });

  const [admin, resident] = await Promise.all([
    prisma.user.upsert({
      where: { email: "admin@vela.demo" },
      update: { fullName: "Ana Administración" },
      create: {
        id: DEMO.adminId,
        email: "admin@vela.demo",
        fullName: "Ana Administración",
      },
    }),
    prisma.user.upsert({
      where: { email: "residente@vela.demo" },
      update: { fullName: "Carlos Residente" },
      create: {
        id: DEMO.residentId,
        email: "residente@vela.demo",
        fullName: "Carlos Residente",
      },
    }),
  ]);

  const [adminMembership, residentMembership] = await Promise.all([
    prisma.membership.upsert({
      where: { tenantId_userId: { tenantId: tenant.id, userId: admin.id } },
      update: { active: true },
      create: { tenantId: tenant.id, userId: admin.id },
    }),
    prisma.membership.upsert({
      where: { tenantId_userId: { tenantId: tenant.id, userId: resident.id } },
      update: { active: true },
      create: { tenantId: tenant.id, userId: resident.id },
    }),
  ]);

  await Promise.all([
    prisma.membershipRole.upsert({
      where: {
        membershipId_role: {
          membershipId: adminMembership.id,
          role: RoleName.ADMIN_GENERAL,
        },
      },
      update: {},
      create: {
        membershipId: adminMembership.id,
        role: RoleName.ADMIN_GENERAL,
      },
    }),
    prisma.membershipRole.upsert({
      where: {
        membershipId_role: {
          membershipId: residentMembership.id,
          role: RoleName.RESIDENTE,
        },
      },
      update: {},
      create: { membershipId: residentMembership.id, role: RoleName.RESIDENTE },
    }),
  ]);

  const dwelling = await prisma.dwelling.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "Casa 12" } },
    update: { zone: "Calle 4" },
    create: {
      id: DEMO.dwellingId,
      tenantId: tenant.id,
      code: "Casa 12",
      zone: "Calle 4",
    },
  });

  await prisma.household.upsert({
    where: { id: DEMO.householdId },
    update: { active: true, name: "Familia Residente" },
    create: {
      id: DEMO.householdId,
      tenantId: tenant.id,
      dwellingId: dwelling.id,
      name: "Familia Residente",
      members: {
        create: {
          tenantId: tenant.id,
          userId: resident.id,
          fullName: resident.fullName ?? "Carlos Residente",
          relation: "PROPIETARIO",
          isPrimary: true,
        },
      },
    },
  });

  await prisma.categoryConfig.createMany({
    data: Object.values(TicketCategory).map((category) => ({
      tenantId: tenant.id,
      category,
      slaHours: category === TicketCategory.SEGURIDAD ? 4 : 48,
      defaultRole:
        category === TicketCategory.SEGURIDAD
          ? RoleName.SEGURIDAD
          : RoleName.OPERACIONES,
    })),
    skipDuplicates: true,
  });

  await prisma.ticket.upsert({
    where: { tenantId_number: { tenantId: tenant.id, number: 1 } },
    update: {},
    create: {
      tenantId: tenant.id,
      number: 1,
      title: "Luminaria apagada",
      description: "La luminaria frente al parque no enciende por la noche.",
      category: TicketCategory.ILUMINACION,
      createdById: resident.id,
      dwellingId: dwelling.id,
      locationText: "Calle 4, frente al parque",
    },
  });

  console.log(`Seed listo: ${tenant.name} (${tenant.slug})`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  HouseholdRelation,
  NoticeType,
  NotificationChannel,
  PrismaClient,
  RoleName,
} from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

import {
  createNotice,
  markNoticeRead,
} from "../src/server/services/notice-service";

config({ path: ".env.local" });

const prisma = new PrismaClient();
const AUTH_MARKER = "-s4-e2e-";
const TENANT_PREFIX = "sprint-4-e2e-";
const CREDENTIALS_DIR = resolve(".test-credentials");
const CREDENTIALS_FILE = resolve(CREDENTIALS_DIR, "sprint-4.json");

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error("Faltan credenciales administrativas de Supabase");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function publicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Faltan credenciales públicas de Supabase");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function cleanup() {
  const supabase = adminClient();
  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error) throw error;
  for (const user of data.users) {
    if (user.email?.includes(AUTH_MARKER)) {
      const deletion = await supabase.auth.admin.deleteUser(user.id);
      if (deletion.error) throw deletion.error;
    }
  }
  await prisma.tenant.deleteMany({
    where: { slug: { startsWith: TENANT_PREFIX } },
  });
  await prisma.user.deleteMany({ where: { email: { contains: AUTH_MARKER } } });
}

async function createAuthUser(
  email: string,
  password: string,
  fullName: string,
) {
  const { data, error } = await adminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user)
    throw error ?? new Error(`No se creó el usuario ${email}`);
  return data.user;
}

async function setup() {
  await cleanup();
  const suffix = Date.now().toString(36);
  const password = `Vela!${randomBytes(18).toString("base64url")}`;
  const emails = {
    admin: `admin${AUTH_MARKER}${suffix}@vela.demo`,
    residentZoneA: `resident-a${AUTH_MARKER}${suffix}@vela.demo`,
    residentZoneB: `resident-b${AUTH_MARKER}${suffix}@vela.demo`,
  };
  const [adminAuth, residentAAuth, residentBAuth] = await Promise.all([
    createAuthUser(emails.admin, password, "Administración Sprint 4"),
    createAuthUser(emails.residentZoneA, password, "Residente Zona A"),
    createAuthUser(emails.residentZoneB, password, "Residente Zona B"),
  ]);
  const tenant = await prisma.tenant.create({
    data: {
      name: "Residencial Prueba Sprint 4",
      slug: `${TENANT_PREFIX}${suffix}`,
      plan: "test",
    },
  });
  const [admin, residentA, residentB] = await Promise.all([
    prisma.user.create({
      data: {
        id: adminAuth.id,
        email: emails.admin,
        fullName: "Administración Sprint 4",
      },
    }),
    prisma.user.create({
      data: {
        id: residentAAuth.id,
        email: emails.residentZoneA,
        fullName: "Residente Zona A",
      },
    }),
    prisma.user.create({
      data: {
        id: residentBAuth.id,
        email: emails.residentZoneB,
        fullName: "Residente Zona B",
      },
    }),
  ]);
  const [adminMembership, membershipA, membershipB, dwellingA, dwellingB] =
    await Promise.all([
      prisma.membership.create({
        data: { tenantId: tenant.id, userId: admin.id },
      }),
      prisma.membership.create({
        data: { tenantId: tenant.id, userId: residentA.id },
      }),
      prisma.membership.create({
        data: { tenantId: tenant.id, userId: residentB.id },
      }),
      prisma.dwelling.create({
        data: { tenantId: tenant.id, code: "Casa A-01", zone: "Zona A" },
      }),
      prisma.dwelling.create({
        data: { tenantId: tenant.id, code: "Casa B-01", zone: "Zona B" },
      }),
    ]);
  await Promise.all([
    prisma.membershipRole.create({
      data: { membershipId: adminMembership.id, role: RoleName.ADMIN_GENERAL },
    }),
    prisma.membershipRole.create({
      data: { membershipId: membershipA.id, role: RoleName.RESIDENTE },
    }),
    prisma.membershipRole.create({
      data: { membershipId: membershipB.id, role: RoleName.RESIDENTE },
    }),
    prisma.household.create({
      data: {
        tenantId: tenant.id,
        dwellingId: dwellingA.id,
        members: {
          create: {
            tenantId: tenant.id,
            userId: residentA.id,
            fullName: residentA.fullName ?? "Residente Zona A",
            relation: HouseholdRelation.PROPIETARIO,
          },
        },
      },
    }),
    prisma.household.create({
      data: {
        tenantId: tenant.id,
        dwellingId: dwellingB.id,
        members: {
          create: {
            tenantId: tenant.id,
            userId: residentB.id,
            fullName: residentB.fullName ?? "Residente Zona B",
            relation: HouseholdRelation.PROPIETARIO,
          },
        },
      },
    }),
  ]);
  const result = await createNotice(prisma, {
    tenantId: tenant.id,
    actorId: admin.id,
    type: NoticeType.ALERTA_CRITICA,
    title: "Prueba segmentada Zona A",
    body: "Este aviso de prueba sólo debe ser visible para residentes de Zona A.",
    audience: { scope: "ZONE", values: ["Zona A"] },
    channels: [NotificationChannel.IN_APP],
    requiresReadReceipt: true,
    publishedAt: new Date(Date.now() - 60_000),
  });

  const credentials = {
    generatedAt: new Date().toISOString(),
    tenant: tenant.name,
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    password,
    users: {
      admin: { email: emails.admin, role: RoleName.ADMIN_GENERAL },
      residentZoneA: { email: emails.residentZoneA, role: RoleName.RESIDENTE },
      residentZoneB: { email: emails.residentZoneB, role: RoleName.RESIDENTE },
    },
    expected: {
      noticeId: result.notice.id,
      residentZoneASeesNotice: true,
      residentZoneBSeesNotice: false,
    },
  };
  await mkdir(CREDENTIALS_DIR, { recursive: true });
  await writeFile(
    CREDENTIALS_FILE,
    `${JSON.stringify(credentials, null, 2)}\n`,
    {
      encoding: "utf8",
      mode: 0o600,
    },
  );
  console.log(
    JSON.stringify({
      ready: true,
      credentialsFile: CREDENTIALS_FILE,
      noticeId: result.notice.id,
    }),
  );
}

async function visibleNoticeIds(email: string, password: string) {
  const client = publicClient();
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) throw signInError;
  let result = await client.from("Notice").select("id");
  for (
    let attempt = 1;
    result.error?.code === "PGRST303" && attempt <= 3;
    attempt += 1
  ) {
    await new Promise((resolvePromise) =>
      setTimeout(resolvePromise, attempt * 2_000),
    );
    result = await client.from("Notice").select("id");
  }
  await client.auth.signOut();
  if (result.error) throw result.error;
  return result.data.map(({ id }) => id as string);
}

async function verify() {
  const fixture = await prisma.tenant.findFirstOrThrow({
    where: { slug: { startsWith: TENANT_PREFIX } },
    include: {
      memberships: { include: { user: true, roles: true } },
      notices: { include: { receipts: true } },
    },
  });
  const credentials = JSON.parse(await readFile(CREDENTIALS_FILE, "utf8")) as {
    password: string;
    users: {
      residentZoneA: { email: string };
      residentZoneB: { email: string };
    };
  };
  const notice = fixture.notices.find(
    ({ title }) => title === "Prueba segmentada Zona A",
  );
  if (!notice) throw new Error("La fixture no contiene el aviso de prueba");
  const [visibleA, visibleB] = await Promise.all([
    visibleNoticeIds(
      credentials.users.residentZoneA.email,
      credentials.password,
    ),
    visibleNoticeIds(
      credentials.users.residentZoneB.email,
      credentials.password,
    ),
  ]);
  const residentA = fixture.memberships.find(
    ({ user }) => user.email === credentials.users.residentZoneA.email,
  );
  if (
    !residentA ||
    !visibleA.includes(notice.id) ||
    visibleB.includes(notice.id) ||
    notice.receipts.length !== 1
  )
    throw new Error(
      `Segmentación cloud inválida: A=${visibleA.length}, B=${visibleB.length}, recibos=${notice.receipts.length}`,
    );
  if (!notice.receipts[0]?.readAt)
    await markNoticeRead(prisma, {
      tenantId: fixture.id,
      noticeId: notice.id,
      userId: residentA.userId,
    });
  const [receipt, notification, audits] = await Promise.all([
    prisma.noticeReceipt.findFirstOrThrow({
      where: { noticeId: notice.id, userId: residentA.userId },
    }),
    prisma.notification.findFirstOrThrow({
      where: { linkUrl: `/avisos/${notice.id}`, userId: residentA.userId },
    }),
    prisma.auditLog.count({
      where: { tenantId: fixture.id, entityId: notice.id },
    }),
  ]);
  if (!receipt.readAt || !notification.readAt || audits < 2)
    throw new Error("Acuse, notificación o auditoría incompletos");
  console.log(
    JSON.stringify({
      verified: true,
      residentAVisibleNotices: visibleA.length,
      residentBVisibleNotices: visibleB.length,
      receiptRead: true,
      audits,
    }),
  );
}

async function main() {
  const command = process.argv[2];
  if (command === "setup") await setup();
  else if (command === "verify") await verify();
  else if (command === "cleanup") {
    await cleanup();
    console.log(JSON.stringify({ cleaned: true }));
  } else {
    throw new Error("Usa setup, verify o cleanup");
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());

import { HouseholdRelation, RoleName } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/auth";
import { AuthorizationError } from "@/lib/permissions";
import {
  createInvitation,
  InvitationError,
} from "@/server/services/invitation-service";

const bodySchema = z.object({
  email: z.string().email(),
  dwellingId: z.string().min(1),
  relation: z.nativeEnum(HouseholdRelation),
  role: z.nativeEnum(RoleName).default(RoleName.RESIDENTE),
});

export async function POST(request: Request) {
  try {
    const context = await requirePermission("invite", "invitation");
    const body = bodySchema.parse(await request.json());
    const result = await createInvitation({
      ...body,
      tenantId: context.membership.tenantId,
      createdById: context.user.id,
      appUrl: process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin,
    });
    return NextResponse.json(
      { id: result.invitation.id, url: result.url },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof AuthorizationError)
      return NextResponse.json({ error: error.message }, { status: 403 });
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: "Solicitud inválida" },
        { status: 400 },
      );
    if (error instanceof InvitationError)
      return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
}

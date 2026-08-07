import { NextRequest, NextResponse } from "next/server";

import { getAuthContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { createDocumentViewUrl } from "@/server/services/document-service";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const [context, { id }] = await Promise.all([getAuthContext(), params]);
  if (!context?.user)
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!context.membership || !can(context.membership, "read", "document"))
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const canManage = can(context.membership, "update", "document");
  const document = await db.document.findFirst({
    where: {
      id,
      tenantId: context.membership.tenantId,
      ...(canManage
        ? {}
        : { isCurrent: true, publishedAt: { lte: new Date() } }),
    },
    select: { storageKey: true },
  });
  if (!document)
    return NextResponse.json(
      { error: "Documento no encontrado" },
      { status: 404 },
    );
  const url = await createDocumentViewUrl(document.storageKey);
  return NextResponse.redirect(url);
}

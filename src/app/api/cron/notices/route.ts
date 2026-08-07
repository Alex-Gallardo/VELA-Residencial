import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { dispatchPendingNotifications } from "@/server/services/notification-delivery";
import { publishDueNotices } from "@/server/services/notice-service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret)
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET no configurado" },
      { status: 503 },
    );
  if (request.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json(
      { ok: false, error: "No autorizado" },
      { status: 401 },
    );

  const published = await publishDueNotices(db);
  const delivery = await dispatchPendingNotifications({ limit: 250 });
  return NextResponse.json({
    ok: true,
    noticesPublished: published.length,
    delivery,
  });
}

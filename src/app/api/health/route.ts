import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    service: "vela-web",
    status: "ok",
    sprint: 3,
    integrations: {
      supabase: Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      ),
      database: Boolean(process.env.DATABASE_URL && process.env.DIRECT_URL),
      sentry: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
      posthog: Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY),
    },
  });
}

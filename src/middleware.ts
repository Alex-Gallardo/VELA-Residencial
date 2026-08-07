import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import {
  isOnboardingRoute,
  isPrivateRoute,
  safeRelativePath,
} from "@/lib/route-guards";

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => to.cookies.set(cookie));
  return to;
}

export async function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("x-vela-user-id");
  requestHeaders.delete("x-vela-tenant-id");

  let sessionResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          sessionResponse = NextResponse.next({
            request: { headers: requestHeaders },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            sessionResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;

  if (!user && isPrivateRoute(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set(
      "next",
      safeRelativePath(`${pathname}${request.nextUrl.search}`),
    );
    return copyCookies(sessionResponse, NextResponse.redirect(loginUrl));
  }

  if (!user) return sessionResponse;

  requestHeaders.set("x-vela-user-id", user.id);
  const { data: membership } = await supabase
    .from("Membership")
    .select("tenantId")
    .eq("userId", user.id)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  if (membership?.tenantId) {
    requestHeaders.set("x-vela-tenant-id", membership.tenantId);
  } else if (isPrivateRoute(pathname) && !isOnboardingRoute(pathname)) {
    const onboardingUrl = request.nextUrl.clone();
    onboardingUrl.pathname = "/onboarding";
    onboardingUrl.search = "";
    return copyCookies(sessionResponse, NextResponse.redirect(onboardingUrl));
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  return copyCookies(sessionResponse, response);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

export const runtime = "nodejs";

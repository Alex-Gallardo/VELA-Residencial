"use client";

import { Analytics } from "@vercel/analytics/react";
import { usePathname, useSearchParams } from "next/navigation";
import { type ReactNode, Suspense, useEffect } from "react";

let posthogInitialized = false;

function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;

    void import("posthog-js").then(({ default: posthog }) => {
      if (!posthogInitialized) {
        posthog.init(key, {
          api_host:
            process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
          capture_pageview: false,
          capture_pageleave: true,
          person_profiles: "identified_only",
        });
        posthogInitialized = true;
      }

      const query = searchParams.toString();
      posthog.capture("$pageview", {
        $current_url: `${window.origin}${pathname}${query ? `?${query}` : ""}`,
      });
    });
  }, [pathname, searchParams]);

  return null;
}

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Suspense fallback={null}>
        <PageViewTracker />
      </Suspense>
      <Analytics />
    </>
  );
}

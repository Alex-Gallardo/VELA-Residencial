import posthog from "posthog-js";

export type AnalyticsEvent = "sprint_0_loaded" | "telemetry_test";

export function capture(
  event: AnalyticsEvent,
  properties?: Record<string, string | number | boolean>,
) {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  posthog.capture(event, properties);
}

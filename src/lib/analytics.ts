import posthog from "posthog-js";

export type AnalyticsEvent =
  | "sprint_0_loaded"
  | "telemetry_test"
  | "report_flow_opened"
  | "ticket_created";

export function capture(
  event: AnalyticsEvent,
  properties?: Record<string, string | number | boolean>,
) {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  posthog.capture(event, properties);
}

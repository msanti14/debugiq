/**
 * apps/web/src/lib/api/analytics.ts
 * Fire-and-forget analytics event helper.
 * Errors are swallowed silently so analytics never breaks the UX.
 */

import { apiFetch } from "@/lib/api/client";

interface AnalyticsProperties {
  days?: number | null;
  top_n?: number | null;
}

export function postAnalyticsEvent(
  eventType: string,
  properties: AnalyticsProperties = {},
): void {
  apiFetch<unknown>("/v0/analytics/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event_type: eventType, properties }),
  }).catch(() => {
    /* fire-and-forget: analytics failures must not surface to the user */
  });
}

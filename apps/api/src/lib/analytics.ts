const allowedEvents = new Set([
  "scan_started",
  "scan_completed",
  "scan_failed",
  "review_submitted",
  "paywall_shown",
  "purchase_completed"
]);

export interface AnalyticsEvent {
  event: string;
  userId: string;
  properties: Record<string, unknown>;
}

export function createAnalyticsEvent(
  event: string,
  userId: string,
  properties: Record<string, unknown> = {}
): AnalyticsEvent {
  if (!allowedEvents.has(event)) {
    throw new Error(`Unsupported event: ${event}`);
  }

  return {
    event,
    userId,
    properties
  };
}

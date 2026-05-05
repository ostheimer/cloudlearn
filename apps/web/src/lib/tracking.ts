export interface ConversionEvent {
  event: "landing_view" | "cta_click" | "testflight_request";
  source: string;
}

export function buildConversionPayload(event: ConversionEvent) {
  return {
    event: event.event,
    source: event.source,
    timestamp: new Date().toISOString()
  };
}

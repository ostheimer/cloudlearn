/**
 * revenueCatWebhookSchema (#607): Ein echtes TRANSFER-Ereignis trägt laut
 * RevenueCat-Doku KEIN app_user_id (nur transferred_from/transferred_to).
 * Das Schema verlangte app_user_id als Pflichtfeld — jeder Gerätewechsel
 * prallte damit als Validierungsfehler ab und die Konten blieben im falschen
 * Tarif zurück. Diese Tests nageln fest, dass beide Ereignisformen parsen.
 */

import { describe, expect, it } from "vitest";
import { revenueCatWebhookSchema } from "@/lib/contracts";

// Realistische Nutzlast nach RevenueCat-Doku: TRANSFER hat nur die
// gemeinsamen Felder + transferred_from/to, KEINE app_user_id/entitlements.
const TRANSFER_PAYLOAD = {
  event: {
    type: "TRANSFER",
    id: "12345678-1234-4123-8123-123456789012",
    store: "APP_STORE",
    environment: "PRODUCTION",
    transferred_from: ["$RCAnonymousID:1234567890abcdef"],
    transferred_to: ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"],
  },
};

const RENEWAL_PAYLOAD = {
  event: {
    app_user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    type: "RENEWAL",
    entitlement_ids: ["pro"],
    expiration_at_ms: 4102444800000,
  },
};

describe("revenueCatWebhookSchema – TRANSFER ohne app_user_id (#607)", () => {
  it("parses a TRANSFER event without app_user_id", () => {
    const parsed = revenueCatWebhookSchema.parse(TRANSFER_PAYLOAD);
    expect(parsed.event.app_user_id).toBeUndefined();
    expect(parsed.event.transferred_to).toEqual(["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"]);
  });

  it("still parses a regular subscription event", () => {
    const parsed = revenueCatWebhookSchema.parse(RENEWAL_PAYLOAD);
    expect(parsed.event.app_user_id).toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  });
});

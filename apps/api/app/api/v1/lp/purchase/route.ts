import { type NextRequest } from "next/server";
import { jsonError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";

// LP packs are real-money consumables. Granting LP for a pack is only ever
// authorized by the RevenueCat webhook (`/api/v1/subscription/webhook`), which
// is verified against the shared signature secret and carries the store's real
// transaction id. This JWT-authenticated endpoint used to grant LP on the
// client's word alone — any logged-in client could mint arbitrary LP by POSTing
// a pack id and a random transaction id, without ever paying. It also
// double-granted every legitimate purchase, because the client's synthetic
// transaction id never matched the webhook's real one, so the idempotency guard
// did not dedupe across the two paths.
//
// The endpoint is intentionally retired. The mobile client already treats a
// failure here as "the webhook will grant it" and refreshes the balance, so
// paying users still receive their LP — just via the one authoritative,
// signature-verified path.
export async function POST(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  return jsonError(
    requestId,
    "PURCHASE_VIA_WEBHOOK",
    "LP packs are granted only via the signature-verified RevenueCat webhook, not this endpoint.",
    410
  );
}

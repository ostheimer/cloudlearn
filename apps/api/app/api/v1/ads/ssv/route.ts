import { type NextRequest } from "next/server";
import { createRequestContext } from "@/lib/observability";
import { processAdSsvCallback } from "@/services/adSsvService";

// GET /api/v1/ads/ssv — AdMob Server-Side Verification callback for rewarded ads.
//
// Authenticated by Google's signature on the query string (verified in the
// service), NOT by a JWT. This is the trustworthy replacement for the retired
// client-asserted type:"ad" self-grant on /lp/earn (#149). Configure this URL as
// the SSV callback in the AdMob console for the rewarded ad unit.
export async function GET(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);

  // Use the RAW query string (not URL-parsed/re-encoded) so the signed bytes match.
  const url = request.url;
  const qIndex = url.indexOf("?");
  const rawQuery = qIndex >= 0 ? url.slice(qIndex + 1) : "";

  try {
    const result = await processAdSsvCallback(rawQuery);

    if (result.status === "invalid_signature") {
      // 403 so a forged/unsigned call is visibly rejected (Google logs non-2xx).
      return new Response("invalid signature", { status: 403 });
    }
    if (result.status === "bad_request") {
      return new Response("bad request", { status: 400 });
    }
    // granted / already_processed → 200 so AdMob considers the reward delivered.
    return new Response("ok", { status: 200 });
  } catch {
    // 500 lets AdMob retry later (transient DB / key-fetch failures).
    return new Response(`error:${requestId}`, { status: 500 });
  }
}

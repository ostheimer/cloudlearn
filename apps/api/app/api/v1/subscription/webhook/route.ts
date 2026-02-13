import { type NextRequest } from "next/server";
import { revenueCatWebhookSchema } from "@/lib/contracts";
import { getEnv } from "@/lib/env";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { mapRevenueCatEventToSubscription } from "@/services/revenueCatService";
import { updateSubscriptionStatus } from "@/services/subscriptionService";

// Webhook route — authenticates via x-revenuecat-signature, not JWT
export async function POST(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const secret = request.headers.get("x-revenuecat-signature");
    const env = getEnv();
    const runtimeEnv =
      process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development";
    if (!env.REVENUECAT_WEBHOOK_SECRET && runtimeEnv === "production") {
      return jsonError(
        requestId,
        "WEBHOOK_NOT_CONFIGURED",
        "RevenueCat webhook secret is not configured",
        503
      );
    }
    if (
      env.REVENUECAT_WEBHOOK_SECRET &&
      secret !== env.REVENUECAT_WEBHOOK_SECRET
    ) {
      return jsonError(
        requestId,
        "UNAUTHORIZED",
        "Invalid webhook signature",
        401
      );
    }

    const parsed = revenueCatWebhookSchema.parse(await request.json());
    const userId = parsed.event.app_user_id;
    const mappedStatus = mapRevenueCatEventToSubscription(parsed.event);

    const status = await updateSubscriptionStatus({
      userId,
      tier: mappedStatus.tier,
      isActive: mappedStatus.isActive,
      expiresAt: mappedStatus.expiresAt,
    });

    return jsonOk(requestId, { requestId, status }, 201);
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(
      requestId,
      normalized.code,
      normalized.message,
      normalized.status
    );
  }
}

import { type NextRequest } from "next/server";
import { revenueCatWebhookSchema } from "@/lib/contracts";
import { getEnv } from "@/lib/env";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { mapRevenueCatEventToSubscription } from "@/services/revenueCatService";
import { updateSubscriptionStatus } from "@/services/subscriptionService";
import { LP_PACKS } from "@/lib/featureGates";
import { grantLpPurchase } from "@/services/lpService";
import { createSupabaseAdminClient } from "@/lib/supabase";

// LP pack event types from RevenueCat (consumable products trigger these)
const LP_PACK_EVENT_TYPES = new Set([
  "NON_RENEWING_PURCHASE",
  "INITIAL_PURCHASE",
]);

async function isLpTransactionProcessed(transactionId: string): Promise<boolean> {
  const db = createSupabaseAdminClient();
  if (!db) return false;
  const { data } = await db
    .from("lp_transactions")
    .select("id")
    .eq("reason", `purchase_${transactionId}`)
    .maybeSingle();
  return Boolean(data);
}

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
    const { event } = parsed;
    const userId = event.app_user_id;

    // ── LP-Pack Purchase (consumable one-time product) ─────────────────────────
    const productId = event.product_id ?? "";
    const pack = LP_PACKS[productId];
    const isLpPackEvent = LP_PACK_EVENT_TYPES.has(event.type) && Boolean(pack);

    if (isLpPackEvent && pack) {
      const transactionId = event.transaction_id ?? event.store_transaction_id ?? "";
      if (transactionId && !(await isLpTransactionProcessed(transactionId))) {
        await grantLpPurchase(userId, pack.lp, `purchase_${transactionId}`);
      }
      // Return 200 immediately — no subscription state update needed for packs
      return jsonOk(requestId, { requestId, type: "lp_pack_granted", productId }, 201);
    }

    // ── Subscription event ─────────────────────────────────────────────────────
    const mappedStatus = mapRevenueCatEventToSubscription(event);
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

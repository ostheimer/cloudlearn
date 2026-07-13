import { type NextRequest } from "next/server";
import { revenueCatWebhookSchema } from "@/lib/contracts";
import { getEnv } from "@/lib/env";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { secureCompare } from "@/lib/secureCompare";
import { mapRevenueCatEventToSubscription } from "@/services/revenueCatService";
import { updateSubscriptionStatus } from "@/services/subscriptionService";
import { LP_PACKS, getLimitsForTier } from "@/lib/featureGates";
import { grantLpPurchase } from "@/services/lpService";
import { createSupabaseAdminClient } from "@/lib/supabase";

// LP pack event types from RevenueCat (consumable products trigger these)
const LP_PACK_EVENT_TYPES = new Set([
  "NON_RENEWING_PURCHASE",
  "INITIAL_PURCHASE",
]);

// Events that open a NEW paid billing period → a fresh monthly LP allotment is due
// (#209 Part A). The subscription tier itself is derived from entitlements + expiry
// (see mapRevenueCatEventToSubscription), not from the event type; this set only
// gates the additive monthly grant, so we do NOT re-grant on PRODUCT_CHANGE,
// UNCANCELLATION, BILLING_ISSUE, EXPIRATION, etc.
const MONTHLY_GRANT_EVENT_TYPES = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
]);

// Webhook route — authenticates via x-revenuecat-signature, not JWT
export async function POST(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const secret = request.headers.get("x-revenuecat-signature");
    const env = getEnv();
    // No configured secret → the webhook is unusable in EVERY environment.
    // (Previously only production 503'd, so preview/dev accepted unauthenticated
    // subscription/LP events.)
    if (!env.REVENUECAT_WEBHOOK_SECRET) {
      return jsonError(
        requestId,
        "WEBHOOK_NOT_CONFIGURED",
        "RevenueCat webhook secret is not configured",
        503
      );
    }
    if (!secureCompare(secret, env.REVENUECAT_WEBHOOK_SECRET)) {
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
      if (transactionId) {
        // grant_lp_purchase is idempotent (partial unique index on the purchase
        // reason), so a duplicate webhook delivery for the same transaction can
        // never double-credit — no application-side check-then-act needed.
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

    // ── Monthly Pro LP grant (#209 Part A) ───────────────────────────────────────
    // grantMonthlyLp had no caller, so Pro subscribers never received their monthly
    // LP allotment. Grant it here — additively, right after the tier update — but only
    // on events that open a new billing period and only when the resolved tier actually
    // grants LP (pro/lifetime: 300, free: 0). grant_monthly_lp is idempotent per
    // (user, period), so a re-delivered webhook for the same period credits nothing.
    // A failure here must NOT fail the webhook: the tier update above already succeeded
    // and must stick, so we log and still return success (as before).
    if (mappedStatus.isActive && MONTHLY_GRANT_EVENT_TYPES.has(event.type)) {
      const grant = getLimitsForTier(mappedStatus.tier).lpGrantPerMonth;
      if (grant > 0) {
        // Period key = the billing period's expiration DATE (YYYY-MM-DD). RevenueCat
        // sends the SAME expiration_at_ms for every re-delivery of one RENEWAL /
        // INITIAL_PURCHASE, and a new (~+1 month) expiration for the next cycle — so it
        // dedupes retries yet advances each period. Fall back to the current month
        // (YYYY-MM) only when the event carries no expiry (e.g. a non-expiring grant).
        const period = mappedStatus.expiresAt
          ? mappedStatus.expiresAt.slice(0, 10)
          : new Date().toISOString().slice(0, 7);
        try {
          const db = createSupabaseAdminClient();
          if (db) {
            const { error: grantError } = await db.rpc("grant_monthly_lp", {
              p_user: userId,
              p_tier: mappedStatus.tier,
              p_amount: grant,
              p_period: period,
            });
            if (grantError) {
              console.error(
                `[subscription/webhook] monthly LP grant failed for ${userId} (${requestId}): ${grantError.message}`
              );
            }
          }
        } catch (grantError) {
          // Never let the additive LP grant break the subscription webhook.
          console.error(
            `[subscription/webhook] monthly LP grant threw for ${userId} (${requestId}):`,
            grantError
          );
        }
      }
    }

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

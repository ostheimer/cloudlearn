import { type NextRequest } from "next/server";
import { revenueCatWebhookSchema } from "@/lib/contracts";
import { getEnv } from "@/lib/env";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { secureCompare } from "@/lib/secureCompare";
import { mapRevenueCatEventToSubscription } from "@/services/revenueCatService";
import {
  transferSubscriptionBetweenUsers,
  updateSubscriptionStatus,
} from "@/services/subscriptionService";
import { LP_PACKS } from "@/lib/featureGates";
import { currentLpGrantPeriod, grantLpPurchase, grantMonthlyLp } from "@/services/lpService";

// LP pack event types from RevenueCat (consumable products trigger these)
const LP_PACK_EVENT_TYPES = new Set([
  "NON_RENEWING_PURCHASE",
  "INITIAL_PURCHASE",
]);

// Events that open a NEW paid billing period → a fresh monthly LP allotment is due
// (#209 Part A). NON_RENEWING_PURCHASE is how RevenueCat reports a LIFETIME
// purchase (#604) — LP packs arrive as NON_RENEWING_PURCHASE too, but the
// LP-pack branch in POST returns before the monthly grant is reached.
// The subscription tier itself is derived from entitlements + expiry
// (see mapRevenueCatEventToSubscription), not from the event type; this set only
// gates the additive monthly grant, so we do NOT re-grant on PRODUCT_CHANGE,
// UNCANCELLATION, BILLING_ISSUE, EXPIRATION, etc.
const MONTHLY_GRANT_EVENT_TYPES = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "NON_RENEWING_PURCHASE",
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

    // ── TRANSFER (Gerätewechsel / Family Sharing, #607) ────────────────────────
    // Trägt kein app_user_id — die Konten stehen in transferred_from/to. Ohne
    // diesen Zweig behielte das alte Konto Pro und das neue bliebe Free.
    if (event.type === "TRANSFER") {
      const { movedTier } = await transferSubscriptionBetweenUsers(
        event.transferred_from ?? [],
        event.transferred_to ?? []
      );
      return jsonOk(requestId, { requestId, type: "transfer_processed", movedTier }, 201);
    }

    const userId = event.app_user_id;
    if (!userId) {
      return jsonError(
        requestId,
        "VALIDATION_ERROR",
        "app_user_id is required for non-transfer events",
        400
      );
    }

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

    // ── Monthly Pro LP grant (#209 Part A, #604) ─────────────────────────────────
    // Instant credit on events that open a new paid period, so buyers see their
    // 300 LP immediately. The period key is the CALENDAR MONTH — the same key the
    // monthly cron (/api/v1/lp/monthly-grant) uses, so webhook and cron can never
    // double-credit each other: grant_monthly_lp is idempotent per (user, period).
    // (The key used to be the billing period's expiry date, which paid annual subs
    // once per YEAR, never paid lifetime, and would have collided with the cron.)
    // A failure here must NOT fail the webhook: the tier update above already
    // succeeded and must stick, so we log and still return success (as before).
    if (mappedStatus.isActive && MONTHLY_GRANT_EVENT_TYPES.has(event.type)) {
      try {
        await grantMonthlyLp(userId, mappedStatus.tier, currentLpGrantPeriod());
      } catch (grantError) {
        // Never let the additive LP grant break the subscription webhook.
        console.error(
          `[subscription/webhook] monthly LP grant failed for ${userId} (${requestId}):`,
          grantError
        );
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

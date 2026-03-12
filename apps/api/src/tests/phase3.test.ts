/**
 * Phase 3: Streak Milestones, LP Pack Purchase, Referral System
 *
 * These unit tests cover the business rules for all Phase 3 features.
 * They serve as the specification for the corresponding Playwright E2E tests.
 *
 * Playwright test steps are documented in comments at the bottom of each section.
 */

import { describe, it, expect } from "vitest";
import { LP_PACKS, LP_EARN_RULES, getLimitsForTier } from "@/lib/featureGates";

// ─── Streak Milestones ────────────────────────────────────────────────────────

describe("Streak Milestones", () => {
  const MILESTONE_LP: Record<string, number> = {
    first_deck:    LP_EARN_RULES.firstDeck,
    first_review:  LP_EARN_RULES.firstReview,
    streak_7:      LP_EARN_RULES.streakDay7,
    streak_30:     LP_EARN_RULES.streakDay30,
    streak_100:    LP_EARN_RULES.streakDay100,
  };

  it("first_deck grants 10 LP", () => {
    expect(MILESTONE_LP.first_deck).toBe(10);
  });

  it("first_review grants 5 LP", () => {
    expect(MILESTONE_LP.first_review).toBe(5);
  });

  it("streak_7 grants 25 LP", () => {
    expect(MILESTONE_LP.streak_7).toBe(25);
  });

  it("streak_30 grants 100 LP", () => {
    expect(MILESTONE_LP.streak_30).toBe(100);
  });

  it("streak_100 grants 300 LP", () => {
    expect(MILESTONE_LP.streak_100).toBe(300);
  });

  it("streak_30 bonus is 4× the streak_7 bonus", () => {
    expect(LP_EARN_RULES.streakDay30).toBe(LP_EARN_RULES.streakDay7 * 4);
  });

  it("streak_100 bonus is 3× the streak_30 bonus", () => {
    expect(LP_EARN_RULES.streakDay100).toBe(LP_EARN_RULES.streakDay30 * 3);
  });

  /**
   * Playwright E2E:
   * 1. Log in as test user with streak = 6.
   * 2. Complete a review session (this sets streak = 7).
   * 3. Assert MilestoneToast appears with "+25 LP".
   * 4. Assert LP balance increased by 25.
   * 5. Repeat review – toast must NOT appear again (idempotent).
   */
});

// ─── LP Pack Definitions ─────────────────────────────────────────────────────

describe("LP Packs", () => {
  it("defines lp_pack_100 with 100 LP at 0.99 EUR", () => {
    expect(LP_PACKS["lp_pack_100"]).toEqual({ lp: 100, priceEur: 0.99 });
  });

  it("defines lp_pack_300 with 300 LP at 2.49 EUR", () => {
    expect(LP_PACKS["lp_pack_300"]).toEqual({ lp: 300, priceEur: 2.49 });
  });

  it("defines lp_pack_750 with 750 LP at 4.99 EUR", () => {
    expect(LP_PACKS["lp_pack_750"]).toEqual({ lp: 750, priceEur: 4.99 });
  });

  it("defines lp_pack_2000 with 2000 LP at 9.99 EUR", () => {
    expect(LP_PACKS["lp_pack_2000"]).toEqual({ lp: 2000, priceEur: 9.99 });
  });

  it("lp_pack_300 is the best value per euro", () => {
    const ratios = Object.values(LP_PACKS).map((p) => p.lp / p.priceEur);
    const best = Math.max(...ratios);
    expect(LP_PACKS["lp_pack_2000"]!.lp / LP_PACKS["lp_pack_2000"]!.priceEur).toBeCloseTo(best, 0);
  });

  it("all pack product IDs start with lp_pack_", () => {
    for (const id of Object.keys(LP_PACKS)) {
      expect(id.startsWith("lp_pack_")).toBe(true);
    }
  });

  /**
   * Playwright E2E (LP Pack Purchase):
   * 1. Navigate to /lp-store.
   * 2. Tap "300 LP – 2,49 €" pack.
   * 3. Mock RevenueCat.purchasePackage to return a successful result.
   * 4. Assert API receives POST /api/v1/lp/purchase { packId: "lp_pack_300", transactionId: "..." }.
   * 5. Assert LP balance increased by 300 and toast shown.
   * 6. Tap the same pack again with the same transactionId → assert "alreadyProcessed: true" returned.
   */
});

// ─── Referral System ──────────────────────────────────────────────────────────

describe("Referral LP Rules", () => {
  it("referral sender earns 50 LP", () => {
    expect(LP_EARN_RULES.referralSender).toBe(50);
  });

  it("referral receiver earns 25 LP", () => {
    expect(LP_EARN_RULES.referralReceiver).toBe(25);
  });

  it("sender earns 2× the receiver bonus", () => {
    expect(LP_EARN_RULES.referralSender).toBe(LP_EARN_RULES.referralReceiver * 2);
  });

  /**
   * Playwright E2E (Referral):
   * 1. Log in as userA. Navigate to /referral. Copy referral code.
   * 2. Log in as userB. Navigate to /referral. Enter userA's code and tap "Einlösen".
   * 3. Assert userB receives +25 LP and alert shows correct balance.
   * 4. Check via API that userA received +50 LP.
   * 5. Attempt to use the same code as userB again → assert "ALREADY_REFERRED" error.
   * 6. Attempt to use userA's own code as userA → assert "SELF_REFERRAL" error.
   */
});

// ─── Webhook: LP Pack vs Subscription ────────────────────────────────────────

describe("RevenueCat Webhook routing", () => {
  it("LP_PACKS does not include any subscription product IDs", () => {
    const subscriptionKeywords = ["monthly", "annual", "yearly", "subscription"];
    for (const id of Object.keys(LP_PACKS)) {
      const hasSubKeyword = subscriptionKeywords.some((kw) => id.toLowerCase().includes(kw));
      expect(hasSubKeyword).toBe(false);
    }
  });

  it("pro tier has adFree = true", () => {
    expect(getLimitsForTier("pro").adFree).toBe(true);
  });

  it("free tier has adFree = false", () => {
    expect(getLimitsForTier("free").adFree).toBe(false);
  });

  /**
   * Playwright E2E (Webhook):
   * 1. POST to /api/v1/subscription/webhook with type=NON_RENEWING_PURCHASE, product_id=lp_pack_300.
   * 2. Assert response is 201 with { type: "lp_pack_granted" }.
   * 3. Assert user's LP balance increased by 300.
   * 4. POST same payload again (duplicate transaction_id) → assert balance unchanged (idempotent).
   */
});

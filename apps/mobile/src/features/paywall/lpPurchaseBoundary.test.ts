import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The mobile workspace has no React Native renderer. Keep this narrow source
// boundary guard alongside the behavioural SDK purchase tests: consumable LP
// must only be credited by the verified webhook, never by a client grant call.
const store = readFileSync(new URL("../../../app/lp-store.tsx", import.meta.url), "utf8");
const purchaseHandler = store.slice(store.indexOf("const handleBuyPack"), store.indexOf("const handleBuyFreeze"));

describe("LP purchase webhook boundary", () => {
  it("never requests a client-side LP grant or invents a transaction ID", () => {
    expect(purchaseHandler).not.toContain("grantLpPackPurchase");
    expect(purchaseHandler).not.toContain("transactionId");
    expect(purchaseHandler).not.toContain("lp.purchaseSuccessBody");
  });

  it("retains store cancellation/error handling and announces pending webhook credit", () => {
    expect(purchaseHandler).toContain("await purchaseRevenueCatPackage(userId, storeOffer.identifier)");
    expect(purchaseHandler).toContain("if (result.cancelled)");
    expect(purchaseHandler).toContain("if (result.error)");
    expect(purchaseHandler).toContain('t("lp.purchaseSuccessWebhook", { lp: pack.lp })');
    expect(purchaseHandler).toContain("void loadBalance()");
  });
});

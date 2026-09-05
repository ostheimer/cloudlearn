import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({
  configure: vi.fn(),
  logIn: vi.fn(),
  logOut: vi.fn(),
  getOfferings: vi.fn(),
  getCustomerInfo: vi.fn(),
  purchasePackage: vi.fn(),
  restorePurchases: vi.fn(),
}));
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("react-native-purchases", () => ({ default: sdk }));

const proInfo = {
  entitlements: { active: { pro: { identifier: "pro", expirationDate: "2099-01-01T00:00:00Z" } } },
};
const offer = {
  identifier: "$rc_monthly", packageType: "MONTHLY",
  product: { title: "Pro", description: "Pro monthly", priceString: "€4.99" },
};

afterEach(() => vi.unstubAllEnvs());

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.stubEnv("EXPO_PUBLIC_REVENUECAT_IOS_API_KEY", "appl_local_test_only");
  sdk.getOfferings.mockResolvedValue({ current: { availablePackages: [offer] } });
  sdk.purchasePackage.mockResolvedValue({ customerInfo: proInfo });
  sdk.restorePurchases.mockResolvedValue(proInfo);
  sdk.getCustomerInfo.mockResolvedValue(proInfo);
});

describe("RevenueCat purchase and restore boundary", () => {
  it("does not start purchases when the platform API key is absent", async () => {
    vi.stubEnv("EXPO_PUBLIC_REVENUECAT_IOS_API_KEY", "");
    const rc = await import("./revenuecat");
    expect(await rc.purchaseRevenueCatPackage("user-a", offer.identifier)).toMatchObject({ subscription: null, error: expect.any(String) });
    expect(sdk.configure).not.toHaveBeenCalled();
    expect(sdk.purchasePackage).not.toHaveBeenCalled();
  });

  it("configures the authenticated app user before purchasing and maps their entitlement", async () => {
    const rc = await import("./revenuecat");
    const result = await rc.purchaseRevenueCatPackage("user-a", offer.identifier);
    expect(sdk.configure).toHaveBeenCalledWith({ apiKey: "appl_local_test_only", appUserID: "user-a" });
    expect(sdk.purchasePackage).toHaveBeenCalledWith(offer);
    expect(result).toMatchObject({ cancelled: false, subscription: { tier: "pro", isActive: true } });
  });

  it("treats user cancellation as cancellation without granting a subscription", async () => {
    sdk.purchasePackage.mockRejectedValue({ userCancelled: true });
    const rc = await import("./revenuecat");
    expect(await rc.purchaseRevenueCatPackage("user-a", offer.identifier)).toEqual({ cancelled: true, subscription: null });
  });

  it("returns an error when an offering was removed before purchase", async () => {
    const rc = await import("./revenuecat");
    expect(await rc.purchaseRevenueCatPackage("user-a", "removed-offer")).toMatchObject({ subscription: null, error: expect.any(String) });
    expect(sdk.purchasePackage).not.toHaveBeenCalled();
  });

  it("restores the authenticated user's active entitlement", async () => {
    const rc = await import("./revenuecat");
    expect(await rc.restoreRevenueCatPurchases("user-a")).toMatchObject({ subscription: { tier: "pro", isActive: true } });
    expect(sdk.restorePurchases).toHaveBeenCalledOnce();
  });

  it("returns a restore error without claiming an entitlement", async () => {
    sdk.restorePurchases.mockRejectedValue(new Error("Store temporarily unavailable"));
    const rc = await import("./revenuecat");
    expect(await rc.restoreRevenueCatPurchases("user-a")).toEqual({ subscription: null, error: "Store temporarily unavailable" });
  });

  it.each(["purchase", "restore", "snapshot", "offerings"])("blocks %s after a failed account switch and retries the login later", async (operation) => {
    const rc = await import("./revenuecat");
    await rc.initializeRevenueCatForUser("user-a");
    sdk.logIn.mockRejectedValueOnce(new Error("offline"));
    if (operation === "purchase") {
      expect(await rc.purchaseRevenueCatPackage("user-b", offer.identifier)).toMatchObject({ subscription: null, error: expect.any(String) });
    } else if (operation === "restore") {
      expect(await rc.restoreRevenueCatPurchases("user-b")).toMatchObject({ subscription: null, error: expect.any(String) });
    } else if (operation === "snapshot") {
      expect(await rc.getRevenueCatSubscriptionSnapshot("user-b")).toBeNull();
    } else {
      expect(await rc.getRevenueCatOfferings("user-b")).toEqual([]);
    }
    expect(sdk.purchasePackage).not.toHaveBeenCalled();
    expect(sdk.restorePurchases).not.toHaveBeenCalled();
    expect(sdk.getCustomerInfo).not.toHaveBeenCalled();
    expect(sdk.getOfferings).not.toHaveBeenCalled();
    expect(await rc.initializeRevenueCatForUser("user-b")).toEqual({ available: true, reason: null });
    expect(sdk.logIn).toHaveBeenCalledTimes(2);
    expect(sdk.logIn).toHaveBeenLastCalledWith("user-b");
  });
});

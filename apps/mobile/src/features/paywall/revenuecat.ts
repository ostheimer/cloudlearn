import { Platform } from "react-native";
import type { CustomerInfo, PurchasesPackage } from "react-native-purchases";
import {
  deriveSubscriptionFromEntitlements,
  type SubscriptionSnapshot,
} from "./subscriptionMapping";

type PurchasesModule = typeof import("react-native-purchases");
type PurchasesClient = PurchasesModule["default"];

type RevenueCatAvailabilityReason =
  | "native_module_unavailable"
  | "missing_api_key"
  | null;

export interface RevenueCatAvailability {
  available: boolean;
  reason: RevenueCatAvailabilityReason;
}

export interface RevenueCatOffer {
  identifier: string;
  title: string;
  description: string;
  priceString: string;
  packageType: string;
}

export interface RevenueCatPurchaseResult {
  cancelled: boolean;
  subscription: SubscriptionSnapshot | null;
  error?: string;
}

let purchasesModulePromise: Promise<PurchasesModule | null> | null = null;
let isRevenueCatConfigured = false;
let activeRevenueCatUserId: string | null = null;

const PACKAGE_PRIORITY: Record<string, number> = {
  ANNUAL: 0,
  MONTHLY: 1,
  LIFETIME: 2,
};

async function loadPurchasesModule(): Promise<PurchasesModule | null> {
  if (!purchasesModulePromise) {
    purchasesModulePromise = import("react-native-purchases").catch(() => null);
  }
  return purchasesModulePromise;
}

function getRevenueCatApiKey(): string {
  if (Platform.OS === "ios") {
    return process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? "";
  }
  if (Platform.OS === "android") {
    return process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ?? "";
  }
  return "";
}

async function getRevenueCatClient(): Promise<{
  client: PurchasesClient | null;
  reason: RevenueCatAvailabilityReason;
}> {
  const module = await loadPurchasesModule();
  const client = module?.default ?? null;
  if (!client) {
    return { client: null, reason: "native_module_unavailable" };
  }

  const apiKey = getRevenueCatApiKey();
  if (!apiKey) {
    return { client: null, reason: "missing_api_key" };
  }

  return { client, reason: null };
}

async function ensureRevenueCatConfigured(
  userId: string
): Promise<RevenueCatAvailability> {
  const { client, reason } = await getRevenueCatClient();
  if (!client) {
    return { available: false, reason };
  }

  if (!isRevenueCatConfigured) {
    client.configure({ apiKey: getRevenueCatApiKey(), appUserID: userId });
    isRevenueCatConfigured = true;
    activeRevenueCatUserId = userId;
    return { available: true, reason: null };
  }

  if (activeRevenueCatUserId !== userId) {
    try {
      await client.logIn(userId);
      activeRevenueCatUserId = userId;
    } catch {
      // Keep app usable even if RC user switch fails temporarily.
    }
  }

  return { available: true, reason: null };
}

function mapCustomerInfoToSubscription(
  customerInfo: CustomerInfo
): SubscriptionSnapshot {
  const entitlements = Object.values(customerInfo.entitlements.active).map(
    (entitlement) => ({
      identifier: entitlement.identifier,
      expirationDate: entitlement.expirationDate ?? null,
    })
  );
  return deriveSubscriptionFromEntitlements(entitlements);
}

function mapPackageToOffer(revenueCatPackage: PurchasesPackage): RevenueCatOffer {
  return {
    identifier: revenueCatPackage.identifier,
    title: revenueCatPackage.product.title,
    description: revenueCatPackage.product.description,
    priceString: revenueCatPackage.product.priceString,
    packageType: revenueCatPackage.packageType,
  };
}

function sortOffers(offers: RevenueCatOffer[]): RevenueCatOffer[] {
  return [...offers].sort((a, b) => {
    const aPriority = PACKAGE_PRIORITY[a.packageType] ?? 99;
    const bPriority = PACKAGE_PRIORITY[b.packageType] ?? 99;
    return aPriority - bPriority;
  });
}

export async function getRevenueCatAvailability(): Promise<RevenueCatAvailability> {
  const { client, reason } = await getRevenueCatClient();
  return { available: Boolean(client), reason };
}

export async function initializeRevenueCatForUser(
  userId: string
): Promise<RevenueCatAvailability> {
  return ensureRevenueCatConfigured(userId);
}

export async function logoutRevenueCatUser(): Promise<void> {
  const { client } = await getRevenueCatClient();
  if (!client || !isRevenueCatConfigured) return;

  try {
    await client.logOut();
    activeRevenueCatUserId = null;
  } catch {
    // Ignore logout errors and keep auth flow uninterrupted.
  }
}

export async function getRevenueCatOfferings(
  userId: string
): Promise<RevenueCatOffer[]> {
  const setup = await ensureRevenueCatConfigured(userId);
  if (!setup.available) return [];

  const { client } = await getRevenueCatClient();
  if (!client) return [];

  const offerings = await client.getOfferings();
  const packages = offerings.current?.availablePackages ?? [];
  return sortOffers(packages.map(mapPackageToOffer));
}

export async function getRevenueCatSubscriptionSnapshot(
  userId: string
): Promise<SubscriptionSnapshot | null> {
  const setup = await ensureRevenueCatConfigured(userId);
  if (!setup.available) return null;

  const { client } = await getRevenueCatClient();
  if (!client) return null;

  const customerInfo = await client.getCustomerInfo();
  return mapCustomerInfoToSubscription(customerInfo);
}

export async function purchaseRevenueCatPackage(
  userId: string,
  packageIdentifier: string
): Promise<RevenueCatPurchaseResult> {
  const setup = await ensureRevenueCatConfigured(userId);
  if (!setup.available) {
    return {
      cancelled: false,
      subscription: null,
      error: "RevenueCat ist nicht verfügbar.",
    };
  }

  const { client } = await getRevenueCatClient();
  if (!client) {
    return {
      cancelled: false,
      subscription: null,
      error: "RevenueCat ist nicht verfügbar.",
    };
  }

  const offerings = await client.getOfferings();
  const selectedPackage = offerings.current?.availablePackages.find(
    (pkg) => pkg.identifier === packageIdentifier
  );

  if (!selectedPackage) {
    return {
      cancelled: false,
      subscription: null,
      error: "Das gewählte Angebot wurde nicht gefunden.",
    };
  }

  try {
    const result = await client.purchasePackage(selectedPackage);
    return {
      cancelled: false,
      subscription: mapCustomerInfoToSubscription(result.customerInfo),
    };
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "userCancelled" in error &&
      (error as { userCancelled?: boolean }).userCancelled
    ) {
      return { cancelled: true, subscription: null };
    }
    return {
      cancelled: false,
      subscription: null,
      error: error instanceof Error ? error.message : "Kauf fehlgeschlagen.",
    };
  }
}

export async function restoreRevenueCatPurchases(
  userId: string
): Promise<{ subscription: SubscriptionSnapshot | null; error?: string }> {
  const setup = await ensureRevenueCatConfigured(userId);
  if (!setup.available) {
    return {
      subscription: null,
      error: "RevenueCat ist nicht verfügbar.",
    };
  }

  const { client } = await getRevenueCatClient();
  if (!client) {
    return {
      subscription: null,
      error: "RevenueCat ist nicht verfügbar.",
    };
  }

  try {
    const customerInfo = await client.restorePurchases();
    return {
      subscription: mapCustomerInfoToSubscription(customerInfo),
    };
  } catch (error) {
    return {
      subscription: null,
      error:
        error instanceof Error
          ? error.message
          : "Wiederherstellen fehlgeschlagen.",
    };
  }
}

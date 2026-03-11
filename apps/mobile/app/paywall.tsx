import { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CheckCircle2, Zap } from "lucide-react-native";
import {
  getRevenueCatAvailability,
  getRevenueCatOfferings,
  purchaseRevenueCatPackage,
  restoreRevenueCatPurchases,
  type RevenueCatOffer,
} from "../src/features/paywall/revenuecat";
import { type SubscriptionTier } from "../src/features/paywall/subscriptionMapping";
import { getSubscriptionStatus, getAiUsage } from "../src/lib/api";
import { useSessionStore } from "../src/store/sessionStore";
import { useUsageStore } from "../src/store/usageStore";
import { radius, shadows, spacing, typography, useColors } from "../src/theme";

const BACKEND_SYNC_MAX_RETRIES = 6;
const BACKEND_SYNC_DELAY_MS = 1500;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForBackendSubscriptionSync(
  userId: string
): Promise<SubscriptionTier> {
  for (let attempt = 0; attempt < BACKEND_SYNC_MAX_RETRIES; attempt += 1) {
    const status = await getSubscriptionStatus(userId);
    if (status.status.tier !== "free") {
      return status.status.tier;
    }
    if (attempt < BACKEND_SYNC_MAX_RETRIES - 1) {
      await wait(BACKEND_SYNC_DELAY_MS);
    }
  }

  return "free";
}

const PRO_FEATURES = [
  "paywall.feature.scans",
  "paywall.feature.url",
  "paywall.feature.pdf",
  "paywall.feature.occlusion",
  "paywall.feature.offline",
  "paywall.feature.decks",
] as const;

export default function PaywallScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const router = useRouter();
  const userId = useSessionStore((state) => state.userId);
  const [tier, setTier] = useState<SubscriptionTier>("free");
  const [offers, setOffers] = useState<RevenueCatOffer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activePurchaseId, setActivePurchaseId] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [availabilityReason, setAvailabilityReason] = useState<
    "native_module_unavailable" | "missing_api_key" | null
  >(null);

  const usageStore = useUsageStore();
  const setUsage = useUsageStore((state) => state.setUsage);

  useEffect(() => {
    let isMounted = true;

    const loadPaywall = async () => {
      if (!userId) {
        if (isMounted) setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const [status, usageData] = await Promise.all([
          getSubscriptionStatus(userId),
          getAiUsage().catch(() => null),
        ]);
        if (isMounted) {
          setTier(status.status.tier);
          if (usageData) setUsage(usageData);
        }

        const availability = await getRevenueCatAvailability();
        if (!availability.available) {
          if (isMounted) {
            setAvailabilityReason(availability.reason);
            setOffers([]);
          }
          return;
        }

        const revenueCatOffers = await getRevenueCatOfferings(userId);
        if (isMounted) {
          setOffers(revenueCatOffers);
          setAvailabilityReason(null);
        }
      } catch (error) {
        if (isMounted) {
          Alert.alert(
            t("common.error"),
            error instanceof Error ? error.message : t("paywall.loadError")
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadPaywall();

    return () => {
      isMounted = false;
    };
  }, [userId, t]);

  const availabilityMessage = useMemo(() => {
    if (availabilityReason === "native_module_unavailable") {
      return t("paywall.unavailableNative");
    }
    if (availabilityReason === "missing_api_key") {
      return t("paywall.unavailableApiKey");
    }
    return null;
  }, [availabilityReason, t]);

  const handlePurchase = async (offer: RevenueCatOffer) => {
    if (!userId) return;

    setActivePurchaseId(offer.identifier);
    try {
      const purchaseResult = await purchaseRevenueCatPackage(
        userId,
        offer.identifier
      );
      if (purchaseResult.cancelled) {
        return;
      }
      if (purchaseResult.error) {
        Alert.alert(t("common.error"), purchaseResult.error);
        return;
      }

      const syncedTier = await waitForBackendSubscriptionSync(userId);
      if (syncedTier !== "free") {
        setTier(syncedTier);
        Alert.alert(
          t("paywall.purchaseSuccessTitle"),
          t("paywall.purchaseSuccessBody"),
          [
            {
              text: t("paywall.continue"),
              onPress: () => router.back(),
            },
          ]
        );
        return;
      }

      if (
        purchaseResult.subscription &&
        purchaseResult.subscription.tier !== "free"
      ) {
        setTier(purchaseResult.subscription.tier);
        Alert.alert(
          t("paywall.pendingSyncTitle"),
          t("paywall.pendingSyncBody")
        );
        return;
      }

      Alert.alert(t("common.error"), t("paywall.purchaseUnknownError"));
    } catch (error) {
      Alert.alert(
        t("common.error"),
        error instanceof Error ? error.message : t("paywall.purchaseUnknownError")
      );
    } finally {
      setActivePurchaseId(null);
    }
  };

  const handleRestore = async () => {
    if (!userId) return;

    setIsRestoring(true);
    try {
      const restoreResult = await restoreRevenueCatPurchases(userId);
      if (restoreResult.error) {
        Alert.alert(t("common.error"), restoreResult.error);
        return;
      }

      const syncedTier = await waitForBackendSubscriptionSync(userId);
      if (syncedTier !== "free") {
        setTier(syncedTier);
        Alert.alert(t("paywall.restoreSuccessTitle"), t("paywall.restoreSuccessBody"));
        return;
      }

      if (
        restoreResult.subscription &&
        restoreResult.subscription.tier !== "free"
      ) {
        setTier(restoreResult.subscription.tier);
        Alert.alert(t("paywall.pendingSyncTitle"), t("paywall.pendingSyncBody"));
        return;
      }

      Alert.alert(t("paywall.restoreNoneTitle"), t("paywall.restoreNoneBody"));
    } catch (error) {
      Alert.alert(
        t("common.error"),
        error instanceof Error ? error.message : t("paywall.restoreUnknownError")
      );
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
      >
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <Zap size={28} color={colors.primary} />
          <Text style={{ fontSize: typography.xxxl, fontWeight: typography.bold, color: colors.text }}>
            {t("paywall.title")}
          </Text>
        </View>
        <Text style={{ color: colors.textSecondary, fontSize: typography.base }}>
          {t("paywall.subtitle")}
        </Text>

        {/* Usage this month — only show for free tier */}
        {tier === "free" && usageStore.aiScansLimit !== null && (
          <View style={{
            backgroundColor: colors.surface,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.lg,
            gap: spacing.sm,
          }}>
            <Text style={{ color: colors.textSecondary, fontSize: typography.sm, fontWeight: typography.semibold }}>
              {t("paywall.usageTitle")}
            </Text>
            {/* Scan bar */}
            <View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                <Text style={{ color: colors.text, fontSize: typography.sm }}>{t("paywall.aiScans")}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: typography.sm }}>
                  {usageStore.aiScansUsed}/{usageStore.aiScansLimit}
                </Text>
              </View>
              <View style={{ height: 6, backgroundColor: colors.border, borderRadius: 3 }}>
                <View style={{
                  height: 6,
                  width: `${Math.min(((usageStore.aiScansUsed) / (usageStore.aiScansLimit ?? 1)) * 100, 100)}%`,
                  backgroundColor: (usageStore.aiScansRemaining ?? 1) === 0 ? colors.error : colors.primary,
                  borderRadius: 3,
                }} />
              </View>
            </View>
            {/* URL Import bar */}
            {usageStore.urlImportsLimit !== null && (
              <View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                  <Text style={{ color: colors.text, fontSize: typography.sm }}>{t("paywall.urlImports")}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: typography.sm }}>
                    {usageStore.urlImportsUsed}/{usageStore.urlImportsLimit}
                  </Text>
                </View>
                <View style={{ height: 6, backgroundColor: colors.border, borderRadius: 3 }}>
                  <View style={{
                    height: 6,
                    width: `${Math.min(((usageStore.urlImportsUsed) / (usageStore.urlImportsLimit ?? 1)) * 100, 100)}%`,
                    backgroundColor: (usageStore.urlImportsRemaining ?? 1) === 0 ? colors.error : colors.primary,
                    borderRadius: 3,
                  }} />
                </View>
              </View>
            )}
          </View>
        )}

        {/* Pro feature list */}
        <View style={{
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          padding: spacing.lg,
          gap: spacing.sm,
        }}>
          <Text style={{ color: colors.text, fontSize: typography.base, fontWeight: typography.bold, marginBottom: spacing.xs }}>
            {t("paywall.featuresTitle")}
          </Text>
          {PRO_FEATURES.map((key) => (
            <View key={key} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <CheckCircle2 size={18} color={colors.success} />
              <Text style={{ color: colors.text, fontSize: typography.sm, flex: 1 }}>
                {t(key)}
              </Text>
            </View>
          ))}
        </View>

        <View style={{
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          padding: spacing.lg,
          gap: spacing.sm,
        }}>
          <Text style={{ color: colors.textSecondary, fontSize: typography.sm }}>
            {t("paywall.currentTierLabel")}
          </Text>
          <Text style={{ color: colors.text, fontSize: typography.xl, fontWeight: typography.bold }}>
            {tier === "free" ? t("paywall.tierFree") : tier === "pro" ? t("paywall.tierPro") : t("paywall.tierLifetime")}
          </Text>
        </View>

        {isLoading ? (
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.lg,
              padding: spacing.xl,
              alignItems: "center",
            }}
          >
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : null}

        {!isLoading && availabilityMessage ? (
          <View
            style={{
              backgroundColor: colors.warningLight,
              borderRadius: radius.md,
              padding: spacing.md,
              borderWidth: 1,
              borderColor: colors.warning,
            }}
          >
            <Text style={{ color: colors.warning, fontWeight: typography.medium }}>
              {availabilityMessage}
            </Text>
          </View>
        ) : null}

        {!isLoading && tier !== "free" ? (
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.8}
            style={{
              backgroundColor: colors.primary,
              borderRadius: radius.md,
              paddingVertical: 14,
              alignItems: "center",
              ...shadows.sm,
            }}
          >
            <Text style={{ color: colors.textInverse, fontWeight: typography.bold }}>
              {t("paywall.continue")}
            </Text>
          </TouchableOpacity>
        ) : null}

        {!isLoading && tier === "free" && !availabilityMessage ? (
          <>
            {offers.length === 0 ? (
              <Text style={{ color: colors.textSecondary }}>
                {t("paywall.noOffers")}
              </Text>
            ) : (
              offers.map((offer) => {
                const isBuying = activePurchaseId === offer.identifier;
                const isBestValue = offer.packageType === "ANNUAL";
                return (
                  <TouchableOpacity
                    key={offer.identifier}
                    onPress={() => void handlePurchase(offer)}
                    disabled={Boolean(activePurchaseId) || isRestoring}
                    activeOpacity={0.85}
                    style={{
                      backgroundColor: isBestValue ? colors.primaryLight ?? colors.surface : colors.surface,
                      borderRadius: radius.lg,
                      borderWidth: isBestValue ? 2 : 1,
                      borderColor: isBestValue ? colors.primary : colors.border,
                      padding: spacing.lg,
                      gap: spacing.xs,
                      ...shadows.sm,
                    }}
                  >
                    {isBestValue && (
                      <View style={{
                        backgroundColor: colors.primary,
                        borderRadius: radius.sm,
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        alignSelf: "flex-start",
                        marginBottom: spacing.xs,
                      }}>
                        <Text style={{ color: colors.textInverse, fontSize: typography.xs, fontWeight: typography.bold }}>
                          {t("paywall.bestValue")}
                        </Text>
                      </View>
                    )}
                    <Text style={{ color: colors.text, fontSize: typography.lg, fontWeight: typography.bold }}>
                      {offer.title}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: typography.sm }}>
                      {offer.description}
                    </Text>
                    <Text style={{ color: colors.primary, fontSize: typography.base, fontWeight: typography.bold }}>
                      {offer.priceString}
                    </Text>
                    {isBuying ? (
                      <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xs }} />
                    ) : null}
                  </TouchableOpacity>
                );
              })
            )}

            <TouchableOpacity
              onPress={() => void handleRestore()}
              disabled={Boolean(activePurchaseId) || isRestoring}
              activeOpacity={0.8}
              style={{
                backgroundColor: colors.surfaceSecondary,
                borderRadius: radius.md,
                paddingVertical: 12,
                alignItems: "center",
              }}
            >
              {isRestoring ? (
                <ActivityIndicator color={colors.textSecondary} />
              ) : (
                <Text style={{ color: colors.textSecondary, fontWeight: typography.medium }}>
                  {t("paywall.restoreButton")}
                </Text>
              )}
            </TouchableOpacity>
          </>
        ) : null}

        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.8}
          style={{
            paddingVertical: 12,
            alignItems: "center",
          }}
        >
          <Text style={{ color: colors.textSecondary }}>{t("paywall.backButton")}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

import { useState, useEffect, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ChevronRight, Zap, PlayCircle, Shield, ShoppingBag, TrendingUp, Star } from "lucide-react-native";
import { useColors, spacing, radius, typography, shadows } from "../src/theme";
import { useUsageStore } from "../src/store/usageStore";
import { useRewardedAd } from "../src/features/ads/useRewardedAd";
import { REAL_ADS_ENABLED } from "../src/features/ads/adsMode";
import { buyStreakFreeze, getLpBalance, getStats, grantLpPackPurchase, isApiError } from "../src/lib/api";
import {
  getRevenueCatAvailability,
  getRevenueCatOfferings,
  purchaseRevenueCatPackage,
  type RevenueCatOffer,
} from "../src/features/paywall/revenuecat";
import {
  LP_PACKS,
  mapLpPackOffersById,
  type LpPackDefinition,
} from "../src/features/paywall/lpPackOffers";
import { useSessionStore } from "../src/store/sessionStore";

// Display values for the streak-freeze tile. The server enforces the real
// price and cap (featureGates.STREAK_FREEZE); these only label the UI.
const FREEZE_COST_LP = 20;
const FREEZE_MAX_OWNED = 2;

export default function LpStoreScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const colors = useColors();
  const {
    lpBalance,
    lpEarnedToday,
    lpAdsToday,
    lpEarnCapToday,
    lpAdCapToday,
    tier,
    setUsage,
    isLoaded,
  } = useUsageStore();

  const userId = useSessionStore((s) => s.userId);
  const { state: adState, watchAd } = useRewardedAd();
  const [loading, setLoading] = useState(!isLoaded);
  const [adMessage, setAdMessage] = useState("");
  const [purchasingPackId, setPurchasingPackId] = useState<string | null>(null);
  const [lpPackOffersById, setLpPackOffersById] = useState<
    Record<string, RevenueCatOffer>
  >({});
  const [freezes, setFreezes] = useState(0);
  const [buyingFreeze, setBuyingFreeze] = useState(false);

  const loadBalance = useCallback(async () => {
    if (!userId) {
      setLpPackOffersById({});
      setLoading(false);
      return;
    }

    try {
      const res = await getLpBalance();
      setUsage({
        tier: res.tier,
        lpBalance: res.lpBalance,
        lpEarnedToday: res.lpEarnedToday,
        lpAdsToday: res.lpAdsToday,
        lpEarnCapToday: res.lpEarnCapToday,
        lpAdCapToday: res.lpAdCapToday,
        lpCostAiScan: res.lpCostAiScan,
        lpCostUrlImport: res.lpCostUrlImport,
        lpCostPdfImport: res.lpCostPdfImport,
        periodStart: res.periodStart,
      });
    } catch { /* best-effort */ } finally {
      try {
        const res = await getStats();
        setFreezes(res.stats.streakFreezes ?? 0);
      } catch { /* best-effort — tile just shows the last known count */ }
      try {
        const availability = await getRevenueCatAvailability();
        if (!availability.available) {
          setLpPackOffersById({});
        } else {
          const offerings = await getRevenueCatOfferings(userId);
          setLpPackOffersById(mapLpPackOffersById(offerings));
        }
      } catch {
        setLpPackOffersById({});
      }
      setLoading(false);
    }
  }, [setUsage, userId]);

  useEffect(() => {
    void loadBalance();
  }, [loadBalance]);

  const handleWatchAd = async () => {
    setAdMessage("");
    const result = await watchAd();
    if (!result) {
      setAdMessage(t("lp.adFailed"));
      return;
    }
    if (result.mock) {
      // Mock ad (real ads not live yet) — no LP, just an honest "coming soon".
      setAdMessage(t("lp.adMockNotActive"));
      setTimeout(() => setAdMessage(""), 4000);
      return;
    }
    if (result.pending) {
      // Real ad done; LP is credited via AdMob SSV shortly — refresh to reflect it.
      setAdMessage(t("lp.adRewardPending"));
      void loadBalance();
      setTimeout(() => setAdMessage(""), 4000);
      return;
    }
    if (result.capReached) {
      setAdMessage(t("lp.adCapReached"));
      return;
    }
    setAdMessage(t("lp.adRewarded", { count: result.granted }));
    setTimeout(() => setAdMessage(""), 3000);
  };

  const handleBuyPack = async (pack: LpPackDefinition) => {
    if (!userId || purchasingPackId) return;
    const storeOffer = lpPackOffersById[pack.id];
    if (!storeOffer) {
      Alert.alert(
        t("lp.purchaseUnavailableTitle"),
        t("lp.purchaseUnavailableBody")
      );
      return;
    }

    setPurchasingPackId(pack.id);
    try {
      const result = await purchaseRevenueCatPackage(userId, storeOffer.identifier);
      if (result.cancelled) {
        // User cancelled — silent
        return;
      }
      if (result.error) {
        Alert.alert(t("lp.purchaseError"), result.error);
        return;
      }
      // Purchase succeeded: grant LP via our API (transaction_id from RevenueCat)
      // RevenueCat also sends a webhook as backup, but we grant immediately here for UX
      const transactionId = `rc_${userId}_${pack.id}_${Date.now()}`;
      try {
        const grant = await grantLpPackPurchase(pack.id, transactionId);
        setUsage({ lpBalance: grant.newBalance });
        Alert.alert(
          t("lp.purchaseSuccess"),
          t("lp.purchaseSuccessBody", { lp: grant.lpGranted, balance: grant.newBalance })
        );
      } catch {
        // Webhook will handle it as fallback
        Alert.alert(t("lp.purchaseSuccessWebhook", { lp: pack.lp }));
        void loadBalance();
      }
    } catch (err) {
      Alert.alert(t("lp.purchaseError"), err instanceof Error ? err.message : t("lp.purchaseErrorGeneric"));
    } finally {
      setPurchasingPackId(null);
    }
  };

  const handleBuyFreeze = () => {
    if (buyingFreeze) return;
    Alert.alert(
      t("lp.freezeConfirmTitle"),
      t("lp.freezeConfirmBody", { cost: FREEZE_COST_LP }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("lp.purchaseConfirm"),
          onPress: () => { void confirmBuyFreeze(); },
        },
      ]
    );
  };

  const confirmBuyFreeze = async () => {
    setBuyingFreeze(true);
    try {
      const res = await buyStreakFreeze();
      setUsage({ lpBalance: res.newBalance });
      setFreezes(res.streakFreezes);
      Alert.alert(t("lp.freezeBoughtTitle"), t("lp.freezeBought", { count: res.streakFreezes }));
    } catch (err) {
      // The server is the source of truth for price and cap; translate its
      // rejection codes instead of trusting local state.
      const message = isApiError(err) && err.code === "MAX_FREEZES"
        ? t("lp.freezeErrorMax")
        : isApiError(err) && err.code === "INSUFFICIENT_LP"
          ? t("lp.freezeErrorLp")
          : t("lp.freezeErrorGeneric");
      Alert.alert(t("lp.freezeTitle"), message);
      void loadBalance();
    } finally {
      setBuyingFreeze(false);
    }
  };

  const adBusy = adState === "loading" || adState === "showing";
  const anyPurchasing = purchasingPackId !== null;
  const adCapped = tier === "free" && lpAdsToday >= lpAdCapToday;
  const freezeMaxed = freezes >= FREEZE_MAX_OWNED;
  const freezeTooExpensive = lpBalance < FREEZE_COST_LP;
  const earnProgress = lpEarnCapToday > 0 ? Math.min(lpEarnedToday / lpEarnCapToday, 1) : 0;
  const adProgress = lpAdCapToday > 0 ? Math.min(lpAdsToday / lpAdCapToday, 1) : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>

        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
            <ArrowLeft size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={{ fontSize: typography.xxl, fontWeight: typography.bold, color: colors.text }}>
            {t("lp.storeTitle")}
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Balance card */}
            <View
              style={{
                backgroundColor: colors.warning,
                borderRadius: radius.xl,
                padding: spacing.xl,
                alignItems: "center",
                gap: spacing.sm,
                ...shadows.md,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <Zap size={32} color={colors.textInverse} />
                <Text style={{ fontSize: 48, fontWeight: typography.extrabold, color: colors.textInverse }}>
                  {lpBalance.toLocaleString("de-DE")}
                </Text>
              </View>
              <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: typography.base }}>
                {t("lp.availableBalance")}
              </Text>
            </View>

            {/* Daily earn progress */}
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: radius.lg,
                padding: spacing.lg,
                gap: spacing.md,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <TrendingUp size={18} color={colors.success} />
                <Text style={{ fontSize: typography.base, fontWeight: typography.semibold, color: colors.text }}>
                  {t("lp.dailyEarnTitle")}
                </Text>
              </View>

              {/* Earn progress bar */}
              <View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                  <Text style={{ fontSize: typography.sm, color: colors.textSecondary }}>
                    {t("lp.earnByLearning")}
                  </Text>
                  <Text style={{ fontSize: typography.sm, fontWeight: typography.semibold, color: colors.text }}>
                    {lpEarnedToday} / {lpEarnCapToday} LP
                  </Text>
                </View>
                <View style={{ height: 8, backgroundColor: colors.surfaceSecondary, borderRadius: 4 }}>
                  <View
                    style={{
                      height: 8,
                      width: `${earnProgress * 100}%`,
                      backgroundColor: colors.success,
                      borderRadius: 4,
                    }}
                  />
                </View>
              </View>

              {/* Ad progress bar (free only) */}
              {tier === "free" && (
                <View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                    <Text style={{ fontSize: typography.sm, color: colors.textSecondary }}>
                      {t("lp.earnByAds")}
                    </Text>
                    <Text style={{ fontSize: typography.sm, fontWeight: typography.semibold, color: colors.text }}>
                      {lpAdsToday} / {lpAdCapToday} LP
                    </Text>
                  </View>
                  <View style={{ height: 8, backgroundColor: colors.surfaceSecondary, borderRadius: 4 }}>
                    <View
                      style={{
                        height: 8,
                        width: `${adProgress * 100}%`,
                        backgroundColor: colors.warning,
                        borderRadius: 4,
                      }}
                    />
                  </View>
                </View>
              )}
            </View>

            {/* Rewarded ad (free only) */}
            {tier === "free" && (
              <View style={{ gap: spacing.sm }}>
                <Text style={{ fontSize: typography.sm, color: colors.textSecondary, fontWeight: typography.medium }}>
                  {t("lp.freeEarnSection")}
                </Text>
                <TouchableOpacity
                  onPress={handleWatchAd}
                  disabled={adBusy || adCapped}
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: adCapped ? colors.textTertiary : adBusy ? colors.surfaceSecondary : colors.warning,
                    borderRadius: radius.lg,
                    padding: spacing.lg,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.md,
                    ...shadows.sm,
                  }}
                >
                  {adBusy ? (
                    <ActivityIndicator color={colors.text} />
                  ) : (
                    <PlayCircle size={24} color={adCapped ? colors.textSecondary : colors.textInverse} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{
                      color: adCapped ? colors.textSecondary : adBusy ? colors.text : colors.textInverse,
                      fontSize: typography.base,
                      fontWeight: typography.bold,
                    }}>
                      {adCapped ? t("lp.adCapReachedShort") : adState === "showing" ? t("lp.adWatching") : REAL_ADS_ENABLED ? t("lp.watchAdFull") : t("lp.watchAdMockFull")}
                    </Text>
                    <Text style={{
                      color: adCapped ? colors.textTertiary : adBusy ? colors.textSecondary : "rgba(255,255,255,0.75)",
                      fontSize: typography.sm,
                      marginTop: 2,
                    }}>
                      {adCapped
                        ? t("lp.adCapReachedDetail", { cap: lpAdCapToday })
                        : REAL_ADS_ENABLED
                          ? t("lp.watchAdSubtitle", { count: 5 })
                          : t("lp.watchAdMockSubtitle")}
                    </Text>
                  </View>
                  {!adCapped && !adBusy && REAL_ADS_ENABLED && (
                    <View style={{ backgroundColor: "rgba(255,255,255,0.25)", borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 3 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                        <Zap size={12} color={colors.textInverse} />
                        <Text style={{ color: colors.textInverse, fontSize: typography.xs, fontWeight: typography.bold }}>+5</Text>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
                {adMessage ? (
                  <Text style={{ textAlign: "center", color: colors.success, fontSize: typography.sm, fontWeight: typography.medium }}>
                    {adMessage}
                  </Text>
                ) : null}
              </View>
            )}

            {/* Shop: streak freeze — bought with LP, consumed automatically (#237) */}
            <View style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <ShoppingBag size={18} color={colors.primary} />
                <Text style={{ fontSize: typography.base, fontWeight: typography.semibold, color: colors.text }}>
                  {t("lp.shopSection")}
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleBuyFreeze}
                disabled={freezeMaxed || freezeTooExpensive || buyingFreeze}
                activeOpacity={0.8}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: radius.lg,
                  padding: spacing.lg,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  opacity: freezeMaxed || freezeTooExpensive ? 0.68 : 1,
                  ...shadows.sm,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: radius.md,
                    backgroundColor: colors.warningLight,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Shield size={22} color={colors.warning} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: typography.lg, fontWeight: typography.bold, color: colors.text }}>
                    {t("lp.freezeTitle")}
                  </Text>
                  <Text style={{ fontSize: typography.sm, color: colors.textSecondary, marginTop: 2 }}>
                    {t("lp.freezeSubtitle")}
                  </Text>
                  <Text style={{ fontSize: typography.xs, color: colors.textTertiary, marginTop: 2 }}>
                    {t("lp.freezeOwned", { count: freezes, max: FREEZE_MAX_OWNED })}
                  </Text>
                </View>
                {buyingFreeze ? (
                  <ActivityIndicator color={colors.primary} />
                ) : freezeMaxed ? (
                  <Text style={{ fontSize: typography.sm, fontWeight: typography.semibold, color: colors.textSecondary }}>
                    {t("lp.freezeMaxOwned")}
                  </Text>
                ) : freezeTooExpensive ? (
                  <Text style={{ fontSize: typography.sm, fontWeight: typography.semibold, color: colors.textSecondary }}>
                    {t("lp.freezeNotEnoughLp")}
                  </Text>
                ) : (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                    <Zap size={14} color={colors.warning} />
                    <Text style={{ fontSize: typography.lg, fontWeight: typography.bold, color: colors.primary }}>
                      {FREEZE_COST_LP} LP
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* LP Packs */}
            <View style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <ShoppingBag size={18} color={colors.primary} />
                <Text style={{ fontSize: typography.base, fontWeight: typography.semibold, color: colors.text }}>
                  {t("lp.packSection")}
                </Text>
              </View>

              {LP_PACKS.map((pack) => {
                const storeOffer = lpPackOffersById[pack.id];
                const isPurchasable = Boolean(storeOffer);
                const isHighlighted = pack.popular && isPurchasable;

                return (
                  <TouchableOpacity
                    key={pack.id}
                    onPress={() => { void handleBuyPack(pack); }}
                    disabled={anyPurchasing}
                    activeOpacity={isPurchasable ? 0.8 : 1}
                    style={{
                      backgroundColor: isHighlighted ? colors.primary : colors.surface,
                      borderRadius: radius.lg,
                      padding: spacing.lg,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.md,
                      borderWidth: isHighlighted ? 0 : 1,
                      borderColor: colors.border,
                      opacity: !isPurchasable ? 0.68 : anyPurchasing && purchasingPackId !== pack.id ? 0.5 : 1,
                      ...shadows.sm,
                    }}
                  >
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: radius.md,
                        backgroundColor: isHighlighted ? "rgba(255,255,255,0.2)" : colors.warningLight,
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      <Zap size={22} color={isHighlighted ? colors.textInverse : colors.warning} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                        <Text style={{
                          fontSize: typography.lg,
                          fontWeight: typography.bold,
                          color: isHighlighted ? colors.textInverse : colors.text,
                        }}>
                          {pack.lp.toLocaleString("de-DE")} LP
                        </Text>
                        {pack.popular && isPurchasable && (
                          <View style={{ backgroundColor: colors.warning, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 }}>
                            <Text style={{ fontSize: typography.xs, color: colors.textInverse, fontWeight: typography.bold }}>
                              {t("lp.bestValue")}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={{
                        fontSize: typography.sm,
                        color: isHighlighted ? "rgba(255,255,255,0.75)" : colors.textSecondary,
                        marginTop: 2,
                      }}>
                        {isPurchasable
                          ? pack.popular
                            ? t("lp.packPopularHint", { scans: Math.floor(pack.lp / 10) })
                            : t("lp.packHint", { scans: Math.floor(pack.lp / 10) })
                          : t("lp.packUnavailableHint")}
                      </Text>
                    </View>
                    {purchasingPackId === pack.id ? (
                      <ActivityIndicator color={isHighlighted ? colors.textInverse : colors.primary} />
                    ) : (
                      <Text style={{
                        fontSize: typography.lg,
                        fontWeight: typography.bold,
                        color: isHighlighted ? colors.textInverse : colors.primary,
                      }}>
                        {storeOffer?.priceString ?? t("lp.purchaseUnavailableShort")}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Pro upgrade teaser */}
            {tier === "free" && (
              <TouchableOpacity
                onPress={() => router.push("/paywall")}
                activeOpacity={0.8}
                style={{
                  backgroundColor: colors.surfaceSecondary,
                  borderRadius: radius.lg,
                  padding: spacing.lg,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Star size={22} color={colors.warning} fill={colors.warning} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: typography.base, fontWeight: typography.bold, color: colors.text }}>
                    {t("lp.proTeaser")}
                  </Text>
                  <Text style={{ fontSize: typography.sm, color: colors.textSecondary, marginTop: 2 }}>
                    {t("lp.proTeaserSubtitle")}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                  <Text style={{ fontSize: typography.sm, color: colors.primary, fontWeight: typography.semibold }}>
                    {t("paywall.openCta")}
                  </Text>
                  <ChevronRight size={16} color={colors.primary} />
                </View>
              </TouchableOpacity>
            )}

          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

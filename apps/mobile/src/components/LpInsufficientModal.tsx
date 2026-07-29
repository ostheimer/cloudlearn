import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Zap, PlayCircle, ShoppingBag, X, BookOpen } from "lucide-react-native";
import { useColors, spacing, radius, typography, shadows } from "../theme";
import { useRewardedAd } from "../features/ads/useRewardedAd";
import { resolveRewardedAdOutcome } from "../features/ads/resolveRewardedAdOutcome";
import { lpInsufficientOptions } from "../features/paywall/proDisplay";
import { useUsageStore } from "../store/usageStore";

interface LpInsufficientModalProps {
  visible: boolean;
  cost: number;
  balance: number;
  feature: "aiScan" | "urlImport" | "pdfImport";
  onClose: () => void;
  onAdRewarded?: (newBalance: number) => void;
}

export function LpInsufficientModal({
  visible,
  cost,
  balance,
  onClose,
  onAdRewarded,
}: LpInsufficientModalProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();
  const { state: adState, watchAd } = useRewardedAd();
  const [adMessage, setAdMessage] = useState("");
  // Pro/Lifetime: Werbe-Kappe ist 0 (würde nie buchen) und ein Upgrade gibt
  // es nicht — beide Auswege nur für Free-Konten zeigen (#607).
  const tier = useUsageStore((state) => state.tier);
  const { showWatchAd, showUpgrade } = lpInsufficientOptions(tier);

  const handleWatchAd = async () => {
    setAdMessage("");
    const outcome = resolveRewardedAdOutcome(await watchAd());

    // Only a real credit touches the balance and closes the sheet. Mock/pending/
    // cap/failed just show an honest message — no fake "+0 LP", no balance reset
    // to 0 (#285).
    if (outcome.kind === "granted") {
      setAdMessage(t(outcome.messageKey, { count: outcome.count }));
      onAdRewarded?.(outcome.newBalance);
      setTimeout(() => {
        setAdMessage("");
        onClose();
      }, 1200);
      return;
    }

    setAdMessage(t(outcome.messageKey));
    // Auto-clear the transient "coming soon" / "being verified" notes.
    if (outcome.kind === "mock" || outcome.kind === "pending") {
      setTimeout(() => setAdMessage(""), 4000);
    }
  };

  const isAdBusy = adState === "loading" || adState === "showing";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0,0,0,0.55)",
        }}
      >
        <View
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            padding: spacing.xl,
            gap: spacing.lg,
            ...shadows.xl,
          }}
        >
          {/* Header */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Zap size={22} color={colors.warning} />
              <Text style={{ fontSize: typography.xl, fontWeight: typography.bold, color: colors.text }}>
                {t("lp.insufficientTitle")}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}>
              <X size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>

          {/* Balance info */}
          <View
            style={{
              backgroundColor: colors.errorLight,
              borderRadius: radius.md,
              padding: spacing.md,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.error, fontSize: typography.base }}>
              {t("lp.insufficientDetail", { cost, balance })}
            </Text>
          </View>

          {/* Erste Option (#609, Laras Entscheidung): der Gratis-Weg zuerst.
              Führt in die globale fällige Runde — Lernen bringt 1 LP je Karte. */}
          <TouchableOpacity
            onPress={() => {
              onClose();
              router.push("/(tabs)/learn");
            }}
            activeOpacity={0.8}
            style={{
              backgroundColor: colors.primary,
              borderRadius: radius.lg,
              padding: spacing.lg,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              ...shadows.sm,
            }}
          >
            <BookOpen size={24} color={colors.textInverse} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textInverse, fontSize: typography.base, fontWeight: typography.bold }}>
                {t("lp.learnNow")}
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: typography.sm, marginTop: 2 }}>
                {t("lp.learnNowSubtitle")}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Option 2: Watch ad — nur Free (#607) */}
          {showWatchAd ? (
            <TouchableOpacity
              onPress={handleWatchAd}
              disabled={isAdBusy}
              activeOpacity={0.8}
              style={{
                backgroundColor: isAdBusy ? colors.textTertiary : colors.warning,
                borderRadius: radius.lg,
                padding: spacing.lg,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                ...shadows.sm,
              }}
            >
              {isAdBusy ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <PlayCircle size={24} color={colors.textInverse} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textInverse, fontSize: typography.base, fontWeight: typography.bold }}>
                  {adState === "showing" ? t("lp.adWatching") : t("lp.watchAd")}
                </Text>
                <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: typography.sm, marginTop: 2 }}>
                  {t("lp.watchAdSubtitle", { count: 5 })}
                </Text>
              </View>
              <View
                style={{
                  backgroundColor: "rgba(255,255,255,0.25)",
                  borderRadius: radius.sm,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 3,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                  <Zap size={12} color={colors.textInverse} />
                  <Text style={{ color: colors.textInverse, fontSize: typography.xs, fontWeight: typography.bold }}>
                    +5
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ) : null}

          {showWatchAd && adMessage ? (
            <Text style={{ textAlign: "center", color: colors.textSecondary, fontSize: typography.sm }}>
              {adMessage}
            </Text>
          ) : null}

          {/* Option 3: Buy LP pack */}
          <TouchableOpacity
            onPress={() => { onClose(); router.push("/lp-store"); }}
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
            <ShoppingBag size={22} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: typography.base, fontWeight: typography.semibold }}>
                {t("lp.buyPack")}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: typography.sm, marginTop: 2 }}>
                {t("lp.buyPackSubtitle")}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Option 4: Upgrade to Pro — nur Free (#607) */}
          {showUpgrade ? (
            <TouchableOpacity
              onPress={() => { onClose(); router.push("/paywall"); }}
              activeOpacity={0.8}
            >
              <Text style={{ textAlign: "center", color: colors.primary, fontSize: typography.sm, fontWeight: typography.medium }}>
                {t("lp.upgradePro")}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

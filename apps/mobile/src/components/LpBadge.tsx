import { useEffect } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Zap } from "lucide-react-native";
import { useUsageStore } from "../store/usageStore";
import { useSessionStore } from "../store/sessionStore";
import { getLpBalance } from "../lib/api";
import { useColors, spacing, radius, typography } from "../theme";
import { useTranslation } from "react-i18next";

interface LpBadgeProps {
  onPress?: () => void;
}

export function LpBadge({ onPress }: LpBadgeProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const { lpBalance, lpCostAiScan, isLoaded, setUsage } = useUsageStore();

  const isLow = lpBalance < lpCostAiScan;
  const accent = isLow ? colors.error : colors.warning;
  const accentBg = isLow ? colors.errorLight : colors.warningLight;

  // Load LP balance on first mount
  useEffect(() => {
    if (!isAuthenticated || isLoaded) return;
    getLpBalance()
      .then((res) => {
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
      })
      .catch(() => { /* best-effort */ });
  }, [isAuthenticated, isLoaded, setUsage]);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={t("lp.balance", { count: lpBalance })}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        backgroundColor: accentBg ?? colors.surfaceSecondary,
        borderRadius: radius.full ?? 999,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: accent ?? colors.border,
      }}
    >
      <Zap size={14} color={accent ?? colors.text} />
      <Text
        style={{
          fontSize: typography.sm,
          fontWeight: typography.semibold,
          color: accent ?? colors.text,
        }}
      >
        {lpBalance.toLocaleString("de-DE")} LP
      </Text>
    </TouchableOpacity>
  );
}

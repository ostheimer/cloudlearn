import { useEffect, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Zap } from "lucide-react-native";
import { usageFromBalanceResponse, useUsageStore } from "../store/usageStore";
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
  // Fehlversuche zählen nur, um den Wiederholungs-Effekt erneut auszulösen —
  // ohne diesen Anstoß bliebe die Pille nach einem Netzfehler für immer im
  // Ladezustand (isLoaded bleibt false, die Abhängigkeiten ändern sich nie).
  const [retry, setRetry] = useState(0);

  // Solange nichts geladen ist, gibt es keinen Kontostand — nur den
  // Startwert des Stores (#612). Der wurde vorher als echte Zahl angezeigt:
  // offline oder bei Serverfehler behauptete die Pille dauerhaft „10 LP", und
  // weil 10 genau dem Scan-Preis entspricht, sah sogar noch alles machbar aus.
  // Jetzt sagt sie ehrlich „–", bis eine echte Zahl da ist.
  const isLow = isLoaded && lpBalance < lpCostAiScan;
  const accent = isLow ? colors.error : isLoaded ? colors.warning : colors.textSecondary;
  const accentBg = isLow ? colors.errorLight : isLoaded ? colors.warningLight : colors.surfaceSecondary;

  // Load LP balance on first mount. Über den gemeinsamen Übersetzer, damit
  // auch die Tarif-Grenzen ankommen (#603) — diese Stelle lud sie früher nicht
  // mit und der Scan-Tab hielt den Store trotzdem für fertig geladen.
  useEffect(() => {
    if (!isAuthenticated || isLoaded) return;
    getLpBalance()
      .then((res) => setUsage(usageFromBalanceResponse(res)))
      .catch(() => { /* best-effort — Antippen versucht es erneut */ });
  }, [isAuthenticated, isLoaded, setUsage, retry]);

  return (
    <TouchableOpacity
      onPress={() => {
        // Antippen ist zugleich der Wiederholungsknopf: Wer die Pille im
        // Ladezustand antippt, will die Zahl sehen.
        if (!isLoaded) setRetry((n) => n + 1);
        onPress?.();
      }}
      activeOpacity={0.7}
      accessibilityLabel={isLoaded ? t("lp.balance", { count: lpBalance }) : t("lp.balanceLoading")}
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
        {isLoaded ? `${lpBalance.toLocaleString("de-DE")} LP` : "– LP"}
      </Text>
    </TouchableOpacity>
  );
}

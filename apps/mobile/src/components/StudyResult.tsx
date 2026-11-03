import type { TFunction } from "i18next";
import type { ReactNode } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Trophy, RotateCcw } from "lucide-react-native";
import { useColors, spacing, radius, typography } from "../theme";

// Shared frame for every study-mode result: the trophy and its ring are
// always green (Stil A, Lara #595 Teil C / #699), including Prüfung. Scores,
// feedback and mode-specific metrics belong in the text, never in icon color.
// accessory holds the status/LP summary, children the optional round review;
// actions remain after the review so the original reading order is preserved.
export type StudyResultAction = {
  label: string;
  onPress: () => void;
  variant: "primary" | "secondary" | "ghost";
  reload?: boolean;
};

export function StudyResult({
  headline,
  subtitle,
  accessory,
  actions,
  children,
}: {
  headline: string;
  subtitle?: string | undefined;
  accessory?: ReactNode;
  actions: StudyResultAction[];
  children?: ReactNode;
}) {
  const c = useColors();
  return (
    <View style={{ flex: 1, width: "100%", justifyContent: "center", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg }}>
      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: c.successLight, justifyContent: "center", alignItems: "center" }}>
        <Trophy size={34} color={c.success} />
      </View>
      <Text style={{ fontSize: typography.xxxl, fontWeight: typography.extrabold, textAlign: "center", color: c.text }}>
        {headline}
      </Text>
      {subtitle ? (
        <Text style={{ color: c.textSecondary, textAlign: "center", fontSize: typography.base }}>{subtitle}</Text>
      ) : null}
      {accessory}
      {children}
      <View style={{ width: "100%", maxWidth: 340, gap: spacing.sm, marginTop: spacing.sm }}>
        {actions.map((a, i) => {
          if (a.variant === "ghost") {
            return (
              <TouchableOpacity key={i} accessibilityRole="button" accessibilityLabel={a.label} onPress={a.onPress} activeOpacity={0.85} style={{ paddingVertical: 12, alignItems: "center" }}>
                <Text style={{ color: c.textSecondary, fontWeight: typography.semibold, fontSize: typography.base }}>{a.label}</Text>
              </TouchableOpacity>
            );
          }
          const primary = a.variant === "primary";
          return (
            <TouchableOpacity
              key={i}
              accessibilityRole="button"
              accessibilityLabel={a.label}
              onPress={a.onPress}
              activeOpacity={0.85}
              style={{
                backgroundColor: primary ? c.primary : c.surface,
                borderWidth: primary ? 0 : 1,
                borderColor: c.border,
                borderRadius: radius.md,
                paddingVertical: 14,
                flexDirection: "row",
                gap: spacing.sm,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {a.reload && <RotateCcw size={18} color={primary ? "#fff" : c.text} />}
              <Text style={{ color: primary ? "#fff" : c.text, fontWeight: typography.bold, fontSize: typography.base }}>
                {a.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

/** Same repeat hierarchy for all result screens; each mode owns its restart. */
export function repeatResultActions({
  t, missedCount, minimumMissed = 1, retryMissed, retryAll, settings, practiceMissed,
}: {
  t: TFunction;
  missedCount: number;
  minimumMissed?: number;
  retryMissed: () => void;
  retryAll: () => void;
  settings: () => void;
  practiceMissed?: () => void;
}): StudyResultAction[] {
  const hasMisses = missedCount >= minimumMissed;
  return [
    ...(hasMisses ? [{ label: t("review.onlyWrong", { count: missedCount }), onPress: retryMissed, variant: "primary" as const }] : []),
    ...(practiceMissed && missedCount > 0 ? [{ label: t("review.practiceMissed", { count: missedCount }), onPress: practiceMissed, variant: "secondary" as const }] : []),
    { label: t("review.againAll"), onPress: retryAll, variant: hasMisses ? "secondary" : "primary", reload: true },
    { label: t("study.settings"), onPress: settings, variant: "ghost" },
  ];
}

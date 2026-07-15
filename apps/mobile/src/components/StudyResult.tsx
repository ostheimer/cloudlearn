import type { ReactNode } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Trophy, RotateCcw } from "lucide-react-native";
import { useColors, spacing, radius, typography } from "../theme";

// Shared result screen for the "learning" study modes (Karteikarten, Üben,
// Lücken, Zuordnen, Occlusion, Quiz). One frame, so every mode's end screen
// looks the same: a green trophy (a finished round is never a fail — the
// red/yellow/green grade belongs to the Test), a big "X von Y" headline, an
// optional subtitle, an optional accessory (LP pill, stars), and a stack of
// actions. Only the numbers and the middle change per mode.
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
}: {
  headline: string;
  subtitle?: string | undefined;
  accessory?: ReactNode;
  actions: StudyResultAction[];
}) {
  const c = useColors();
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg }}>
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
      <View style={{ width: "100%", maxWidth: 340, gap: spacing.sm, marginTop: spacing.sm }}>
        {actions.map((a, i) => {
          if (a.variant === "ghost") {
            return (
              <TouchableOpacity key={i} onPress={a.onPress} activeOpacity={0.85} style={{ paddingVertical: 12, alignItems: "center" }}>
                <Text style={{ color: c.textSecondary, fontWeight: typography.semibold, fontSize: typography.base }}>{a.label}</Text>
              </TouchableOpacity>
            );
          }
          const primary = a.variant === "primary";
          return (
            <TouchableOpacity
              key={i}
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

import type { ReactNode } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Trophy, RotateCcw } from "lucide-react-native";
import { useColors, spacing, radius, typography } from "../theme";

// Shared result screen for the modes that use this component (Karteikarten/
// Üben via practice.tsx, Lücken via cloze.tsx, Occlusion). Zuordnen
// (match.tsx) and Quiz (quiz.tsx) render their own matching result screen
// inline instead of through this component (see #699). One frame, so every
// mode's end screen looks the same: a green trophy — Stil A, Lara #595 Teil C
// / reaffirmed #699: the trophy is always green, everywhere, including the
// Prüfung; a grade, where one exists, is carried by the percentage text,
// never by icon or ring color — a big headline („Runde geschafft, {Name}!"
// in den Lern-Modi, „80%" in den Mess-Modi — Laras Aufteilung aus #571 Teil
// A), an optional subtitle, an optional accessory (LP pill, status line),
// and a stack of actions.
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

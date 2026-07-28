import { useMemo } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Minus, Plus } from "lucide-react-native";
import { useColors, spacing, radius, typography, shadows } from "../theme";

// Anzahl-Auswahl für Frage-Runden (Prüfung + Multiple Choice): Vorschlags-Chips
// plus „Alle" und eine Minus/Plus-Feinauswahl. Wortlaut und Verhalten müssen
// mit der Web-Fassung (apps/web/src/components/app/question-count-picker.tsx)
// übereinstimmen (#570). `count >= max` bedeutet „Alle".
export function QuestionCountPicker({
  count,
  max,
  onChange,
}: {
  count: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const colors = useColors();
  const { t } = useTranslation();

  // Preset sizes below the full pool; the "Alle" chip always covers the max, so
  // we never render a numeric chip equal to max (it would duplicate "Alle").
  // On a small pool these all drop out and only "Alle (N)" remains.
  const presets = useMemo(
    () => [10, 20, 30, 50, 75, 100].filter((n) => n < max),
    [max]
  );

  // A tappable pill for the question count. The active pill is filled with the
  // brand colour + inverse text (like the Start button), the rest are muted.
  const chip = (
    key: string | number,
    label: string,
    active: boolean,
    onPress: () => void
  ) => (
    <TouchableOpacity
      key={key}
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
        borderRadius: radius.full,
        backgroundColor: active ? colors.primary : colors.surfaceSecondary,
      }}
    >
      <Text
        style={{
          fontSize: typography.base,
          fontWeight: typography.semibold,
          color: active ? colors.textInverse : colors.text,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
        ...shadows.sm,
      }}
    >
      <Text
        style={{
          fontSize: typography.sm,
          color: colors.textSecondary,
          marginBottom: spacing.md,
        }}
      >
        {t("countPicker.label", { defaultValue: "Anzahl Fragen" })}
      </Text>

      {/* Preset-Chips */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        {presets.map((value) =>
          chip(value, String(value), count === value, () => onChange(value))
        )}
        {chip(
          "all",
          t("countPicker.allWithMax", { defaultValue: "Alle ({{max}})", max }),
          count >= max,
          () => onChange(max)
        )}
      </View>

      {/* Feinauswahl: −  [Anzahl]  + */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: spacing.lg,
        }}
      >
        <TouchableOpacity
          onPress={() => onChange(Math.max(1, count - 1))}
          disabled={count <= 1}
          activeOpacity={0.7}
          style={{
            width: 48,
            height: 48,
            borderRadius: radius.full,
            backgroundColor: colors.surfaceSecondary,
            justifyContent: "center",
            alignItems: "center",
            opacity: count <= 1 ? 0.4 : 1,
          }}
        >
          <Minus size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ alignItems: "center" }}>
          <Text
            style={{
              fontSize: typography.xl,
              fontWeight: typography.bold,
              color: colors.primary,
            }}
          >
            {count >= max ? t("countPicker.all", { defaultValue: "Alle" }) : count}
          </Text>
          <Text style={{ fontSize: typography.xs, color: colors.textTertiary, marginTop: 2 }}>
            {t("countPicker.of", { defaultValue: "von {{max}}", max })}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => onChange(Math.min(max, count + 1))}
          disabled={count >= max}
          activeOpacity={0.7}
          style={{
            width: 48,
            height: 48,
            borderRadius: radius.full,
            backgroundColor: colors.surfaceSecondary,
            justifyContent: "center",
            alignItems: "center",
            opacity: count >= max ? 0.4 : 1,
          }}
        >
          <Plus size={22} color={colors.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Minus, Plus, Target } from "lucide-react-native";
import { setDailyGoal } from "../src/lib/profileApi";
import { useColors, spacing, radius, typography, shadows } from "../src/theme";

const MIN_GOAL = 1;
const MAX_GOAL = 500;
const DEFAULT_GOAL = 30;
const PRESETS = [10, 20, 30, 50, 100];

const clampGoal = (n: number) =>
  Math.min(MAX_GOAL, Math.max(MIN_GOAL, Math.round(n)));

// Tagesziel einstellen: wie viele Karten pro Tag. Chips für die üblichen Werte
// + ein "− [Zahl] +"-Stepper für die Feinauswahl (Muster wie test.tsx). Der
// aktuelle Wert kommt als ?current= vom Home-Screen; der Server begrenzt final.
export default function DailyGoalScreen() {
  const colors = useColors();
  const router = useRouter();
  const { current } = useLocalSearchParams<{ current?: string }>();

  const initial = (() => {
    const parsed = current ? parseInt(current, 10) : NaN;
    return Number.isNaN(parsed) ? DEFAULT_GOAL : clampGoal(parsed);
  })();

  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);

  const cardStyle = {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  } as const;

  const save = async () => {
    setSaving(true);
    try {
      await setDailyGoal(value);
      router.back();
    } catch {
      Alert.alert(
        "Tagesziel",
        "Speichern fehlgeschlagen. Versuch es später noch einmal."
      );
    } finally {
      setSaving(false);
    }
  };

  // A tappable pill for a preset goal. The active pill is filled with the brand
  // colour + inverse text (like the Speichern button), the rest are muted.
  const presetChip = (goal: number) => {
    const active = value === goal;
    return (
      <TouchableOpacity
        key={goal}
        onPress={() => setValue(goal)}
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
          {goal}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Tagesziel",
          headerBackTitle: "Zurück",
          headerTintColor: colors.primary,
          headerStyle: { backgroundColor: colors.background },
        }}
      />
      <SafeAreaView edges={["bottom"]} style={{ flex: 1, backgroundColor: colors.background }}>
        <ScrollView
          contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
          showsVerticalScrollIndicator={false}
        >
          {/* Intro */}
          <View style={{ alignItems: "center", gap: spacing.sm, marginTop: spacing.sm }}>
            <View
              style={{
                width: 60,
                height: 60,
                borderRadius: 16,
                backgroundColor: colors.primaryLight,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Target size={30} color={colors.primary} />
            </View>
            <Text style={{ fontSize: typography.xl, fontWeight: typography.bold, color: colors.text }}>
              Tagesziel
            </Text>
            <Text
              style={{
                fontSize: typography.sm,
                color: colors.textSecondary,
                textAlign: "center",
                lineHeight: 20,
              }}
            >
              Wie viele Karten möchtest du pro Tag lernen?
            </Text>
          </View>

          {/* Ziel wählen — Presets zum Antippen + Feinauswahl per Stepper */}
          <View style={cardStyle}>
            <Text style={{ fontSize: typography.sm, color: colors.textSecondary, marginBottom: spacing.md }}>
              Karten pro Tag
            </Text>

            {/* Preset-Chips */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              {PRESETS.map(presetChip)}
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
                onPress={() => setValue((v) => clampGoal(v - 1))}
                disabled={value <= MIN_GOAL}
                activeOpacity={0.7}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: radius.full,
                  backgroundColor: colors.surfaceSecondary,
                  justifyContent: "center",
                  alignItems: "center",
                  opacity: value <= MIN_GOAL ? 0.4 : 1,
                }}
              >
                <Minus size={22} color={colors.text} />
              </TouchableOpacity>
              <View style={{ alignItems: "center" }}>
                <Text style={{ fontSize: typography.xxxl, fontWeight: typography.bold, color: colors.primary }}>
                  {value}
                </Text>
                <Text style={{ fontSize: typography.xs, color: colors.textTertiary, marginTop: 2 }}>
                  Karten pro Tag
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setValue((v) => clampGoal(v + 1))}
                disabled={value >= MAX_GOAL}
                activeOpacity={0.7}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: radius.full,
                  backgroundColor: colors.surfaceSecondary,
                  justifyContent: "center",
                  alignItems: "center",
                  opacity: value >= MAX_GOAL ? 0.4 : 1,
                }}
              >
                <Plus size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Speichern */}
          <TouchableOpacity
            onPress={save}
            disabled={saving}
            activeOpacity={0.85}
            style={{
              backgroundColor: colors.primary,
              paddingVertical: 16,
              borderRadius: radius.lg,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: spacing.sm,
              opacity: saving ? 0.7 : 1,
              ...shadows.md,
            }}
          >
            {saving && <ActivityIndicator size="small" color={colors.textInverse} />}
            <Text style={{ color: colors.textInverse, fontWeight: typography.bold, fontSize: typography.lg }}>
              {saving ? "Speichern…" : "Speichern"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

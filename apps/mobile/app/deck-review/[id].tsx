import { useState } from "react";
import { useLocalSearchParams, Stack } from "expo-router";
import { ScrollView, Switch, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowRight, Layers } from "lucide-react-native";
import LearnScreen from "../(tabs)/learn";
import { useColors, spacing, radius, typography, shadows } from "../../src/theme";

// Full-screen "Karteikarten" session for a single deck. Opens with a setup
// screen (direction + Starten) like the other study modes, then reuses the
// review UI from the (parked) learn tab, scoped to one deck via its id.
export default function DeckReviewScreen() {
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  const colors = useColors();

  const [phase, setPhase] = useState<"setup" | "play">("setup");
  const [reverse, setReverse] = useState(false);
  const [starredOnly, setStarredOnly] = useState(false);

  if (phase === "play") {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <LearnScreen
          deckId={id}
          deckTitle={title}
          initialShowBackFirst={reverse}
          starredOnly={starredOnly}
        />
      </>
    );
  }

  const setupCardStyle = {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  } as const;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: title ?? "Karteikarten",
          headerBackTitle: "Zurück",
          headerTintColor: colors.primary,
          headerStyle: { backgroundColor: colors.background },
        }}
      />
      <SafeAreaView
        edges={["bottom"]}
        style={{ flex: 1, backgroundColor: colors.background }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, padding: spacing.xl, gap: spacing.xl }}
          showsVerticalScrollIndicator={false}
        >
          {/* Intro */}
          <View style={{ alignItems: "center", gap: spacing.sm, marginTop: spacing.lg }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 18,
                backgroundColor: colors.primaryLight,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Layers size={32} color={colors.primary} />
            </View>
            <Text
              style={{
                fontSize: typography.xl,
                fontWeight: typography.bold,
                color: colors.text,
                textAlign: "center",
              }}
              numberOfLines={2}
            >
              {title ?? "Karteikarten"}
            </Text>
            <Text style={{ fontSize: typography.base, color: colors.textSecondary }}>
              Klassisch umdrehen & bewerten
            </Text>
          </View>

          {/* Richtung — one arrow in the middle, tap to swap */}
          <TouchableOpacity
            onPress={() => setReverse((r) => !r)}
            activeOpacity={0.8}
            style={setupCardStyle}
          >
            <Text
              style={{
                fontSize: typography.sm,
                color: colors.textSecondary,
                marginBottom: spacing.md,
              }}
            >
              Abgefragte Richtung
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text
                style={{
                  flex: 1,
                  textAlign: "right",
                  fontSize: typography.base,
                  fontWeight: typography.semibold,
                  color: colors.text,
                }}
              >
                {reverse ? "Rückseite" : "Vorderseite"}
              </Text>
              <View style={{ width: 44, alignItems: "center" }}>
                <ArrowRight size={22} color={colors.primary} />
              </View>
              <Text
                style={{
                  flex: 1,
                  textAlign: "left",
                  fontSize: typography.base,
                  fontWeight: typography.semibold,
                  color: colors.text,
                }}
              >
                {reverse ? "Vorderseite" : "Rückseite"}
              </Text>
            </View>
            <Text
              style={{
                fontSize: typography.xs,
                color: colors.textTertiary,
                textAlign: "center",
                marginTop: spacing.md,
              }}
            >
              Tippen zum Tauschen
            </Text>
          </TouchableOpacity>

          {/* Nur markierte Karten */}
          <View
            style={{
              ...setupCardStyle,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flex: 1, paddingRight: spacing.md }}>
              <Text
                style={{
                  fontSize: typography.base,
                  fontWeight: typography.semibold,
                  color: colors.text,
                }}
              >
                Nur markierte Karten
              </Text>
              <Text
                style={{
                  fontSize: typography.sm,
                  color: colors.textSecondary,
                  marginTop: 2,
                }}
              >
                Übt nur Karten mit Stern
              </Text>
            </View>
            <Switch
              value={starredOnly}
              onValueChange={setStarredOnly}
              trackColor={{ false: colors.surfaceSecondary, true: colors.primary }}
              thumbColor="#ffffff"
              ios_backgroundColor={colors.surfaceSecondary}
            />
          </View>

          <View style={{ flex: 1 }} />

          {/* Start */}
          <TouchableOpacity
            onPress={() => setPhase("play")}
            activeOpacity={0.85}
            style={{
              backgroundColor: colors.primary,
              paddingVertical: 16,
              borderRadius: radius.lg,
              alignItems: "center",
              ...shadows.md,
            }}
          >
            <Text
              style={{
                color: colors.textInverse,
                fontWeight: typography.bold,
                fontSize: typography.lg,
              }}
            >
              Starten
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

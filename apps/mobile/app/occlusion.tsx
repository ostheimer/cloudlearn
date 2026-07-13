import { useRouter, Stack } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ImagePlus, ChevronLeft } from "lucide-react-native";
import { useColors, spacing, radius, typography } from "../src/theme";

// Image Occlusion is not yet available. The editor was disabled because it
// produced meaningless cards and duplicate decks (see issue #207). This screen
// renders an informational placeholder only — it creates no decks and no cards.
export default function OcclusionScreen() {
  const colors = useColors();
  const router = useRouter();

  return (
    <>
      <Stack.Screen
        options={{
          title: "Bild-Abdecken",
          headerBackTitle: "Zurück",
          headerTintColor: colors.primary,
          headerStyle: { backgroundColor: colors.background },
        }}
      />
      <SafeAreaView
        edges={["bottom"]}
        style={{ flex: 1, backgroundColor: colors.background }}
      >
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: spacing.xl,
            gap: spacing.lg,
          }}
        >
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: colors.primaryLight,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <ImagePlus size={36} color={colors.primary} />
          </View>

          <Text
            style={{
              fontSize: typography.lg,
              fontWeight: typography.semibold,
              color: colors.text,
              textAlign: "center",
            }}
          >
            Bild-Abdecken
          </Text>

          <Text
            style={{
              fontSize: typography.base,
              color: colors.textSecondary,
              textAlign: "center",
              lineHeight: 22,
              paddingHorizontal: spacing.lg,
            }}
          >
            Diese Funktion ist noch in Arbeit und bald verfügbar.
          </Text>

          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.8}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              backgroundColor: colors.surfaceSecondary,
              paddingHorizontal: spacing.xl,
              paddingVertical: spacing.md,
              borderRadius: radius.md,
            }}
          >
            <ChevronLeft size={18} color={colors.text} />
            <Text
              style={{
                color: colors.text,
                fontWeight: typography.semibold,
                fontSize: typography.base,
              }}
            >
              Zurück
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </>
  );
}

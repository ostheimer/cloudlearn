import { useEffect, useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { BookOpen, ScanLine, Layers, ChevronRight } from "lucide-react-native";
import { useSessionStore } from "../../src/store/sessionStore";
import { getDueCards, listDecks } from "../../src/lib/api";
import { colors, spacing, radius, typography, shadows } from "../../src/theme";

export default function HomeScreen() {
  const router = useRouter();
  const userId = useSessionStore((state) => state.userId);
  const [dueCount, setDueCount] = useState(0);
  const [deckCount, setDeckCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    Promise.all([
      getDueCards(userId).catch(() => ({ cards: [] })),
      listDecks(userId).catch(() => ({ decks: [] })),
    ])
      .then(([dueRes, deckRes]) => {
        setDueCount(dueRes.cards.length);
        setDeckCount(deckRes.decks.length);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [userId]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, padding: spacing.xl, gap: spacing.xl }}>
        {/* Header */}
        <View style={{ paddingTop: spacing.xl }}>
          <Text
            style={{
              fontSize: typography.xxxl,
              fontWeight: typography.extrabold,
              color: colors.text,
              letterSpacing: -0.5,
            }}
          >
            clearn
          </Text>
          <Text
            style={{
              fontSize: typography.base,
              color: colors.textSecondary,
              marginTop: spacing.xs,
            }}
          >
            Foto — Karte — Wissen
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator
            size="large"
            color={colors.primary}
            style={{ marginTop: 40 }}
          />
        ) : (
          <>
            {error ? (
              <Text style={{ color: colors.error }}>{error}</Text>
            ) : null}

            {/* Stats cards */}
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <View
                style={{
                  flex: 1,
                  backgroundColor: colors.surface,
                  borderRadius: radius.lg,
                  padding: spacing.xl,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: colors.border,
                  ...shadows.sm,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: radius.md,
                    backgroundColor: dueCount > 0 ? colors.primaryLight : colors.surfaceSecondary,
                    justifyContent: "center",
                    alignItems: "center",
                    marginBottom: spacing.md,
                  }}
                >
                  <BookOpen
                    size={22}
                    color={dueCount > 0 ? colors.primary : colors.textTertiary}
                  />
                </View>
                <Text
                  style={{
                    fontSize: 28,
                    fontWeight: typography.extrabold,
                    color: colors.text,
                  }}
                >
                  {dueCount}
                </Text>
                <Text
                  style={{
                    fontSize: typography.sm,
                    color: colors.textSecondary,
                    marginTop: spacing.xs,
                  }}
                >
                  Fällige Karten
                </Text>
              </View>

              <View
                style={{
                  flex: 1,
                  backgroundColor: colors.surface,
                  borderRadius: radius.lg,
                  padding: spacing.xl,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: colors.border,
                  ...shadows.sm,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: radius.md,
                    backgroundColor: colors.surfaceSecondary,
                    justifyContent: "center",
                    alignItems: "center",
                    marginBottom: spacing.md,
                  }}
                >
                  <Layers size={22} color={colors.textSecondary} />
                </View>
                <Text
                  style={{
                    fontSize: 28,
                    fontWeight: typography.extrabold,
                    color: colors.text,
                  }}
                >
                  {deckCount}
                </Text>
                <Text
                  style={{
                    fontSize: typography.sm,
                    color: colors.textSecondary,
                    marginTop: spacing.xs,
                  }}
                >
                  Decks
                </Text>
              </View>
            </View>

            {/* Action buttons */}
            <View style={{ gap: spacing.md }}>
              {dueCount > 0 && (
                <TouchableOpacity
                  onPress={() => router.push("/(tabs)/learn")}
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: colors.primary,
                    borderRadius: radius.lg,
                    padding: spacing.lg,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: spacing.sm,
                    ...shadows.md,
                  }}
                >
                  <BookOpen size={20} color={colors.textInverse} />
                  <Text
                    style={{
                      color: colors.textInverse,
                      fontSize: typography.lg,
                      fontWeight: typography.bold,
                    }}
                  >
                    {dueCount} Karten lernen
                  </Text>
                  <ChevronRight size={18} color={colors.textInverse} />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={() => router.push("/(tabs)/scan")}
                activeOpacity={0.8}
                style={{
                  backgroundColor: dueCount > 0 ? colors.surface : colors.primary,
                  borderRadius: radius.lg,
                  padding: spacing.lg,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: spacing.sm,
                  borderWidth: dueCount > 0 ? 1 : 0,
                  borderColor: colors.border,
                  ...shadows.sm,
                }}
              >
                <ScanLine
                  size={20}
                  color={dueCount > 0 ? colors.text : colors.textInverse}
                />
                <Text
                  style={{
                    color: dueCount > 0 ? colors.text : colors.textInverse,
                    fontSize: typography.lg,
                    fontWeight: typography.bold,
                  }}
                >
                  Neuen Text scannen
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

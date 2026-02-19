import { useEffect, useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  BookOpen,
  ScanLine,
  Layers,
  ChevronRight,
  Flame,
  Target,
  TrendingUp,
  Award,
} from "lucide-react-native";
import { useSessionStore } from "../../src/store/sessionStore";
import { getStats, listDecks, type StatsResponse, type Deck } from "../../src/lib/api";
import { useColors, spacing, radius, typography, shadows } from "../../src/theme";

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const userId = useSessionStore((state) => state.userId);
  const setDueCount = useSessionStore((state) => state.setDueCount);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [recentDeck, setRecentDeck] = useState<Deck | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    Promise.all([
      getStats().then((res) => {
        setStats(res.stats);
        setDueCount(res.stats.dueCards ?? 0);
      }),
      listDecks(userId).then((res) => {
        if (res.decks.length > 0) {
          const sorted = [...res.decks].sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
          setRecentDeck(sorted[0] ?? null);
        }
      }),
    ])
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [userId]);

  const dueCount = stats?.dueCards ?? 0;
  const deckCount = stats?.totalDecks ?? 0;
  const streak = stats?.currentStreak ?? 0;
  const reviewsToday = stats?.reviewsToday ?? 0;
  const dailyGoal = stats?.dailyGoal ?? 10;
  const dailyProgress = dailyGoal > 0 ? Math.min(reviewsToday / dailyGoal, 1) : 0;
  const accuracyPercent = Math.round((stats?.accuracyRate ?? 0) * 100);

  // Determine whether user has reviewed today
  const today = new Date().toISOString().split("T")[0];
  const reviewedToday = stats?.lastReviewDate === today;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, padding: spacing.xl, gap: spacing.lg }}>
        {/* Header */}
        <View style={{ paddingTop: spacing.lg }}>
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

            {/* Streak banner */}
            <View
              style={{
                backgroundColor: streak > 0 ? colors.warningLight : colors.surfaceSecondary,
                borderRadius: radius.lg,
                padding: spacing.lg,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                borderWidth: 1,
                borderColor: streak > 0 ? colors.warning : colors.border,
              }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: streak > 0 ? colors.warning : colors.surfaceSecondary,
                  justifyContent: "center",
                  alignItems: "center",
                  opacity: streak > 0 ? 0.25 : 1,
                }}
              >
                <Flame
                  size={26}
                  color={streak > 0 ? colors.warning : colors.textTertiary}
                  fill={streak > 0 ? colors.warning : "none"}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 28,
                    fontWeight: typography.extrabold,
                    color: streak > 0 ? colors.warning : colors.textTertiary,
                  }}
                >
                  {streak} {streak === 1 ? "Tag" : "Tage"}
                </Text>
                <Text
                  style={{
                    fontSize: typography.sm,
                    color: streak > 0 ? colors.textSecondary : colors.textTertiary,
                    marginTop: 2,
                  }}
                >
                  {streak === 0
                    ? "Starte deinen Streak!"
                    : !reviewedToday
                      ? "Lerne heute, um deinen Streak zu halten!"
                      : "Weiter so!"}
                </Text>
              </View>
              {stats?.longestStreak && stats.longestStreak > 0 ? (
                <View style={{ alignItems: "center" }}>
                  <Award size={16} color={colors.textTertiary} />
                  <Text
                    style={{
                      fontSize: typography.xs,
                      color: colors.textTertiary,
                      marginTop: 2,
                    }}
                  >
                    Best: {stats.longestStreak}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Daily goal progress */}
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: radius.lg,
                padding: spacing.lg,
                borderWidth: 1,
                borderColor: colors.border,
                gap: spacing.sm,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <Target size={18} color={colors.primary} />
                  <Text
                    style={{
                      fontSize: typography.base,
                      fontWeight: typography.semibold,
                      color: colors.text,
                    }}
                  >
                    Tagesziel
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: typography.sm,
                    fontWeight: typography.bold,
                    color: dailyProgress >= 1 ? colors.success : colors.primary,
                  }}
                >
                  {reviewsToday}/{dailyGoal} Karten
                </Text>
              </View>
              {/* Progress bar */}
              <View
                style={{
                  height: 8,
                  backgroundColor: colors.surfaceSecondary,
                  borderRadius: 4,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    height: "100%",
                    width: `${Math.max(dailyProgress * 100, 1)}%`,
                    backgroundColor: dailyProgress >= 1 ? colors.success : colors.primary,
                    borderRadius: 4,
                  }}
                />
              </View>
            </View>

            {/* Stats cards row */}
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              {/* Due cards */}
              <View
                style={{
                  flex: 1,
                  backgroundColor: colors.surface,
                  borderRadius: radius.lg,
                  padding: spacing.md,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: colors.border,
                  ...shadows.sm,
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: radius.sm,
                    backgroundColor: dueCount > 0 ? colors.primaryLight : colors.surfaceSecondary,
                    justifyContent: "center",
                    alignItems: "center",
                    marginBottom: spacing.sm,
                  }}
                >
                  <BookOpen
                    size={18}
                    color={dueCount > 0 ? colors.primary : colors.textTertiary}
                  />
                </View>
                <Text
                  style={{
                    fontSize: 22,
                    fontWeight: typography.extrabold,
                    color: colors.text,
                  }}
                >
                  {dueCount}
                </Text>
                <Text
                  style={{
                    fontSize: typography.xs,
                    color: colors.textSecondary,
                    marginTop: 2,
                  }}
                >
                  Fällig
                </Text>
              </View>

              {/* Decks */}
              <View
                style={{
                  flex: 1,
                  backgroundColor: colors.surface,
                  borderRadius: radius.lg,
                  padding: spacing.md,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: colors.border,
                  ...shadows.sm,
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: radius.sm,
                    backgroundColor: colors.surfaceSecondary,
                    justifyContent: "center",
                    alignItems: "center",
                    marginBottom: spacing.sm,
                  }}
                >
                  <Layers size={18} color={colors.textSecondary} />
                </View>
                <Text
                  style={{
                    fontSize: 22,
                    fontWeight: typography.extrabold,
                    color: colors.text,
                  }}
                >
                  {deckCount}
                </Text>
                <Text
                  style={{
                    fontSize: typography.xs,
                    color: colors.textSecondary,
                    marginTop: 2,
                  }}
                >
                  Decks
                </Text>
              </View>

              {/* Accuracy */}
              <View
                style={{
                  flex: 1,
                  backgroundColor: colors.surface,
                  borderRadius: radius.lg,
                  padding: spacing.md,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: colors.border,
                  ...shadows.sm,
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: radius.sm,
                    backgroundColor:
                      accuracyPercent >= 70 ? colors.successLight : colors.surfaceSecondary,
                    justifyContent: "center",
                    alignItems: "center",
                    marginBottom: spacing.sm,
                  }}
                >
                  <TrendingUp
                    size={18}
                    color={
                      accuracyPercent >= 70 ? colors.success : colors.textTertiary
                    }
                  />
                </View>
                <Text
                  style={{
                    fontSize: 22,
                    fontWeight: typography.extrabold,
                    color: colors.text,
                  }}
                >
                  {(stats?.reviewsTotal ?? 0) > 0 ? `${accuracyPercent}%` : "—"}
                </Text>
                <Text
                  style={{
                    fontSize: typography.xs,
                    color: colors.textSecondary,
                    marginTop: 2,
                  }}
                >
                  Genauigkeit
                </Text>
              </View>
            </View>

            {/* Recently used deck */}
            {recentDeck && (
              <TouchableOpacity
                onPress={() => router.push("/(tabs)/learn")}
                activeOpacity={0.8}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: radius.lg,
                  padding: spacing.lg,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  ...shadows.sm,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: radius.sm,
                    backgroundColor: colors.primaryLight,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <BookOpen size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: typography.xs,
                      color: colors.textTertiary,
                      marginBottom: 2,
                    }}
                  >
                    Zuletzt gelernt
                  </Text>
                  <Text
                    style={{
                      fontSize: typography.base,
                      fontWeight: typography.semibold,
                      color: colors.text,
                    }}
                    numberOfLines={1}
                  >
                    {recentDeck.title}
                  </Text>
                </View>
                <ChevronRight size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            )}

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

import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  AlertTriangle,
  Layers,
  Play,
  RotateCcw,
  TrendingUp,
} from "lucide-react-native";
import {
  fetchDeckStats,
  type DeckStats,
  type DeckWobblyCard,
} from "../../src/lib/statsApi";
import {
  AccuracyRing,
  AccuracyTrendChart,
  shortDate,
} from "../../src/components/statsCharts";
import { useReviewSession } from "../../src/features/review/reviewSession";
import { useColors, spacing, radius, typography, shadows } from "../../src/theme";

// Deck-Statistik (#246, Laras Design): Genauigkeits-Ring + Verlauf für EIN
// Deck und die "Wackelkandidaten" (meist-falsch beantwortete Karten). Eine
// Karte antippen übt genau diese Karte, der große Knopf übt alle — beides
// startet eine Karteikarten-Runde über den Review-Session-Store.
export default function DeckStatsScreen() {
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  const router = useRouter();
  const colors = useColors();
  const startReview = useReviewSession((s) => s.start);

  const [stats, setStats] = useState<DeckStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadStats = useCallback(() => {
    if (!id) return () => {};
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetchDeckStats(id)
      .then((result) => {
        if (!cancelled) setStats(result);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => loadStats(), [loadStats]);

  const deckTitle = stats?.deck.title ?? title ?? "Deck";
  const answersTotal = stats?.answersTotal ?? 0;
  const answersCorrect = stats?.answersCorrect ?? 0;
  const accuracy = answersTotal > 0 ? answersCorrect / answersTotal : 0;
  const accuracyByDay = stats?.accuracyByDay ?? [];
  const wobbly = stats?.wobblyCards ?? [];

  // Karteikarten-Runde mit genau diesen Karten starten (Session-Store-Weg).
  const practiceCards = (cards: DeckWobblyCard[]) => {
    if (cards.length === 0) return;
    startReview(
      cards.map((c) => ({ id: c.cardId, front: c.front, back: c.back }))
    );
    router.push(`/practice?title=${encodeURIComponent(deckTitle)}`);
  };

  const cardStyle = {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  } as const;

  const cardTitleStyle = {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.text,
  } as const;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "",
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
          contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
          showsVerticalScrollIndicator={false}
        >
          {/* Header: deck title + subtitle */}
          <View>
            <Text
              numberOfLines={2}
              style={{
                fontSize: typography.xxl,
                fontWeight: typography.bold,
                color: colors.text,
              }}
            >
              {deckTitle}
            </Text>
            <Text
              style={{
                fontSize: typography.sm,
                color: colors.textSecondary,
                marginTop: 2,
              }}
            >
              Deck-Statistik
            </Text>
          </View>

          {loading ? (
            <ActivityIndicator
              size="large"
              color={colors.primary}
              style={{ marginTop: 40 }}
            />
          ) : error ? (
            <View style={{ ...cardStyle, gap: spacing.md }}>
              <Text
                style={{
                  color: colors.error,
                  fontSize: typography.base,
                  fontWeight: typography.semibold,
                }}
              >
                Konnte die Deck-Statistik nicht laden.
              </Text>
              <TouchableOpacity
                onPress={loadStats}
                activeOpacity={0.8}
                style={{
                  alignSelf: "flex-start",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                  backgroundColor: colors.primary,
                  borderRadius: radius.md,
                  paddingHorizontal: spacing.xl,
                  paddingVertical: spacing.md,
                }}
              >
                <RotateCcw size={16} color="#fff" />
                <Text
                  style={{
                    color: "#fff",
                    fontWeight: typography.semibold,
                    fontSize: typography.sm,
                  }}
                >
                  Erneut versuchen
                </Text>
              </TouchableOpacity>
            </View>
          ) : stats ? (
            <>
              {/* Genauigkeit — ring + context + trend (30 Tage) */}
              <View style={{ ...cardStyle, gap: spacing.md }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.sm,
                  }}
                >
                  <TrendingUp size={18} color={colors.primary} />
                  <Text style={cardTitleStyle}>Genauigkeit</Text>
                </View>

                {answersTotal > 0 ? (
                  <>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: spacing.lg,
                      }}
                    >
                      <AccuracyRing accuracy={accuracy} hasData />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text
                          style={{
                            fontSize: typography.base,
                            fontWeight: typography.semibold,
                            color: colors.text,
                          }}
                        >
                          {answersCorrect.toLocaleString("de-DE")} von{" "}
                          {answersTotal.toLocaleString("de-DE")} Antworten
                          richtig
                        </Text>
                        <Text
                          style={{
                            fontSize: typography.sm,
                            color: colors.textSecondary,
                          }}
                        >
                          in den letzten 30 Tagen
                        </Text>
                      </View>
                    </View>

                    <View
                      style={{ height: 1, backgroundColor: colors.borderLight }}
                    />

                    {accuracyByDay.length >= 2 ? (
                      <View style={{ gap: spacing.xs }}>
                        <Text
                          style={{
                            fontSize: typography.xs,
                            color: colors.textTertiary,
                          }}
                        >
                          Verlauf — letzte 30 Tage
                        </Text>
                        <AccuracyTrendChart
                          data={accuracyByDay}
                          showAllDates={false}
                        />
                      </View>
                    ) : (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: spacing.xs,
                        }}
                      >
                        <TrendingUp size={14} color={colors.textSecondary} />
                        <Text
                          style={{
                            fontSize: typography.sm,
                            color: colors.textSecondary,
                          }}
                        >
                          Verlauf erscheint ab 2 Lern-Tagen
                        </Text>
                      </View>
                    )}
                  </>
                ) : (
                  <View
                    style={{ paddingVertical: spacing.lg, alignItems: "center" }}
                  >
                    <Text
                      style={{
                        fontSize: typography.sm,
                        color: colors.textSecondary,
                        textAlign: "center",
                        lineHeight: 20,
                      }}
                    >
                      Noch keine Antworten in den letzten 30 Tagen — übe
                      dieses Deck, dann füllt sich die Statistik.
                    </Text>
                  </View>
                )}
              </View>

              {/* Wackelkandidaten — meist-falsch beantwortete Karten */}
              <View style={{ ...cardStyle, gap: spacing.sm }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.sm,
                  }}
                >
                  <AlertTriangle size={18} color={colors.warning} />
                  <Text style={cardTitleStyle}>Deine Wackelkandidaten</Text>
                </View>

                {wobbly.length > 0 ? (
                  <>
                    <Text
                      style={{
                        fontSize: typography.xs,
                        color: colors.textTertiary,
                      }}
                    >
                      Tippe eine Karte an, um genau sie zu üben.
                    </Text>
                    <View>
                      {wobbly.map((card, i) => (
                        <TouchableOpacity
                          key={card.cardId}
                          onPress={() => practiceCards([card])}
                          activeOpacity={0.7}
                          accessibilityRole="button"
                          accessibilityLabel={`${card.front}: ${card.wrongCount}x falsch, jetzt üben`}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: spacing.md,
                            paddingVertical: spacing.md,
                            borderTopWidth: i === 0 ? 0 : 1,
                            borderTopColor: colors.borderLight,
                          }}
                        >
                          <View style={{ flex: 1, gap: 3 }}>
                            <Text
                              numberOfLines={2}
                              style={{
                                fontSize: typography.sm,
                                fontWeight: typography.semibold,
                                color: colors.text,
                              }}
                            >
                              {card.front}
                            </Text>
                            <Text
                              style={{
                                fontSize: typography.xs,
                                color: colors.textTertiary,
                              }}
                            >
                              {card.wrongCount}x falsch · zuletzt{" "}
                              {shortDate(card.lastWrongAt.slice(0, 10))}
                            </Text>
                          </View>
                          <Play size={16} color={colors.primary} />
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                ) : (
                  <View
                    style={{ paddingVertical: spacing.lg, alignItems: "center" }}
                  >
                    <Text
                      style={{
                        fontSize: typography.sm,
                        color: colors.textSecondary,
                        textAlign: "center",
                        lineHeight: 20,
                      }}
                    >
                      {answersTotal > 0
                        ? "Keine Wackelkandidaten — alle Karten sitzen."
                        : "Sobald du hier lernst, zeigen wir dir die Karten, die am häufigsten schiefgehen."}
                    </Text>
                  </View>
                )}
              </View>

              {/* Üben + Deck öffnen */}
              {wobbly.length > 0 ? (
                <TouchableOpacity
                  onPress={() => practiceCards(wobbly)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  style={{
                    backgroundColor: colors.primary,
                    paddingVertical: 16,
                    borderRadius: radius.lg,
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "row",
                    gap: spacing.sm,
                    ...shadows.md,
                  }}
                >
                  <Play size={18} color={colors.textInverse} />
                  <Text
                    style={{
                      color: colors.textInverse,
                      fontWeight: typography.bold,
                      fontSize: typography.lg,
                    }}
                  >
                    Wackelkandidaten üben ({wobbly.length})
                  </Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                onPress={() =>
                  router.push(
                    `/deck/${id}?title=${encodeURIComponent(deckTitle)}`
                  )
                }
                activeOpacity={0.8}
                accessibilityRole="button"
                style={{
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingVertical: 14,
                  borderRadius: radius.lg,
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  gap: spacing.sm,
                }}
              >
                <Layers size={18} color={colors.primary} />
                <Text
                  style={{
                    color: colors.primary,
                    fontWeight: typography.semibold,
                    fontSize: typography.base,
                  }}
                >
                  Deck öffnen
                </Text>
              </TouchableOpacity>
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

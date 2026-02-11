import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Easing,
} from "react-native-reanimated";
import {
  CheckCircle2,
  RotateCcw,
  ArrowRight,
} from "lucide-react-native";
import { useReviewSession, type ReviewRating } from "../../src/features/review/reviewSession";
import { useSessionStore } from "../../src/store/sessionStore";
import { getDueCards, reviewCard } from "../../src/lib/api";
import { colors, spacing, radius, typography, shadows } from "../../src/theme";

export default function LearnScreen() {
  const { t } = useTranslation();
  const userId = useSessionStore((state) => state.userId);
  const { cards, index, revealed, completed, start, reveal, rateCurrent } =
    useReviewSession();
  const [loading, setLoading] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);

  // Flip animation
  const flipProgress = useSharedValue(0);

  const frontAnimatedStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(flipProgress.value, [0, 1], [0, 180]);
    return {
      transform: [{ perspective: 1200 }, { rotateY: `${rotateY}deg` }],
      backfaceVisibility: "hidden" as const,
    };
  });

  const backAnimatedStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(flipProgress.value, [0, 1], [180, 360]);
    return {
      transform: [{ perspective: 1200 }, { rotateY: `${rotateY}deg` }],
      backfaceVisibility: "hidden" as const,
    };
  });

  // Reset flip when card changes
  useEffect(() => {
    flipProgress.value = 0;
  }, [index, flipProgress]);

  // Animate flip when revealed
  useEffect(() => {
    if (revealed) {
      flipProgress.value = withTiming(1, {
        duration: 400,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [revealed, flipProgress]);

  const loadDueCards = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { cards: due } = await getDueCards(userId);
      if (due.length > 0) {
        start(due.map((c) => ({ id: c.id, front: c.front, back: c.back })));
      } else {
        start([]);
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Fehler";
      Alert.alert("Fehler", msg);
    } finally {
      setLoading(false);
    }
  }, [userId, start]);

  useEffect(() => {
    // Only load due cards if no cards are already loaded (e.g. from scan flow)
    if (cards.length === 0 && !completed) {
      loadDueCards();
    }
  }, []);

  const handleRate = async (rating: ReviewRating) => {
    const result = rateCurrent(rating);
    if (!result || !userId) return;

    setReviewLoading(true);
    try {
      await reviewCard(userId, result.cardId, rating);
    } catch {
      // Review is still tracked locally, API sync can happen later
    } finally {
      setReviewLoading(false);
    }
  };

  const handleFlip = () => {
    if (!revealed) {
      reveal();
    }
  };

  const current = cards[index];
  const progress = cards.length > 0 ? (index + (revealed ? 1 : 0)) / cards.length : 0;

  // Parse cloze cards
  const formatCloze = (
    text: string
  ): { display: string; clozeAnswer: string | null } => {
    const match = text.match(/\{\{c\d+::(.+?)\}\}/);
    if (!match) return { display: text, clozeAnswer: null };
    const clozeAnswer = match[1] ?? null;
    const display = text.replace(/\{\{c\d+::.+?\}\}/g, "______");
    return { display, clozeAnswer };
  };

  const frontParsed = current
    ? formatCloze(current.front)
    : { display: "", clozeAnswer: null };
  const displayBack = frontParsed.clozeAnswer ?? current?.back ?? "";

  const ratingButton = (
    label: string,
    rating: ReviewRating,
    bgColor: string
  ) => (
    <TouchableOpacity
      onPress={() => handleRate(rating)}
      disabled={reviewLoading}
      activeOpacity={0.8}
      style={{
        flex: 1,
        backgroundColor: bgColor,
        borderRadius: radius.md,
        paddingVertical: 14,
        alignItems: "center",
      }}
    >
      <Text
        style={{
          color: colors.textInverse,
          fontWeight: typography.bold,
          fontSize: typography.sm,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, padding: spacing.lg, gap: spacing.lg }}>
        {/* Header */}
        <Text
          style={{
            fontSize: typography.xxl,
            fontWeight: typography.bold,
            color: colors.text,
          }}
        >
          {t("reviewHeadline")}
        </Text>

        {loading ? (
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <ActivityIndicator size="large" color={colors.primary} />
            <Text
              style={{
                marginTop: spacing.md,
                color: colors.textSecondary,
                fontSize: typography.base,
              }}
            >
              Fällige Karten laden...
            </Text>
          </View>
        ) : completed || cards.length === 0 ? (
          /* Completion / Empty state */
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
              gap: spacing.lg,
            }}
          >
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: cards.length === 0 ? colors.surfaceSecondary : colors.successLight,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <CheckCircle2
                size={36}
                color={cards.length === 0 ? colors.textTertiary : colors.success}
              />
            </View>
            <Text
              style={{
                fontSize: typography.xl,
                fontWeight: typography.semibold,
                textAlign: "center",
                color: colors.text,
              }}
            >
              {cards.length === 0
                ? "Keine fälligen Karten"
                : "Session abgeschlossen!"}
            </Text>
            <Text
              style={{
                color: colors.textSecondary,
                textAlign: "center",
                fontSize: typography.base,
              }}
            >
              {cards.length === 0
                ? "Scanne einen Text, um Flashcards zu generieren."
                : `${cards.length} Karten gelernt.`}
            </Text>
            <TouchableOpacity
              onPress={loadDueCards}
              activeOpacity={0.8}
              style={{
                backgroundColor: colors.primary,
                borderRadius: radius.md,
                paddingHorizontal: spacing.xxl,
                paddingVertical: 14,
                flexDirection: "row",
                gap: spacing.sm,
                alignItems: "center",
              }}
            >
              <RotateCcw size={18} color={colors.textInverse} />
              <Text
                style={{
                  color: colors.textInverse,
                  fontWeight: typography.semibold,
                  fontSize: typography.base,
                }}
              >
                Neu laden
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ flex: 1, gap: spacing.lg }}>
            {/* Progress bar */}
            <View style={{ gap: spacing.sm }}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: typography.sm,
                    fontWeight: typography.medium,
                  }}
                >
                  Karte {index + 1} von {cards.length}
                </Text>
                <Text
                  style={{
                    color: colors.textTertiary,
                    fontSize: typography.sm,
                  }}
                >
                  {Math.round(progress * 100)}%
                </Text>
              </View>
              <View
                style={{
                  height: 4,
                  backgroundColor: colors.surfaceSecondary,
                  borderRadius: 2,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    height: "100%",
                    width: `${Math.max(progress * 100, 2)}%`,
                    backgroundColor: progress >= 1 ? colors.success : colors.primary,
                    borderRadius: 2,
                  }}
                />
              </View>
            </View>

            {/* Flashcard (tap to flip) */}
            <TouchableOpacity
              onPress={handleFlip}
              activeOpacity={0.95}
              style={{
                flex: 1,
                position: "relative",
              }}
            >
              {/* Front */}
              <Animated.View
                style={[
                  frontAnimatedStyle,
                  {
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: colors.surface,
                    borderRadius: radius.xl,
                    padding: spacing.xxl,
                    justifyContent: "center",
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: colors.border,
                    ...shadows.lg,
                  },
                ]}
              >
                <Text
                  style={{
                    fontSize: typography.xl,
                    fontWeight: typography.semibold,
                    textAlign: "center",
                    color: colors.text,
                    lineHeight: 30,
                  }}
                >
                  {frontParsed.display}
                </Text>
                {!revealed && (
                  <Text
                    style={{
                      marginTop: spacing.xl,
                      color: colors.textTertiary,
                      fontSize: typography.sm,
                    }}
                  >
                    Tippen zum Umdrehen
                  </Text>
                )}
              </Animated.View>

              {/* Back */}
              <Animated.View
                style={[
                  backAnimatedStyle,
                  {
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: colors.surface,
                    borderRadius: radius.xl,
                    padding: spacing.xxl,
                    justifyContent: "center",
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: colors.primary,
                    ...shadows.lg,
                  },
                ]}
              >
                <Text
                  style={{
                    fontSize: typography.xl,
                    fontWeight: frontParsed.clozeAnswer
                      ? typography.bold
                      : typography.normal,
                    textAlign: "center",
                    color: colors.text,
                    lineHeight: 30,
                  }}
                >
                  {displayBack}
                </Text>
              </Animated.View>
            </TouchableOpacity>

            {/* Rating buttons (visible after flip) */}
            {revealed ? (
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                {ratingButton("Nochmal", "again", colors.ratingAgain)}
                {ratingButton("Schwer", "hard", colors.ratingHard)}
                {ratingButton("Gut", "good", colors.ratingGood)}
                {ratingButton("Leicht", "easy", colors.ratingEasy)}
              </View>
            ) : (
              <TouchableOpacity
                onPress={handleFlip}
                activeOpacity={0.8}
                style={{
                  backgroundColor: colors.primary,
                  borderRadius: radius.md,
                  paddingVertical: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: spacing.sm,
                }}
              >
                <ArrowRight size={18} color={colors.textInverse} />
                <Text
                  style={{
                    color: colors.textInverse,
                    fontSize: typography.lg,
                    fontWeight: typography.bold,
                  }}
                >
                  Antwort anzeigen
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

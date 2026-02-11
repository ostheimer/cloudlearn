import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  interpolate,
  interpolateColor,
  runOnJS,
  Easing,
} from "react-native-reanimated";
import {
  CheckCircle2,
  RotateCcw,
  ArrowRight,
  ArrowLeftRight,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react-native";
import {
  useReviewSession,
  type ReviewRating,
} from "../../src/features/review/reviewSession";
import { useSessionStore } from "../../src/store/sessionStore";
import { getDueCards, reviewCard } from "../../src/lib/api";
import { colors, spacing, radius, typography, shadows } from "../../src/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;
const SWIPE_VELOCITY = 500;

export default function LearnScreen() {
  const { t } = useTranslation();
  const userId = useSessionStore((state) => state.userId);
  const { cards, index, revealed, completed, start, reveal, rateCurrent } =
    useReviewSession();
  const [loading, setLoading] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [showBackFirst, setShowBackFirst] = useState(false);

  // Flip animation
  const flipProgress = useSharedValue(0);
  // Swipe animation
  const translateX = useSharedValue(0);

  // --- Flip animated styles ---
  const frontAnimatedStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(flipProgress.value, [0, 1], [0, 180]);
    return {
      transform: [
        { perspective: 1200 },
        { rotateY: `${rotateY}deg` },
        { translateX: translateX.value },
      ],
      backfaceVisibility: "hidden" as const,
    };
  });

  const backAnimatedStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(flipProgress.value, [0, 1], [180, 360]);
    return {
      transform: [
        { perspective: 1200 },
        { rotateY: `${rotateY}deg` },
        { translateX: translateX.value },
      ],
      backfaceVisibility: "hidden" as const,
    };
  });

  // Swipe overlay styles (green/red indicator)
  const swipeOverlayStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      Math.abs(translateX.value),
      [0, SWIPE_THRESHOLD * 0.5, SWIPE_THRESHOLD],
      [0, 0.3, 0.8]
    );
    const bgColor = interpolateColor(
      translateX.value,
      [-SWIPE_THRESHOLD, 0, SWIPE_THRESHOLD],
      ["rgba(239,68,68,0.15)", "rgba(0,0,0,0)", "rgba(16,185,129,0.15)"]
    );
    return {
      opacity,
      backgroundColor: bgColor,
    };
  });

  const swipeLabelLeftStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateX.value,
      [-SWIPE_THRESHOLD, -SWIPE_THRESHOLD * 0.4, 0],
      [1, 0.5, 0]
    );
    return { opacity };
  });

  const swipeLabelRightStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateX.value,
      [0, SWIPE_THRESHOLD * 0.4, SWIPE_THRESHOLD],
      [0, 0.5, 1]
    );
    return { opacity };
  });

  // Reset animations when card changes
  useEffect(() => {
    flipProgress.value = 0;
    translateX.value = 0;
  }, [index, flipProgress, translateX]);

  // Animate flip when revealed
  useEffect(() => {
    if (revealed) {
      flipProgress.value = withTiming(1, {
        duration: 400,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [revealed, flipProgress]);

  // --- Data loading ---
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
    if (cards.length === 0 && !completed) {
      loadDueCards();
    }
  }, []);

  // --- Rating handlers ---
  const handleRate = async (rating: ReviewRating) => {
    const result = rateCurrent(rating);
    if (!result || !userId) return;

    setReviewLoading(true);
    try {
      await reviewCard(userId, result.cardId, rating);
    } catch {
      // Review is still tracked locally
    } finally {
      setReviewLoading(false);
    }
  };

  const handleSwipeRight = () => {
    handleRate("good");
  };

  const handleSwipeLeft = () => {
    handleRate("again");
  };

  const handleFlip = () => {
    if (!revealed) {
      reveal();
    }
  };

  // --- Swipe gesture ---
  const panGesture = Gesture.Pan()
    .enabled(revealed) // Only swipe after card is flipped
    .onUpdate((e) => {
      translateX.value = e.translationX;
    })
    .onEnd((e) => {
      const shouldSwipeRight =
        e.translationX > SWIPE_THRESHOLD ||
        (e.velocityX > SWIPE_VELOCITY && e.translationX > 40);
      const shouldSwipeLeft =
        e.translationX < -SWIPE_THRESHOLD ||
        (e.velocityX < -SWIPE_VELOCITY && e.translationX < -40);

      if (shouldSwipeRight) {
        translateX.value = withTiming(SCREEN_WIDTH * 1.5, { duration: 250 }, () => {
          runOnJS(handleSwipeRight)();
        });
      } else if (shouldSwipeLeft) {
        translateX.value = withTiming(-SCREEN_WIDTH * 1.5, { duration: 250 }, () => {
          runOnJS(handleSwipeLeft)();
        });
      } else {
        // Snap back
        translateX.value = withSpring(0, {
          damping: 20,
          stiffness: 200,
        });
      }
    });

  // Tap gesture for flipping
  const tapGesture = Gesture.Tap().onEnd(() => {
    if (!revealed) {
      runOnJS(handleFlip)();
    }
  });

  // Compose: tap + pan (simultaneous so tap works on front, pan on back)
  const composedGesture = Gesture.Simultaneous(tapGesture, panGesture);

  // --- Card content with toggle ---
  const current = cards[index];
  const progress =
    cards.length > 0 ? (index + (revealed ? 1 : 0)) / cards.length : 0;

  const formatCloze = (
    text: string
  ): { display: string; clozeAnswer: string | null } => {
    const match = text.match(/\{\{c\d+::(.+?)\}\}/);
    if (!match) return { display: text, clozeAnswer: null };
    const clozeAnswer = match[1] ?? null;
    const display = text.replace(/\{\{c\d+::.+?\}\}/g, "______");
    return { display, clozeAnswer };
  };

  // Toggle: swap front and back content
  const rawFront = current?.front ?? "";
  const rawBack = current?.back ?? "";
  const effectiveFront = showBackFirst ? rawBack : rawFront;
  const effectiveBack = showBackFirst ? rawFront : rawBack;

  const frontParsed = formatCloze(effectiveFront);
  const displayBack = frontParsed.clozeAnswer ?? effectiveBack;

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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, padding: spacing.lg, gap: spacing.lg }}>
          {/* Header row */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontSize: typography.xxl,
                fontWeight: typography.bold,
                color: colors.text,
              }}
            >
              {t("reviewHeadline")}
            </Text>

            {/* Toggle: Begriff ↔ Definition */}
            {cards.length > 0 && !completed && (
              <TouchableOpacity
                onPress={() => setShowBackFirst((prev) => !prev)}
                activeOpacity={0.7}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.xs,
                  backgroundColor: showBackFirst
                    ? colors.primaryLight
                    : colors.surfaceSecondary,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.full,
                }}
              >
                <ArrowLeftRight
                  size={14}
                  color={showBackFirst ? colors.primary : colors.textTertiary}
                />
                <Text
                  style={{
                    fontSize: typography.xs,
                    fontWeight: typography.semibold,
                    color: showBackFirst
                      ? colors.primary
                      : colors.textTertiary,
                  }}
                >
                  {showBackFirst ? "Definition → Begriff" : "Begriff → Definition"}
                </Text>
              </TouchableOpacity>
            )}
          </View>

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
                  backgroundColor:
                    cards.length === 0
                      ? colors.surfaceSecondary
                      : colors.successLight,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <CheckCircle2
                  size={36}
                  color={
                    cards.length === 0 ? colors.textTertiary : colors.success
                  }
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
                      backgroundColor:
                        progress >= 1 ? colors.success : colors.primary,
                      borderRadius: 2,
                    }}
                  />
                </View>
              </View>

              {/* Swipe hint (only when revealed) */}
              {revealed && (
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    paddingHorizontal: spacing.sm,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.xs,
                    }}
                  >
                    <ThumbsDown size={12} color={colors.ratingAgain} />
                    <Text
                      style={{
                        fontSize: typography.xs,
                        color: colors.ratingAgain,
                        fontWeight: typography.medium,
                      }}
                    >
                      ← Nochmal
                    </Text>
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.xs,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: typography.xs,
                        color: colors.ratingGood,
                        fontWeight: typography.medium,
                      }}
                    >
                      Gewusst →
                    </Text>
                    <ThumbsUp size={12} color={colors.ratingGood} />
                  </View>
                </View>
              )}

              {/* Flashcard with swipe + flip */}
              <GestureDetector gesture={composedGesture}>
                <View
                  style={{
                    flex: 1,
                    position: "relative",
                  }}
                >
                  {/* Swipe color overlay */}
                  <Animated.View
                    style={[
                      swipeOverlayStyle,
                      {
                        position: "absolute",
                        top: -4,
                        left: -4,
                        right: -4,
                        bottom: -4,
                        borderRadius: radius.xl + 4,
                        zIndex: 10,
                        pointerEvents: "none",
                      },
                    ]}
                  />

                  {/* Swipe left label */}
                  <Animated.View
                    style={[
                      swipeLabelLeftStyle,
                      {
                        position: "absolute",
                        top: 20,
                        right: 20,
                        zIndex: 20,
                        backgroundColor: colors.ratingAgain,
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.sm,
                        borderRadius: radius.sm,
                        pointerEvents: "none",
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: colors.textInverse,
                        fontWeight: typography.bold,
                        fontSize: typography.sm,
                      }}
                    >
                      NOCHMAL
                    </Text>
                  </Animated.View>

                  {/* Swipe right label */}
                  <Animated.View
                    style={[
                      swipeLabelRightStyle,
                      {
                        position: "absolute",
                        top: 20,
                        left: 20,
                        zIndex: 20,
                        backgroundColor: colors.ratingGood,
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.sm,
                        borderRadius: radius.sm,
                        pointerEvents: "none",
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: colors.textInverse,
                        fontWeight: typography.bold,
                        fontSize: typography.sm,
                      }}
                    >
                      GEWUSST
                    </Text>
                  </Animated.View>

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
                    {revealed && (
                      <Text
                        style={{
                          marginTop: spacing.xl,
                          color: colors.textTertiary,
                          fontSize: typography.xs,
                        }}
                      >
                        Wischen oder unten bewerten
                      </Text>
                    )}
                  </Animated.View>
                </View>
              </GestureDetector>

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
    </GestureHandlerRootView>
  );
}

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
  Star,
  Volume2,
  Play,
  Pause,
  Square,
  Timer,
} from "lucide-react-native";
import * as Speech from "expo-speech";
import {
  useReviewSession,
  type ReviewRating,
} from "../../src/features/review/reviewSession";
import { useSessionStore } from "../../src/store/sessionStore";
import { getDueCards, reviewCard, updateCard } from "../../src/lib/api";
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
  // Track starred status per card id (local mirror)
  const [starredMap, setStarredMap] = useState<Record<string, boolean>>({});

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
        // Populate starred map from API data
        const starMap: Record<string, boolean> = {};
        due.forEach((c) => { starMap[c.id] = c.starred ?? false; });
        setStarredMap(starMap);
        start(due.map((c) => ({ id: c.id, front: c.front, back: c.back, starred: c.starred })));
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

  // TTS: speak card text
  const [speaking, setSpeaking] = useState(false);
  const speakText = async (text: string) => {
    if (speaking) {
      await Speech.stop();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    Speech.speak(text, {
      language: "de-DE",
      onDone: () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  };

  // Stop speech on card change
  useEffect(() => {
    Speech.stop();
    setSpeaking(false);
  }, [index]);

  // --- Auto-Play ---
  const [autoPlaying, setAutoPlaying] = useState(false);
  const [autoPlaySpeed, setAutoPlaySpeed] = useState(3); // seconds per side
  const autoPlayRef = { current: null as ReturnType<typeof setTimeout> | null };

  // Stop auto-play on unmount or completion
  useEffect(() => {
    if (completed && autoPlaying) {
      setAutoPlaying(false);
    }
  }, [completed, autoPlaying]);

  // Auto-play loop
  useEffect(() => {
    if (!autoPlaying || completed || cards.length === 0) return;

    const tick = () => {
      if (!autoPlaying) return;
      const { revealed: isRevealed } = useReviewSession.getState();
      if (!isRevealed) {
        // Show answer (flip)
        reveal();
      } else {
        // Rate "good" and move to next
        handleRate("good");
      }
    };

    autoPlayRef.current = setTimeout(tick, autoPlaySpeed * 1000);
    return () => {
      if (autoPlayRef.current) clearTimeout(autoPlayRef.current);
    };
  }, [autoPlaying, revealed, index, autoPlaySpeed, completed, cards.length]);

  // Also speak during auto-play if TTS is possible
  useEffect(() => {
    if (!autoPlaying || !current) return;
    const text = revealed ? displayBack : frontParsed?.display ?? effectiveFront;
    if (text) {
      Speech.speak(text, { language: "de-DE" });
    }
    return () => { Speech.stop(); };
  }, [autoPlaying, revealed, index]);

  const toggleAutoPlay = () => {
    if (autoPlaying) {
      setAutoPlaying(false);
      Speech.stop();
    } else {
      setAutoPlaying(true);
    }
  };

  const cycleSpeed = () => {
    const speeds = [1, 3, 5, 10];
    const idx = speeds.indexOf(autoPlaySpeed);
    setAutoPlaySpeed(speeds[(idx + 1) % speeds.length]!);
  };

  // Toggle starred for current card
  const toggleStar = async () => {
    if (!current) return;
    const cardId = current.id;
    const newVal = !starredMap[cardId];
    setStarredMap((prev) => ({ ...prev, [cardId]: newVal }));
    try {
      await updateCard(cardId, { starred: newVal });
    } catch {
      // Revert on error
      setStarredMap((prev) => ({ ...prev, [cardId]: !newVal }));
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
  const isStarred = current ? !!starredMap[current.id] : false;

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

            {/* Header buttons row */}
            {cards.length > 0 && !completed && (
              <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
                {/* Auto-Play controls */}
                <TouchableOpacity
                  onPress={toggleAutoPlay}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.xs,
                    backgroundColor: autoPlaying
                      ? colors.primaryLight
                      : colors.surfaceSecondary,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    borderRadius: radius.full,
                  }}
                >
                  {autoPlaying ? (
                    <Pause size={14} color={colors.primary} />
                  ) : (
                    <Play size={14} color={colors.textTertiary} />
                  )}
                  {autoPlaying && (
                    <Text
                      style={{
                        fontSize: typography.xs,
                        fontWeight: typography.semibold,
                        color: colors.primary,
                      }}
                    >
                      Auto
                    </Text>
                  )}
                </TouchableOpacity>
                {/* Speed control (only visible during auto-play) */}
                {autoPlaying && (
                  <TouchableOpacity
                    onPress={cycleSpeed}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.xs,
                      backgroundColor: colors.surfaceSecondary,
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.sm,
                      borderRadius: radius.full,
                    }}
                  >
                    <Timer size={12} color={colors.textSecondary} />
                    <Text
                      style={{
                        fontSize: typography.xs,
                        fontWeight: typography.semibold,
                        color: colors.textSecondary,
                      }}
                    >
                      {autoPlaySpeed}s
                    </Text>
                  </TouchableOpacity>
                )}
                {/* Toggle: Begriff ↔ Definition */}
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
                </TouchableOpacity>
              </View>
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
                    {/* Top-right action buttons */}
                    <View
                      style={{
                        position: "absolute",
                        top: spacing.md,
                        right: spacing.md,
                        zIndex: 30,
                        flexDirection: "row",
                        gap: spacing.md,
                      }}
                    >
                      <TouchableOpacity
                        onPress={() => speakText(effectiveFront)}
                        activeOpacity={0.6}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      >
                        <Volume2
                          size={20}
                          color={speaking ? colors.primary : colors.textTertiary}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={toggleStar}
                        activeOpacity={0.6}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      >
                        <Star
                          size={20}
                          color={isStarred ? colors.warning : colors.textTertiary}
                          fill={isStarred ? colors.warning : "none"}
                        />
                      </TouchableOpacity>
                    </View>
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
                    {/* Top-right action buttons (back) */}
                    <View
                      style={{
                        position: "absolute",
                        top: spacing.md,
                        right: spacing.md,
                        zIndex: 30,
                        flexDirection: "row",
                        gap: spacing.md,
                      }}
                    >
                      <TouchableOpacity
                        onPress={() => speakText(displayBack)}
                        activeOpacity={0.6}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      >
                        <Volume2
                          size={20}
                          color={speaking ? colors.primary : colors.textTertiary}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={toggleStar}
                        activeOpacity={0.6}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      >
                        <Star
                          size={20}
                          color={isStarred ? colors.warning : colors.textTertiary}
                          fill={isStarred ? colors.warning : "none"}
                        />
                      </TouchableOpacity>
                    </View>
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

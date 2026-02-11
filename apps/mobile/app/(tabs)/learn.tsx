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
  runOnJS,
  Easing,
  Extrapolation,
} from "react-native-reanimated";
import {
  CheckCircle2,
  RotateCcw,
  ArrowLeftRight,
  Star,
  Volume2,
  Play,
  Pause,
  Timer,
} from "lucide-react-native";
import * as Speech from "expo-speech";
import {
  useReviewSession,
  type ReviewRating,
} from "../../src/features/review/reviewSession";
import { useSessionStore } from "../../src/store/sessionStore";
import { getDueCards, reviewCard, updateCard } from "../../src/lib/api";
import { useColors, spacing, radius, typography, shadows } from "../../src/theme";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
// Threshold: card must travel 30% of screen width to trigger a rating
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;
// Max rotation when card is at edge
const MAX_ROTATION = 15; // degrees

export default function LearnScreen() {
  const { t } = useTranslation();
  const c = useColors();
  const userId = useSessionStore((state) => state.userId);
  const { cards, index, revealed, completed, start, reveal, rateCurrent } =
    useReviewSession();
  const [loading, setLoading] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [showBackFirst, setShowBackFirst] = useState(false);
  const [starredMap, setStarredMap] = useState<Record<string, boolean>>({});

  // ─── Flip animation (independent toggle) ─────────────────────────────────
  const flipProgress = useSharedValue(0);
  const [flipped, setFlipped] = useState(false);

  // ─── Swipe: free 2D movement ─────────────────────────────────────────────
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  // ─── Entrance animation for new cards ─────────────────────────────────────
  const cardScale = useSharedValue(1);
  const cardOpacity = useSharedValue(1);

  // ─── Animated styles ─────────────────────────────────────────────────────

  // Card wrapper: translateX + translateY + rotation (Tinder-like tilt) + scale/opacity for entrance
  const cardWrapperStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
      [-MAX_ROTATION, 0, MAX_ROTATION],
      Extrapolation.CLAMP
    );
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotate}deg` },
        { scale: cardScale.value },
      ],
      opacity: cardOpacity.value,
    };
  });

  // Front face: flip only
  const frontAnimatedStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(flipProgress.value, [0, 1], [0, 180]);
    return {
      transform: [{ perspective: 1200 }, { rotateY: `${rotateY}deg` }],
      backfaceVisibility: "hidden" as const,
    };
  });

  // Back face: flip only
  const backAnimatedStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(flipProgress.value, [0, 1], [180, 360]);
    return {
      transform: [{ perspective: 1200 }, { rotateY: `${rotateY}deg` }],
      backfaceVisibility: "hidden" as const,
    };
  });

  // "NOCHMAL" label (left swipe) - centered, gradual fade-in
  const labelLeftStyle = useAnimatedStyle(() => {
    const progress = Math.abs(Math.min(translateX.value, 0)) / SWIPE_THRESHOLD;
    const opacity = interpolate(progress, [0, 0.2, 0.7, 1], [0, 0, 0.6, 1], Extrapolation.CLAMP);
    const scale = interpolate(progress, [0, 0.3, 1], [0.5, 0.8, 1.1], Extrapolation.CLAMP);
    return { opacity, transform: [{ scale }] };
  });

  // "GEMERKT" label (right swipe) - centered, gradual fade-in
  const labelRightStyle = useAnimatedStyle(() => {
    const progress = Math.abs(Math.max(translateX.value, 0)) / SWIPE_THRESHOLD;
    const opacity = interpolate(progress, [0, 0.2, 0.7, 1], [0, 0, 0.6, 1], Extrapolation.CLAMP);
    const scale = interpolate(progress, [0, 0.3, 1], [0.5, 0.8, 1.1], Extrapolation.CLAMP);
    return { opacity, transform: [{ scale }] };
  });

  // Card text fades out as card moves away from center
  const cardTextOpacity = useAnimatedStyle(() => {
    const progress = Math.abs(translateX.value) / SWIPE_THRESHOLD;
    const opacity = interpolate(progress, [0, 0.4, 1], [1, 0.7, 0], Extrapolation.CLAMP);
    return { opacity };
  });

  // ─── Reset on card change with entrance animation ──────────────────────────
  useEffect(() => {
    setFlipped(false);
    flipProgress.value = withTiming(0, { duration: 200 });
    // Reset position instantly (old card is off-screen already)
    translateX.value = 0;
    translateY.value = 0;
    // Entrance animation: scale up from small + fade in
    cardScale.value = 0.88;
    cardOpacity.value = 0;
    cardScale.value = withSpring(1, { damping: 14, stiffness: 160 });
    cardOpacity.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) });
  }, [index, flipProgress, translateX, translateY, cardScale, cardOpacity]);

  // Animate flip
  useEffect(() => {
    flipProgress.value = withTiming(flipped ? 1 : 0, {
      duration: 400,
      easing: Easing.out(Easing.cubic),
    });
  }, [flipped, flipProgress]);

  // ─── Data loading ─────────────────────────────────────────────────────────
  const loadDueCards = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { cards: due } = await getDueCards(userId);
      if (due.length > 0) {
        const starMap: Record<string, boolean> = {};
        due.forEach((card) => { starMap[card.id] = card.starred ?? false; });
        setStarredMap(starMap);
        start(due.map((card) => ({ id: card.id, front: card.front, back: card.back, starred: card.starred })));
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

  // ─── Rating handlers ──────────────────────────────────────────────────────
  const handleRate = async (rating: ReviewRating) => {
    if (!revealed) reveal();
    const result = rateCurrent(rating);
    if (!result || !userId) return;
    setReviewLoading(true);
    try {
      await reviewCard(userId, result.cardId, rating);
    } catch {
      // Review tracked locally
    } finally {
      setReviewLoading(false);
    }
  };

  const handleSwipe = (rating: ReviewRating) => {
    if (!revealed) reveal();
    handleRate(rating);
  };

  const handleFlip = () => {
    setFlipped((prev) => !prev);
    if (!revealed) reveal();
  };

  // ─── TTS ──────────────────────────────────────────────────────────────────
  const [speaking, setSpeaking] = useState(false);
  const speakText = async (text: string) => {
    if (speaking) { await Speech.stop(); setSpeaking(false); return; }
    setSpeaking(true);
    Speech.speak(text, {
      language: "de-DE",
      onDone: () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  };

  useEffect(() => { Speech.stop(); setSpeaking(false); }, [index]);

  // ─── Auto-Play ────────────────────────────────────────────────────────────
  const [autoPlaying, setAutoPlaying] = useState(false);
  const [autoPlaySpeed, setAutoPlaySpeed] = useState(3);
  const autoPlayRef = { current: null as ReturnType<typeof setTimeout> | null };

  useEffect(() => {
    if (completed && autoPlaying) setAutoPlaying(false);
  }, [completed, autoPlaying]);

  useEffect(() => {
    if (!autoPlaying || completed || cards.length === 0) return;
    const tick = () => {
      if (!autoPlaying) return;
      const { revealed: isRevealed } = useReviewSession.getState();
      if (!isRevealed) { reveal(); } else { handleRate("good"); }
    };
    autoPlayRef.current = setTimeout(tick, autoPlaySpeed * 1000);
    return () => { if (autoPlayRef.current) clearTimeout(autoPlayRef.current); };
  }, [autoPlaying, revealed, index, autoPlaySpeed, completed, cards.length]);

  useEffect(() => {
    if (!autoPlaying || !current) return;
    const text = revealed ? displayBack : frontParsed?.display ?? effectiveFront;
    if (text) Speech.speak(text, { language: "de-DE" });
    return () => { Speech.stop(); };
  }, [autoPlaying, revealed, index]);

  const toggleAutoPlay = () => {
    if (autoPlaying) { setAutoPlaying(false); Speech.stop(); } else { setAutoPlaying(true); }
  };
  const cycleSpeed = () => {
    const speeds = [1, 3, 5, 10];
    const idx = speeds.indexOf(autoPlaySpeed);
    setAutoPlaySpeed(speeds[(idx + 1) % speeds.length]!);
  };

  // ─── Star toggle ──────────────────────────────────────────────────────────
  const toggleStar = async () => {
    if (!current) return;
    const cardId = current.id;
    const newVal = !starredMap[cardId];
    setStarredMap((prev) => ({ ...prev, [cardId]: newVal }));
    try { await updateCard(cardId, { starred: newVal }); }
    catch { setStarredMap((prev) => ({ ...prev, [cardId]: !newVal })); }
  };

  // ─── Gestures ─────────────────────────────────────────────────────────────

  // Pan: free 2D drag, Quizlet-style
  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
    })
    .onEnd((e) => {
      const dist = Math.abs(e.translationX);

      if (dist > SWIPE_THRESHOLD) {
        // Past threshold → fly off screen and rate
        const isRight = e.translationX > 0;
        const flyX = isRight ? SCREEN_WIDTH * 1.5 : -SCREEN_WIDTH * 1.5;
        const flyY = e.translationY + e.velocityY * 0.2;
        const rating: ReviewRating = isRight ? "good" : "again";

        // Calculate duration based on velocity — faster swipe = faster fly-out
        const remainingDist = Math.abs(flyX - e.translationX);
        const speed = Math.max(Math.abs(e.velocityX), 800);
        const flyDuration = Math.min(Math.max((remainingDist / speed) * 1000, 200), 450);

        translateX.value = withTiming(flyX, {
          duration: flyDuration,
          easing: Easing.in(Easing.cubic),
        });
        translateY.value = withTiming(flyY, {
          duration: flyDuration,
          easing: Easing.in(Easing.cubic),
        }, () => {
          runOnJS(handleSwipe)(rating);
        });
      } else {
        // Snap back with bouncy spring (lower damping = more bounce)
        translateX.value = withSpring(0, { damping: 8, stiffness: 120, mass: 0.8 });
        translateY.value = withSpring(0, { damping: 8, stiffness: 120, mass: 0.8 });
      }
    });

  // Tap: always toggles flip
  const tapGesture = Gesture.Tap().onEnd(() => {
    runOnJS(handleFlip)();
  });

  const composedGesture = Gesture.Simultaneous(tapGesture, panGesture);

  // ─── Card content ─────────────────────────────────────────────────────────
  const current = cards[index];
  const progress = cards.length > 0 ? (index + (revealed ? 1 : 0)) / cards.length : 0;

  const formatCloze = (text: string): { display: string; clozeAnswer: string | null } => {
    const match = text.match(/\{\{c\d+::(.+?)\}\}/);
    if (!match) return { display: text, clozeAnswer: null };
    const clozeAnswer = match[1] ?? null;
    const display = text.replace(/\{\{c\d+::.+?\}\}/g, "______");
    return { display, clozeAnswer };
  };

  const rawFront = current?.front ?? "";
  const rawBack = current?.back ?? "";
  const effectiveFront = showBackFirst ? rawBack : rawFront;
  const effectiveBack = showBackFirst ? rawFront : rawBack;
  const frontParsed = formatCloze(effectiveFront);
  const displayBack = frontParsed.clozeAnswer ?? effectiveBack;
  const isStarred = current ? !!starredMap[current.id] : false;

  // ─── Rating button helper ─────────────────────────────────────────────────
  const ratingButton = (label: string, rating: ReviewRating, bgColor: string) => (
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
      <Text style={{ color: "#fff", fontWeight: typography.bold, fontSize: typography.sm }}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
        <View style={{ flex: 1, padding: spacing.lg, gap: spacing.md }}>
          {/* Header */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontSize: typography.xxl, fontWeight: typography.bold, color: c.text }}>
              {t("reviewHeadline")}
            </Text>
            {cards.length > 0 && !completed && (
              <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
                <TouchableOpacity
                  onPress={toggleAutoPlay}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: "row", alignItems: "center", gap: spacing.xs,
                    backgroundColor: autoPlaying ? c.primaryLight : c.surfaceSecondary,
                    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full,
                  }}
                >
                  {autoPlaying
                    ? <Pause size={14} color={c.primary} />
                    : <Play size={14} color={c.textTertiary} />}
                  {autoPlaying && (
                    <Text style={{ fontSize: typography.xs, fontWeight: typography.semibold, color: c.primary }}>
                      Auto
                    </Text>
                  )}
                </TouchableOpacity>
                {autoPlaying && (
                  <TouchableOpacity
                    onPress={cycleSpeed}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: "row", alignItems: "center", gap: spacing.xs,
                      backgroundColor: c.surfaceSecondary,
                      paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full,
                    }}
                  >
                    <Timer size={12} color={c.textSecondary} />
                    <Text style={{ fontSize: typography.xs, fontWeight: typography.semibold, color: c.textSecondary }}>
                      {autoPlaySpeed}s
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => setShowBackFirst((p) => !p)}
                  activeOpacity={0.7}
                  style={{
                    backgroundColor: showBackFirst ? c.primaryLight : c.surfaceSecondary,
                    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full,
                  }}
                >
                  <ArrowLeftRight size={14} color={showBackFirst ? c.primary : c.textTertiary} />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {loading ? (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
              <ActivityIndicator size="large" color={c.primary} />
              <Text style={{ marginTop: spacing.md, color: c.textSecondary, fontSize: typography.base }}>
                Fällige Karten laden...
              </Text>
            </View>
          ) : completed || cards.length === 0 ? (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: spacing.lg }}>
              <View style={{
                width: 72, height: 72, borderRadius: 36,
                backgroundColor: cards.length === 0 ? c.surfaceSecondary : c.successLight,
                justifyContent: "center", alignItems: "center",
              }}>
                <CheckCircle2 size={36} color={cards.length === 0 ? c.textTertiary : c.success} />
              </View>
              <Text style={{ fontSize: typography.xl, fontWeight: typography.semibold, textAlign: "center", color: c.text }}>
                {cards.length === 0 ? "Keine fälligen Karten" : "Session abgeschlossen!"}
              </Text>
              <Text style={{ color: c.textSecondary, textAlign: "center", fontSize: typography.base }}>
                {cards.length === 0 ? "Scanne einen Text, um Flashcards zu generieren." : `${cards.length} Karten gelernt.`}
              </Text>
              <TouchableOpacity
                onPress={loadDueCards}
                activeOpacity={0.8}
                style={{
                  backgroundColor: c.primary, borderRadius: radius.md,
                  paddingHorizontal: spacing.xxl, paddingVertical: 14,
                  flexDirection: "row", gap: spacing.sm, alignItems: "center",
                }}
              >
                <RotateCcw size={18} color="#fff" />
                <Text style={{ color: "#fff", fontWeight: typography.semibold, fontSize: typography.base }}>
                  Neu laden
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ flex: 1, gap: spacing.md }}>
              {/* Progress */}
              <View style={{ gap: spacing.xs }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: c.textSecondary, fontSize: typography.sm, fontWeight: typography.medium }}>
                    Karte {index + 1} von {cards.length}
                  </Text>
                  <Text style={{ color: c.textTertiary, fontSize: typography.sm }}>
                    {Math.round(progress * 100)}%
                  </Text>
                </View>
                <View style={{ height: 4, backgroundColor: c.surfaceSecondary, borderRadius: 2, overflow: "hidden" }}>
                  <View style={{
                    height: "100%", width: `${Math.max(progress * 100, 2)}%`,
                    backgroundColor: progress >= 1 ? c.success : c.primary, borderRadius: 2,
                  }} />
                </View>
              </View>

              {/* Card area */}
              <View style={{ flex: 1, position: "relative" }}>
                {/* Draggable card wrapper */}
                <GestureDetector gesture={composedGesture}>
                  <Animated.View
                    style={[
                      cardWrapperStyle,
                      { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 5 },
                    ]}
                  >
                    {/* "NOCHMAL" label - centered on card, fades in on left swipe */}
                    <Animated.View
                      style={[
                        labelLeftStyle,
                        {
                          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                          zIndex: 30, justifyContent: "center", alignItems: "center",
                          backgroundColor: "rgba(239,68,68,0.85)",
                          borderRadius: radius.xl,
                        },
                      ]}
                      pointerEvents="none"
                    >
                      <Text style={{ color: "#fff", fontWeight: typography.extrabold, fontSize: 32, letterSpacing: 2 }}>
                        NOCHMAL
                      </Text>
                    </Animated.View>

                    {/* "GEMERKT" label - centered on card, fades in on right swipe */}
                    <Animated.View
                      style={[
                        labelRightStyle,
                        {
                          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                          zIndex: 30, justifyContent: "center", alignItems: "center",
                          backgroundColor: "rgba(16,185,129,0.85)",
                          borderRadius: radius.xl,
                        },
                      ]}
                      pointerEvents="none"
                    >
                      <Text style={{ color: "#fff", fontWeight: typography.extrabold, fontSize: 32, letterSpacing: 2 }}>
                        GEMERKT
                      </Text>
                    </Animated.View>

                    {/* Front face */}
                    <Animated.View
                      style={[
                        frontAnimatedStyle,
                        {
                          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                          backgroundColor: c.surface, borderRadius: radius.xl,
                          padding: spacing.xxl, justifyContent: "center", alignItems: "center",
                          borderWidth: 1, borderColor: c.border, ...shadows.lg,
                        },
                      ]}
                    >
                      {/* Action buttons (always visible) */}
                      <View style={{
                        position: "absolute", top: spacing.md, right: spacing.md,
                        zIndex: 35, flexDirection: "row", gap: spacing.md,
                      }}>
                        <TouchableOpacity onPress={() => speakText(effectiveFront)} activeOpacity={0.6} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                          <Volume2 size={20} color={speaking ? c.primary : c.textTertiary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={toggleStar} activeOpacity={0.6} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                          <Star size={20} color={isStarred ? c.warning : c.textTertiary} fill={isStarred ? c.warning : "none"} />
                        </TouchableOpacity>
                      </View>
                      {/* Text content fades out on swipe */}
                      <Animated.View style={[cardTextOpacity, { alignItems: "center" }]}>
                        <Text style={{
                          fontSize: typography.xl, fontWeight: typography.semibold,
                          textAlign: "center", color: c.text, lineHeight: 30,
                        }}>
                          {frontParsed.display}
                        </Text>
                        {!revealed && (
                          <Text style={{ marginTop: spacing.xl, color: c.textTertiary, fontSize: typography.sm }}>
                            Tippen zum Umdrehen
                          </Text>
                        )}
                      </Animated.View>
                    </Animated.View>

                    {/* Back face */}
                    <Animated.View
                      style={[
                        backAnimatedStyle,
                        {
                          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                          backgroundColor: c.surface, borderRadius: radius.xl,
                          padding: spacing.xxl, justifyContent: "center", alignItems: "center",
                          borderWidth: 1.5, borderColor: c.primary, ...shadows.lg,
                        },
                      ]}
                    >
                      <View style={{
                        position: "absolute", top: spacing.md, right: spacing.md,
                        zIndex: 35, flexDirection: "row", gap: spacing.md,
                      }}>
                        <TouchableOpacity onPress={() => speakText(displayBack)} activeOpacity={0.6} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                          <Volume2 size={20} color={speaking ? c.primary : c.textTertiary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={toggleStar} activeOpacity={0.6} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                          <Star size={20} color={isStarred ? c.warning : c.textTertiary} fill={isStarred ? c.warning : "none"} />
                        </TouchableOpacity>
                      </View>
                      {/* Text content fades out on swipe */}
                      <Animated.View style={[cardTextOpacity, { alignItems: "center" }]}>
                        <Text style={{
                          fontSize: typography.xl,
                          fontWeight: frontParsed.clozeAnswer ? typography.bold : typography.normal,
                          textAlign: "center", color: c.text, lineHeight: 30,
                        }}>
                          {displayBack}
                        </Text>
                      </Animated.View>
                    </Animated.View>
                  </Animated.View>
                </GestureDetector>
              </View>

              {/* Swipe hint */}
              <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: spacing.sm }}>
                <Text style={{ fontSize: typography.xs, color: c.ratingAgain, fontWeight: typography.medium }}>
                  ← Nochmal
                </Text>
                <Text style={{ fontSize: typography.xs, color: c.textTertiary }}>
                  wischen oder tippen
                </Text>
                <Text style={{ fontSize: typography.xs, color: c.ratingGood, fontWeight: typography.medium }}>
                  Gemerkt →
                </Text>
              </View>

              {/* Rating buttons */}
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                {ratingButton("Nochmal", "again", c.ratingAgain)}
                {ratingButton("Schwer", "hard", c.ratingHard)}
                {ratingButton("Gut", "good", c.ratingGood)}
                {ratingButton("Leicht", "easy", c.ratingEasy)}
              </View>
            </View>
          )}
        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

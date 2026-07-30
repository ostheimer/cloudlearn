import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { Dimensions, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { ArrowLeft, Info, RotateCcw, Trophy } from "lucide-react-native";
import {
  DEMO_CARDS,
  countKnownDemoRatings,
  demoResultBody,
  demoResultTitle,
} from "../src/features/demo/demoDeck";
import type { ReviewRating } from "../src/features/review/reviewSession";
import { useColors, spacing, radius, typography, shadows } from "../src/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;
const MAX_ROTATION = 15;

const RATINGS: { key: ReviewRating; label: string; tint: "error" | "warning" | "success" }[] = [
  { key: "again", label: "Nochmal", tint: "error" },
  { key: "hard", label: "Schwer", tint: "warning" },
  { key: "good", label: "Gut", tint: "success" },
  { key: "easy", label: "Leicht", tint: "success" },
];

/**
 * Drei Karten zum Ausprobieren, ohne Konto (#609, Laras Entscheidung).
 *
 * Bewusst ein eigener, kleiner Bildschirm statt des echten Lern-Bildschirms:
 * der lädt fällige Karten vom Server, schreibt Bewertungen, verbucht
 * Lernpunkte, führt eine Offline-Warteschlange und merkt sich den Stand — all
 * das setzt ein Konto voraus. Ihn dafür umzubauen hieße, den wichtigsten
 * Bildschirm der App für einen Drei-Karten-Vorgeschmack anzufassen. Hier
 * passiert dagegen nichts als Anschauen: alles bleibt im Speicher dieses
 * Bildschirms, es geht keine einzige Anfrage nach draußen.
 *
 * Die Bedienung ist absichtlich dieselbe wie im echten Lernen: Tippen dreht
 * die Karte, nach links wischen heißt „Nochmal", nach rechts „Gewusst", und
 * die vier Knöpfe heißen wie dort.
 */
export default function DemoScreen() {
  const router = useRouter();
  const c = useColors();

  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [ratings, setRatings] = useState<ReviewRating[]>([]);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const flipProgress = useSharedValue(0);
  const cardOpacity = useSharedValue(1);

  const done = index >= DEMO_CARDS.length;
  const current = DEMO_CARDS[index];

  useEffect(() => {
    setFlipped(false);
    flipProgress.value = withTiming(0, { duration: 200 });
    translateX.value = 0;
    translateY.value = 0;
    cardOpacity.value = 0;
    cardOpacity.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) });
  }, [index, flipProgress, translateX, translateY, cardOpacity]);

  const handleFlip = () => {
    setFlipped((prev) => {
      flipProgress.value = withTiming(prev ? 0 : 1, { duration: 320 });
      return !prev;
    });
  };

  const rate = (rating: ReviewRating) => {
    setRatings((prev) => [...prev, rating]);
    setIndex((prev) => prev + 1);
  };

  const restart = () => {
    setRatings([]);
    setIndex(0);
  };

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
      ],
      opacity: cardOpacity.value,
    };
  });

  const frontAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1200 },
      { rotateY: `${interpolate(flipProgress.value, [0, 1], [0, 180])}deg` },
    ],
    backfaceVisibility: "hidden" as const,
  }));

  const backAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1200 },
      { rotateY: `${interpolate(flipProgress.value, [0, 1], [180, 360])}deg` },
    ],
    backfaceVisibility: "hidden" as const,
  }));

  const labelLeftStyle = useAnimatedStyle(() => {
    const progress = Math.abs(Math.min(translateX.value, 0)) / SWIPE_THRESHOLD;
    return {
      opacity: interpolate(progress, [0, 0.2, 0.7, 1], [0, 0, 0.6, 1], Extrapolation.CLAMP),
    };
  });

  const labelRightStyle = useAnimatedStyle(() => {
    const progress = Math.abs(Math.max(translateX.value, 0)) / SWIPE_THRESHOLD;
    return {
      opacity: interpolate(progress, [0, 0.2, 0.7, 1], [0, 0, 0.6, 1], Extrapolation.CLAMP),
    };
  });

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
    })
    .onEnd((e) => {
      if (Math.abs(e.translationX) > SWIPE_THRESHOLD) {
        const isRight = e.translationX > 0;
        const flyX = isRight ? SCREEN_WIDTH * 1.6 : -SCREEN_WIDTH * 1.6;
        // Wie im echten Lernen: rechts = „Gut", links = „Nochmal".
        const rating: ReviewRating = isRight ? "good" : "again";
        translateX.value = withTiming(
          flyX,
          { duration: 420, easing: Easing.out(Easing.cubic) },
          () => {
            runOnJS(rate)(rating);
          }
        );
        return;
      }
      translateX.value = withSpring(0, { damping: 8, stiffness: 35, mass: 1.6 });
      translateY.value = withSpring(0, { damping: 8, stiffness: 35, mass: 1.6 });
    });

  const tapGesture = Gesture.Tap().onEnd(() => {
    runOnJS(handleFlip)();
  });

  const composedGesture = Gesture.Simultaneous(panGesture, tapGesture);

  const known = countKnownDemoRatings(ratings);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
        <View style={{ flex: 1, padding: spacing.xl, gap: spacing.lg }}>
          {/* Kopfzeile */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <TouchableOpacity
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Zurück"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <ArrowLeft size={22} color={c.text} />
            </TouchableOpacity>
            <Text
              style={{
                flex: 1,
                fontSize: typography.lg,
                fontWeight: typography.bold,
                color: c.text,
              }}
            >
              Zum Ausprobieren
            </Text>
            {!done && (
              <Text style={{ fontSize: typography.sm, color: c.textTertiary }}>
                {index + 1} von {DEMO_CARDS.length}
              </Text>
            )}
          </View>

          {/* Ehrlicher Hinweis — die Zusage, die der Gast-Einstieg vorher brach */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              gap: spacing.sm,
              backgroundColor: c.surfaceSecondary,
              borderRadius: radius.md,
              padding: spacing.md,
            }}
          >
            <Info size={16} color={c.textSecondary} />
            <Text style={{ flex: 1, fontSize: typography.sm, color: c.textSecondary, lineHeight: 20 }}>
              Beispielkarten ohne Konto. Nichts davon wird gespeichert.
            </Text>
          </View>

          {done ? (
            <View style={{ flex: 1, justifyContent: "center", gap: spacing.lg }}>
              <View style={{ alignItems: "center", gap: spacing.md }}>
                <Trophy size={48} color={c.primary} />
                <Text
                  style={{
                    fontSize: typography.xxl,
                    fontWeight: typography.extrabold,
                    color: c.text,
                    textAlign: "center",
                  }}
                >
                  {demoResultTitle(known, ratings.length)}
                </Text>
                <Text
                  style={{
                    fontSize: typography.base,
                    color: c.textSecondary,
                    textAlign: "center",
                    lineHeight: 24,
                  }}
                >
                  {demoResultBody(known, ratings.length)}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => router.push("/auth")}
                activeOpacity={0.8}
                style={{
                  backgroundColor: c.primary,
                  borderRadius: radius.md,
                  paddingVertical: 16,
                  alignItems: "center",
                  ...shadows.md,
                }}
              >
                <Text
                  style={{
                    color: c.textInverse,
                    fontSize: typography.lg,
                    fontWeight: typography.bold,
                  }}
                >
                  Konto anlegen
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={restart}
                activeOpacity={0.8}
                style={{
                  borderWidth: 1,
                  borderColor: c.border,
                  borderRadius: radius.md,
                  paddingVertical: 14,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: spacing.sm,
                }}
              >
                <RotateCcw size={16} color={c.textSecondary} />
                <Text
                  style={{
                    color: c.textSecondary,
                    fontSize: typography.base,
                    fontWeight: typography.semibold,
                  }}
                >
                  Nochmal ausprobieren
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Karte */}
              <View style={{ flex: 1, minHeight: 260 }}>
                <GestureDetector gesture={composedGesture}>
                  <Animated.View
                    style={[
                      cardWrapperStyle,
                      { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
                    ]}
                  >
                    <Animated.View
                      style={[
                        labelLeftStyle,
                        {
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          zIndex: 30,
                          justifyContent: "center",
                          alignItems: "center",
                          backgroundColor: "rgba(239,68,68,0.85)",
                          borderRadius: radius.xl,
                        },
                      ]}
                      pointerEvents="none"
                    >
                      <Text
                        style={{
                          color: "#fff",
                          fontWeight: typography.extrabold,
                          fontSize: 30,
                          letterSpacing: 2,
                        }}
                      >
                        NOCHMAL
                      </Text>
                    </Animated.View>

                    <Animated.View
                      style={[
                        labelRightStyle,
                        {
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          zIndex: 30,
                          justifyContent: "center",
                          alignItems: "center",
                          backgroundColor: "rgba(16,185,129,0.85)",
                          borderRadius: radius.xl,
                        },
                      ]}
                      pointerEvents="none"
                    >
                      <Text
                        style={{
                          color: "#fff",
                          fontWeight: typography.extrabold,
                          fontSize: 30,
                          letterSpacing: 2,
                        }}
                      >
                        GEWUSST
                      </Text>
                    </Animated.View>

                    <Animated.View
                      style={[
                        frontAnimatedStyle,
                        {
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          backgroundColor: c.surface,
                          borderRadius: radius.xl,
                          padding: spacing.xxl,
                          justifyContent: "center",
                          alignItems: "center",
                          borderWidth: 1,
                          borderColor: c.border,
                          ...shadows.lg,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          position: "absolute",
                          top: spacing.lg,
                          left: spacing.xl,
                          right: spacing.xl,
                          textAlign: "center",
                          fontSize: typography.xs,
                          fontWeight: typography.semibold,
                          color: c.textTertiary,
                        }}
                      >
                        {current?.subject}
                      </Text>
                      <Text
                        style={{
                          fontSize: typography.xl,
                          fontWeight: typography.bold,
                          color: c.text,
                          textAlign: "center",
                        }}
                      >
                        {current?.front}
                      </Text>
                      <Text
                        style={{
                          position: "absolute",
                          bottom: spacing.lg,
                          fontSize: typography.xs,
                          color: c.textTertiary,
                        }}
                      >
                        Tippen zum Umdrehen
                      </Text>
                    </Animated.View>

                    <Animated.View
                      style={[
                        backAnimatedStyle,
                        {
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          backgroundColor: c.surface,
                          borderRadius: radius.xl,
                          padding: spacing.xxl,
                          justifyContent: "center",
                          alignItems: "center",
                          borderWidth: 1,
                          borderColor: c.border,
                          ...shadows.lg,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: typography.lg,
                          color: c.text,
                          textAlign: "center",
                          lineHeight: 28,
                        }}
                      >
                        {current?.back}
                      </Text>
                    </Animated.View>
                  </Animated.View>
                </GestureDetector>
              </View>

              {/* Bewertung — wie im echten Lernen erst nach dem Umdrehen */}
              {flipped ? (
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  {RATINGS.map((r) => (
                    <TouchableOpacity
                      key={r.key}
                      onPress={() => rate(r.key)}
                      activeOpacity={0.8}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        backgroundColor:
                          r.tint === "error"
                            ? c.errorLight
                            : r.tint === "warning"
                              ? c.warningLight
                              : c.successLight,
                        borderRadius: radius.md,
                        paddingVertical: 14,
                        alignItems: "center",
                      }}
                    >
                      <Text
                        numberOfLines={1}
                        style={{
                          fontSize: typography.sm,
                          fontWeight: typography.bold,
                          color:
                            r.tint === "error"
                              ? c.error
                              : r.tint === "warning"
                                ? c.warning
                                : c.success,
                        }}
                      >
                        {r.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <Text
                  style={{
                    textAlign: "center",
                    fontSize: typography.sm,
                    color: c.textTertiary,
                    paddingVertical: 14,
                  }}
                >
                  Nach links wischen heißt „Nochmal", nach rechts „Gewusst".
                </Text>
              )}
            </>
          )}
        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

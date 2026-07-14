import { useCallback, useRef, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { CheckCircle2, RotateCcw } from "lucide-react-native";
import {
  useReviewSession,
  type ReviewRating,
} from "../src/features/review/reviewSession";
import { useSessionStore } from "../src/store/sessionStore";
import { useUsageStore } from "../src/store/usageStore";
import { earnLp, isApiError, reviewCard } from "../src/lib/api";
import {
  createReviewSyncOperation,
  useOfflineQueueStore,
} from "../src/features/sync/offlineQueueStore";
import { summarizeCardMedia } from "../src/lib/cardMedia";
import { cleanTerm } from "../src/lib/cardTerms";
import { useColors, spacing, radius, typography, shadows } from "../src/theme";

// Schlanke Karteikarten-Runde für eine vorbereitete Karten-Auswahl (#246,
// "Wackelkandidaten üben"). Die Karten kommen aus dem Review-Session-Store
// (start([...]) vor dem Navigieren) — dieser Screen lädt selbst nichts nach,
// darum kann er beliebige Teilmengen üben. Bewertungen laufen über dieselbe
// Review-API wie der Lern-Screen (inkl. Offline-Queue und LP beim Verlassen),
// sodass die Statistik das Üben sofort mitbekommt.
export default function PracticeScreen() {
  const { title } = useLocalSearchParams<{ title?: string }>();
  const router = useRouter();
  const c = useColors();
  const userId = useSessionStore((s) => s.userId);
  const {
    cards,
    index,
    revealed,
    completed,
    swipedLeft,
    swipedRight,
    start,
    reveal,
    rateCurrent,
  } = useReviewSession();
  const enqueueOfflineReview = useOfflineQueueStore((s) => s.enqueue);
  const setUsage = useUsageStore((s) => s.setUsage);
  const [saveError, setSaveError] = useState(false);
  // Disables the rating buttons while a review is being submitted, so rapid
  // taps can't rate the next (still unseen) cards. Mirrors the learn screen.
  const [reviewLoading, setReviewLoading] = useState(false);

  // Cards rated since the last LP earn call — the server derives the actual
  // grant from recorded reviews (replay-safe), like on the learn screen.
  const reviewedSinceEarnRef = useRef(0);

  const collectSessionLp = useCallback(async () => {
    if (reviewedSinceEarnRef.current === 0 || !userId) return;
    reviewedSinceEarnRef.current = 0; // reset first so a re-entrant blur can't double-fire
    try {
      const result = await earnLp("session");
      if (result.granted > 0) {
        setUsage({ lpBalance: result.newBalance });
      }
    } catch {
      // LP earn is best-effort
    }
  }, [userId, setUsage]);

  useFocusEffect(
    useCallback(() => {
      // Cleanup runs on blur — the moment the practice round ends.
      return () => {
        void collectSessionLp();
      };
    }, [collectSessionLp])
  );

  const handleRate = async (rating: ReviewRating) => {
    if (!revealed) reveal();
    const result = rateCurrent(rating);
    if (!result || !userId) return;
    reviewedSinceEarnRef.current += 1;
    const queuedReview = createReviewSyncOperation({
      userId,
      cardId: result.cardId,
      rating,
    });
    setReviewLoading(true);
    setSaveError(false);
    try {
      await reviewCard(userId, result.cardId, rating, queuedReview.payload);
    } catch (error) {
      if (!isApiError(error) || error.status >= 500) {
        // Offline / server error: keep the review for a later retry via the queue.
        enqueueOfflineReview(queuedReview);
      } else {
        // 4xx: surface it instead of dropping the answer silently.
        setSaveError(true);
      }
    } finally {
      setReviewLoading(false);
    }
  };

  // ─── Card content (same lightweight pipeline as the learn screen) ────────
  const current = cards[index];
  const formatCloze = (text: string): { display: string; clozeAnswer: string | null } => {
    const match = text.match(/\{\{c\d+::(.+?)\}\}/);
    if (!match) return { display: text, clozeAnswer: null };
    const clozeAnswer = match[1] ?? null;
    const display = text.replace(/\{\{c\d+::.+?\}\}/g, "______");
    return { display, clozeAnswer };
  };
  const mediaSummary = summarizeCardMedia({
    front: current?.front ?? "",
    back: current?.back ?? "",
  });
  const normalizedFront = cleanTerm(mediaSummary.plainFront || (current?.front ?? ""));
  const normalizedBack = cleanTerm(mediaSummary.plainBack || (current?.back ?? ""));
  const frontParsed = formatCloze(normalizedFront);
  const displayFront =
    frontParsed.display || mediaSummary.primaryImage?.alt || "Bildkarte";
  const displayBack =
    frontParsed.clozeAnswer ?? (normalizedBack || mediaSummary.primaryImage?.alt || "—");

  const progress =
    cards.length > 0 ? (index + (revealed ? 1 : 0)) / cards.length : 0;

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
      <Text
        style={{
          color: "#fff",
          fontWeight: typography.bold,
          fontSize: typography.sm,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: title ?? "Üben",
          headerBackTitle: "Zurück",
          headerTintColor: c.primary,
          headerStyle: { backgroundColor: c.background },
        }}
      />
      <SafeAreaView
        edges={["bottom"]}
        style={{ flex: 1, backgroundColor: c.background }}
      >
        <View style={{ flex: 1, padding: spacing.lg, gap: spacing.md }}>
          {cards.length === 0 ? (
            <View
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
                gap: spacing.lg,
              }}
            >
              <Text
                style={{
                  fontSize: typography.lg,
                  color: c.textSecondary,
                  textAlign: "center",
                }}
              >
                Keine Karten zum Üben.
              </Text>
              <TouchableOpacity
                onPress={() => router.back()}
                activeOpacity={0.8}
                style={{
                  backgroundColor: c.primary,
                  borderRadius: radius.md,
                  paddingHorizontal: spacing.xxl,
                  paddingVertical: 14,
                }}
              >
                <Text
                  style={{
                    color: "#fff",
                    fontWeight: typography.semibold,
                    fontSize: typography.base,
                  }}
                >
                  Zurück
                </Text>
              </TouchableOpacity>
            </View>
          ) : completed ? (
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
                  backgroundColor: c.successLight,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <CheckCircle2 size={36} color={c.success} />
              </View>
              <Text
                style={{
                  fontSize: typography.xl,
                  fontWeight: typography.semibold,
                  textAlign: "center",
                  color: c.text,
                }}
              >
                Runde geschafft!
              </Text>
              <Text
                style={{
                  color: c.textSecondary,
                  textAlign: "center",
                  fontSize: typography.base,
                }}
              >
                {swipedRight} gemerkt · {swipedLeft} nochmal
              </Text>
              <TouchableOpacity
                onPress={() => start(cards)}
                activeOpacity={0.8}
                style={{
                  backgroundColor: c.primary,
                  borderRadius: radius.md,
                  paddingHorizontal: spacing.xxl,
                  paddingVertical: 14,
                  flexDirection: "row",
                  gap: spacing.sm,
                  alignItems: "center",
                }}
              >
                <RotateCcw size={18} color="#fff" />
                <Text
                  style={{
                    color: "#fff",
                    fontWeight: typography.semibold,
                    fontSize: typography.base,
                  }}
                >
                  Nochmal üben
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.back()}
                activeOpacity={0.8}
                style={{
                  paddingHorizontal: spacing.xxl,
                  paddingVertical: spacing.sm,
                }}
              >
                <Text
                  style={{
                    color: c.textSecondary,
                    fontWeight: typography.semibold,
                    fontSize: typography.base,
                  }}
                >
                  Fertig
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ flex: 1, gap: spacing.md }}>
              {/* Progress */}
              <View style={{ gap: spacing.xs }}>
                <Text
                  style={{
                    color: c.textSecondary,
                    fontSize: typography.sm,
                    fontWeight: typography.medium,
                    textAlign: "center",
                  }}
                >
                  Karte {index + 1} von {cards.length}
                </Text>
                <View
                  style={{
                    height: 4,
                    backgroundColor: c.surfaceSecondary,
                    borderRadius: 2,
                    overflow: "hidden",
                  }}
                >
                  <View
                    style={{
                      height: "100%",
                      width: `${Math.max(progress * 100, 2)}%`,
                      backgroundColor: progress >= 1 ? c.success : c.primary,
                      borderRadius: 2,
                    }}
                  />
                </View>
              </View>

              {/* Card: tap to flip */}
              <TouchableOpacity
                onPress={() => {
                  if (!revealed) reveal();
                }}
                activeOpacity={0.9}
                style={{
                  flex: 1,
                  backgroundColor: c.surface,
                  borderRadius: radius.xl,
                  padding: spacing.xxl,
                  justifyContent: "center",
                  alignItems: "center",
                  borderWidth: revealed ? 1.5 : 1,
                  borderColor: revealed ? c.primary : c.border,
                  ...shadows.lg,
                }}
              >
                <View style={{ alignItems: "center", gap: spacing.md }}>
                  {revealed ? (
                    <>
                      <Text
                        style={{
                          fontSize: typography.sm,
                          color: c.textTertiary,
                          textAlign: "center",
                        }}
                        numberOfLines={2}
                      >
                        {displayFront}
                      </Text>
                      <Text
                        style={{
                          fontSize: typography.xxl,
                          fontWeight: frontParsed.clozeAnswer
                            ? typography.bold
                            : typography.normal,
                          textAlign: "center",
                          color: c.text,
                          lineHeight: 36,
                        }}
                      >
                        {displayBack}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text
                        style={{
                          fontSize: typography.xxl,
                          fontWeight: typography.semibold,
                          textAlign: "center",
                          color: c.text,
                          lineHeight: 36,
                        }}
                      >
                        {displayFront}
                      </Text>
                      <Text
                        style={{
                          marginTop: spacing.xl,
                          color: c.textTertiary,
                          fontSize: typography.base,
                        }}
                      >
                        Tippen zum Umdrehen
                      </Text>
                    </>
                  )}
                </View>
              </TouchableOpacity>

              {/* Non-blocking notice when a review couldn't be saved */}
              {saveError ? (
                <TouchableOpacity
                  onPress={() => setSaveError(false)}
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: c.errorLight,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: c.error,
                    paddingVertical: spacing.sm,
                    paddingHorizontal: spacing.md,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.sm,
                  }}
                >
                  <Text
                    style={{
                      flex: 1,
                      color: c.error,
                      fontSize: typography.sm,
                      fontWeight: typography.medium,
                    }}
                  >
                    Antwort konnte nicht gespeichert werden.
                  </Text>
                  <Text
                    style={{
                      color: c.error,
                      fontSize: typography.xs,
                      fontWeight: typography.semibold,
                    }}
                  >
                    Schließen
                  </Text>
                </TouchableOpacity>
              ) : null}

              {/* Rating buttons (identisch zum Lern-Screen) */}
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
    </>
  );
}

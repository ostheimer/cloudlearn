import { useCallback, useMemo, useRef, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { StudyResult } from "../src/components/StudyResult";
import {
  useReviewSession,
  missedCardsFrom,
  type ReviewRating,
} from "../src/features/review/reviewSession";
import { useSessionStore } from "../src/store/sessionStore";
import { useUsageStore } from "../src/store/usageStore";
import { earnLp, reviewCard } from "../src/lib/api";
import {
  createReviewSyncOperation,
  useOfflineQueueStore,
} from "../src/features/sync/offlineQueueStore";
import { summarizeCardMedia } from "../src/lib/cardMedia";
import { cleanTerm } from "../src/lib/cardTerms";
import { useDisplayName } from "../src/lib/useDisplayName";
import { useColors, spacing, radius, typography, shadows } from "../src/theme";
import { shouldRetryLater } from "../src/features/sync/sendReview";
import {
  beginSessionAward,
  getSessionReviewedCount,
  isSessionEarnFinalized,
  type SessionAwardState,
} from "../src/lib/learn-session-lp";

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
  const displayName = useDisplayName();
  const {
    cards,
    index,
    revealed,
    completed,
    history,
    ratingHistory,
    start,
    reveal,
    rateCurrent,
  } = useReviewSession();

  // Not-known cards this round (last rating "again") — for the result summary
  // and the "only the missed ones" button. Same helper as the flashcard screen.
  const missedCards = useMemo(
    () => missedCardsFrom(cards, history, ratingHistory),
    [cards, history, ratingHistory],
  );
  const knownCount = Math.max(0, cards.length - missedCards.length);
  const enqueueOfflineReview = useOfflineQueueStore((s) => s.enqueue);
  const setUsage = useUsageStore((s) => s.setUsage);
  const [saveError, setSaveError] = useState(false);
  // Disables the rating buttons while a review is being submitted, so rapid
  // taps can't rate the next (still unseen) cards. Mirrors the learn screen.
  const [reviewLoading, setReviewLoading] = useState(false);

  const awardStateRef = useRef<SessionAwardState>({ finalized: false, inFlight: null });
  const pendingReviewsRef = useRef<Promise<unknown>[]>([]);
  const sessionReviewsRef = useRef(0);

  const awardSession = useCallback(
    (reviewedCount: number) => {
      const state = awardStateRef.current;
      return beginSessionAward(state, reviewedCount, async () => {
        const maxAttempts = 3;
        const retryDelayMs = 250;

        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
          if (attempt > 0) {
            await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
          }

          const pendingReviews = pendingReviewsRef.current;
          pendingReviewsRef.current = [];
          await Promise.allSettled(pendingReviews);

          try {
            const result = await earnLp("session", reviewedCount);
            if (result.granted > 0) {
              setUsage({ lpBalance: result.newBalance });
            }
            if (isSessionEarnFinalized(result, reviewedCount)) {
              state.finalized = true;
              break;
            }
          } catch {
            // LP earn is best-effort
          }
        }
      });
    },
    [setUsage],
  );

  useFocusEffect(
    useCallback(() => {
      awardStateRef.current = { finalized: false, inFlight: null };
      pendingReviewsRef.current = [];
      sessionReviewsRef.current = 0;

      return () => {
        void (async () => {
          const reviewedCount = getSessionReviewedCount(
            sessionReviewsRef.current,
            pendingReviewsRef.current.length,
          );
          await awardSession(reviewedCount);
        })();
      };
    }, [awardSession]),
  );

  const handleRate = async (rating: ReviewRating) => {
    if (!revealed) reveal();
    const result = rateCurrent(rating);
    if (!result || !userId) return;
    sessionReviewsRef.current += 1;
    const queuedReview = createReviewSyncOperation({
      userId,
      cardId: result.cardId,
      rating,
      mode: "practice",
    });
    setReviewLoading(true);
    setSaveError(false);
    const reviewPromise = reviewCard(userId, result.cardId, rating, queuedReview.payload).catch(
      (error) => {
        if (shouldRetryLater(error)) {
          // Offline / server error: keep the review for a later retry via the queue.
          enqueueOfflineReview(queuedReview);
        } else {
          // 4xx: surface it instead of dropping the answer silently.
          setSaveError(true);
        }
      },
    );
    pendingReviewsRef.current.push(reviewPromise);
    try {
      await reviewPromise;
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
            <StudyResult
              headline={`Runde geschafft${displayName ? `, ${displayName}` : ""}!`}
              subtitle={`Du hast ${cards.length} ${
                cards.length === 1 ? "Karte" : "Karten"
              } wiederholt — ${knownCount} davon sicher gewusst.`}
              actions={[
                ...(missedCards.length > 0
                  ? [
                      {
                        label: `Nur die nicht gewussten (${missedCards.length})`,
                        onPress: () => start(missedCards),
                        variant: "primary" as const,
                      },
                    ]
                  : []),
                {
                  label: "Alle nochmal",
                  onPress: () => start(cards),
                  variant: missedCards.length > 0 ? ("secondary" as const) : ("primary" as const),
                  reload: true,
                },
                { label: "Fertig", onPress: () => router.back(), variant: "ghost" as const },
              ]}
            />
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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Dimensions,
  Image,
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
  ArrowLeft,
  ArrowLeftRight,
  Star,
  Trophy,
  Volume2,
  Play,
  Pause,
  Timer,
} from "lucide-react-native";
import * as Speech from "expo-speech";
import {
  useReviewSession,
  missedCardsFrom,
  GLOBAL_OWNER,
  type ReviewRating,
} from "../../src/features/review/reviewSession";
import { decideOnLearnFocus } from "../../src/features/review/learnFocusDecision";
import { createReviewSendBuffer } from "../../src/features/review/reviewSendBuffer";
import { useSessionStore } from "../../src/store/sessionStore";
import {
  earnLp,
  getDueCards,
  getStats,
  listCardsInDeck,
  reviewCard,
  updateCard,
} from "../../src/lib/api";
import { setLastUsedDeck } from "../../src/lib/lastUsedDeck";
import { useDisplayName } from "../../src/lib/useDisplayName";
import { useUsageStore } from "../../src/store/usageStore";
import { excludeOcclusionCards } from "../../src/lib/occlusion";
import {
  clearSessionProgress,
  saveSessionProgress,
} from "../../src/features/review/sessionProgress";
import { summarizeCardMedia } from "../../src/lib/cardMedia";
import { cleanTerm } from "../../src/lib/cardTerms";
import { useColors, spacing, radius, typography, shadows } from "../../src/theme";
import { useMilestoneToast } from "../../src/features/milestones/useMilestoneToast";
import { MilestoneToastView } from "../../src/components/MilestoneToast";
import { MilestoneCelebration } from "../../src/components/MilestoneCelebration";
import {
  createReviewSyncOperation,
  syncPendingReviewOperations,
  useOfflineQueueStore,
} from "../../src/features/sync/offlineQueueStore";
import { AuthPromptCard } from "../../src/components/AuthPromptCard";
import { shouldRetryLater } from "../../src/features/sync/sendReview";
import {
  filterBySource,
  type CardSource,
} from "../../src/components/cardSourcePicker";
import {
  beginSessionAward,
  getSessionReviewedCount,
  isSessionEarnFinalized,
  type SessionAwardState,
} from "../../src/lib/learn-session-lp";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
// Threshold: card must travel 30% of screen width to trigger a rating
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;
// Max rotation when card is at edge
const MAX_ROTATION = 15; // degrees

// Props are optional: as a tab, this screen learns all globally-due cards.
// When rendered from the /deck-review route with a deckId, it learns every
// card of that single deck instead.
export default function LearnScreen({
  deckId,
  deckTitle,
  initialShowBackFirst,
  source,
  wobblyIds,
  initialIndex,
}: {
  deckId?: string | undefined;
  deckTitle?: string | undefined;
  // Deck mode: ask back → front from the start (chosen on the setup screen).
  initialShowBackFirst?: boolean | undefined;
  // Deck mode: which subset of the deck to study (chosen on the setup screen).
  source?: CardSource | undefined;
  // Deck mode: ids of the deck's wobbly cards, powering the "wobbly" source.
  wobblyIds?: string[] | undefined;
  // Deck mode: card to resume on, chosen on the setup screen from stored
  // progress (sessionProgress.ts). Omitted means start at the first card.
  initialIndex?: number | undefined;
} = {}) {
  const router = useRouter();
  const c = useColors();
  const userId = useSessionStore((state) => state.userId);

  if (!userId) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
        <View style={{ flex: 1, justifyContent: "center", padding: spacing.xl }}>
          <AuthPromptCard
            title="Lernen nach dem Login"
            body="Sobald du dich anmeldest, laden wir deine fälligen Karten, speichern deinen Fortschritt und synchronisieren deine Lernstände."
            onPress={() => router.push("/auth")}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <AuthenticatedLearnScreen
      userId={userId}
      deckId={deckId}
      deckTitle={deckTitle}
      initialShowBackFirst={initialShowBackFirst}
      source={source}
      wobblyIds={wobblyIds}
      initialIndex={initialIndex}
    />
  );
}

function AuthenticatedLearnScreen({
  userId,
  deckId,
  deckTitle,
  initialShowBackFirst,
  source,
  wobblyIds,
  initialIndex,
}: {
  userId: string;
  deckId?: string | undefined;
  deckTitle?: string | undefined;
  initialShowBackFirst?: boolean | undefined;
  source?: CardSource | undefined;
  wobblyIds?: string[] | undefined;
  initialIndex?: number | undefined;
}) {
  const { t } = useTranslation();
  const displayName = useDisplayName();
  const router = useRouter();
  const c = useColors();
  const { cards, index, revealed, completed, swipedLeft, swipedRight, history, ratingHistory, presetToken, cardsOwner, start, reveal, rateCurrent, canGoBack, goBack } =
    useReviewSession();

  // Studying IS using the deck (#415). Only for a single-deck session — the
  // global Lernen tab spans every deck, so there is no one deck to remember.
  useEffect(() => {
    if (deckId) void setLastUsedDeck({ id: deckId, title: deckTitle ?? "" });
  }, [deckId, deckTitle]);

  // Cards the learner didn't know this session, powering the result summary and
  // the "only the missed ones" button (pure helper, unit-tested).
  const missedCards = useMemo(
    () => missedCardsFrom(cards, history, ratingHistory),
    [cards, history, ratingHistory],
  );
  const knownCount = Math.max(0, cards.length - missedCards.length);
  const enqueueOfflineReview = useOfflineQueueStore((state) => state.enqueue);
  const acknowledgeRejectedReviews = useOfflineQueueStore(
    (state) => state.acknowledgeRejected
  );
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  // A review the server rejected (4xx) that we did NOT re-queue — surfaced so the
  // learner knows their answer wasn't saved instead of it vanishing silently.
  const [reviewError, setReviewError] = useState(false);
  const [showBackFirst, setShowBackFirst] = useState(initialShowBackFirst ?? false);
  const [starredMap, setStarredMap] = useState<Record<string, boolean>>({});

  const awardStateRef = useRef<SessionAwardState>({ finalized: false, inFlight: null });
  const pendingReviewsRef = useRef<Promise<unknown>[]>([]);
  const sessionReviewsRef = useRef(0);

  // Ratings are held back instead of sent on tap (#283): the buffer keeps the
  // most recent rating until the learner moves on, so the back arrow can discard
  // an unsent rating instead of firing a second, double-counting review. Stable
  // across renders — the session is module-global, so one buffer per screen.
  const reviewBufferRef = useRef(
    createReviewSendBuffer<ReturnType<typeof createReviewSyncOperation>>()
  );
  const reviewBuffer = reviewBufferRef.current;

  // ─── Flip animation (independent toggle) ─────────────────────────────────
  const flipProgress = useSharedValue(0);
  const [flipped, setFlipped] = useState(false);

  // ─── Swipe: free 2D movement ─────────────────────────────────────────────
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  // ─── Entrance animation for new cards ─────────────────────────────────────
  // Opacity only — deliberately no scale. The card faces carry a shadow, rounded
  // corners, a perspective transform and backfaceVisibility:"hidden", so iOS
  // composites each face off-screen into a texture instead of redrawing it per
  // frame. Scaling the wrapper stretches that texture, which makes the text
  // visibly pixelated until the animation settles and the layer is redrawn.
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
    // Position + visibility already reset by worklet callback (for swipes).
    // Set again here as fallback for button ratings / initial load.
    translateX.value = 0;
    translateY.value = 0;
    cardOpacity.value = 0;
    // Entrance: fade in only. A spring on scale (0.85 -> 1, damping 12) used to
    // run here; simulated, that spring crossed its target four times and kept
    // stretching the card's cached texture for ~0.43s, so the text arrived
    // pixelated. See the cardOpacity declaration for why the texture exists.
    cardOpacity.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) });
  }, [index, flipProgress, translateX, translateY, cardOpacity]);

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
    setLoadError(false);
    setReviewError(false);
    try {
      await syncPendingReviewOperations(userId).catch(() => null);
      // Endgültig abgelehnte Nachzügler (4xx) sind aus der Warteschlange
      // verschwunden und zählen nie mehr. Das darf nicht still passieren
      // (#418), also dasselbe Hinweis-Banner wie beim direkten Weg. Der Zähler
      // liegt in der Warteschlange, damit auch Ablehnungen aus dem
      // Hintergrund-Abgleich (_layout.tsx) hier ankommen.
      if (useOfflineQueueStore.getState().queue.rejectedCount > 0) {
        setReviewError(true);
      }
      // Deck mode: study every card of one deck. Tab mode: study globally-due cards.
      const { cards: raw } = deckId
        ? await listCardsInDeck(deckId)
        : await getDueCards(userId);
      // Occlusion cards are unanswerable here — their front is a placeholder and
      // the image only exists in the Bild-Abdecken mode, so skip them.
      const fetched = excludeOcclusionCards(raw);
      // Deck setup may restrict the session to a chosen source (all / starred /
      // wobbly). The global tab (no deckId/source) always studies the full pile.
      const loaded =
        deckId && source
          ? filterBySource(fetched, source, new Set(wobblyIds ?? []))
          : fetched;
      if (loaded.length > 0) {
        const starMap: Record<string, boolean> = {};
        loaded.forEach((card) => { starMap[card.id] = card.starred ?? false; });
        setStarredMap(starMap);
        start(
          loaded.map((card) => ({ id: card.id, front: card.front, back: card.back, starred: card.starred })),
          initialIndex ?? 0,
          // Herkunft an die Karten heften, damit dieser Bildschirm sie beim
          // nächsten Fokus als seine erkennt — und fremde nicht (#282).
          deckId ?? GLOBAL_OWNER
        );
      } else {
        start([], 0, deckId ?? GLOBAL_OWNER);
      }
    } catch {
      // Distinguish a load failure (offline / server error) from a genuinely
      // empty due pile, so we show a retry instead of "keine fälligen Karten".
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [userId, deckId, source, wobblyIds, start, initialIndex]);

  // ─── Remember where a deck session was interrupted ───────────────────────
  // Only in deck mode: the global tab studies whatever is due today, so a
  // position from an earlier pile would point at an unrelated card. Written on
  // every card change rather than on leaving, because the app can be killed
  // from the task switcher without any teardown running.
  useEffect(() => {
    if (!deckId || !source || cards.length === 0) return;
    if (completed) {
      void clearSessionProgress(deckId, "flashcards");
      return;
    }
    const current = cards[index];
    if (!current) return;
    void saveSessionProgress(deckId, "flashcards", {
      index,
      cardId: current.id,
      source,
      reverse: showBackFirst,
      total: cards.length,
    });
  }, [deckId, source, cards, index, completed, showBackFirst]);

  // The review session store is module-global, so a fresh screen can inherit
  // cards from a previous session. Reload whenever the source changes (a
  // different deck, or global mode) so opening deck B never shows deck A.
  const loadedKeyRef = useRef<string | null>(null);
  // Stand des presetToken, den DIESER Bildschirm zuletzt gesehen hat. Startwert
  // 0 = „noch nichts von außen vorgegeben"; so lädt ein frisch geöffneter Tab
  // ganz normal nach.
  const seenPresetRef = useRef(0);
  useFocusEffect(
    useCallback(() => {
      // Die Entscheidung selbst liegt in decideOnLearnFocus — als reine
      // Funktion prüfbar, ohne die App zu rendern. Genau hier saß #282, und
      // ein Fehler, den man nicht testen kann, kommt zurück.
      const key = deckId ?? "__global__";
      const action = decideOnLearnFocus({
        deckId,
        presetToken,
        seenPresetToken: seenPresetRef.current,
        loadedKey: loadedKeyRef.current,
        cardsOwner,
        cardCount: cards.length,
        completed,
      });

      if (action.type === "adoptPreset") {
        // Ein anderer Bildschirm hat eine Auswahl hingelegt: übernehmen und
        // merken, damit sie beim nächsten Fokus nicht erneut als neu gilt.
        seenPresetRef.current = presetToken;
        loadedKeyRef.current = key;
        return;
      }
      if (action.type === "load") {
        loadedKeyRef.current = key;
        // Was wir gleich selbst laden, ist keine fremde Vorgabe mehr.
        seenPresetRef.current = presetToken;
        loadDueCards();
      }
    }, [deckId, cards.length, completed, loadDueCards, presetToken])
  );

  // ─── Rating handlers ──────────────────────────────────────────────────────

  // Actually send a (previously buffered) review to the server. The buffer above
  // decides *whether* to send; this does the sending and its error handling.
  const sendReview = useCallback(
    async (review: { cardId: string; rating: ReviewRating; queuedReview: ReturnType<typeof createReviewSyncOperation> }) => {
      if (!userId) return;
      sessionReviewsRef.current += 1;
      setReviewLoading(true);
      setReviewError(false);
      const reviewPromise = reviewCard(
        userId,
        review.cardId,
        review.rating,
        review.queuedReview.payload,
      ).catch((error) => {
        if (shouldRetryLater(error)) {
          // Offline / server error: keep the review for a later retry via the queue.
          enqueueOfflineReview(review.queuedReview);
        } else {
          // 4xx: the server rejected this review outright. Re-queuing it would just
          // be rejected again, so surface it instead of dropping it silently.
          // Dieselbe Unterscheidung gilt seit #418 auch im Warteschlangen-Weg
          // (syncService: 5xx/unbekannt = später nochmal, 4xx = endgültig).
          setReviewError(true);
        }
      });
      pendingReviewsRef.current.push(reviewPromise);
      try {
        await reviewPromise;
      } finally {
        setReviewLoading(false);
      }
    },
    [userId, enqueueOfflineReview]
  );

  const handleRate = async (rating: ReviewRating) => {
    if (!revealed) reveal();
    const result = rateCurrent(rating);
    if (!result || !userId) return;
    // Buffer this rating instead of sending it now, so a following "back" can
    // discard it (no server round-trip, no double count, #283). Buffering the new
    // one releases the previous card's rating — the learner has moved past it.
    const previous = reviewBuffer.rate({
      cardId: result.cardId,
      rating,
      queuedReview: createReviewSyncOperation({
        userId,
        cardId: result.cardId,
        rating,
        mode: "flashcard",
      }),
    });
    if (previous) await sendReview(previous);
    // The last card has nothing after it to release the buffer, and the summary
    // screen reads the streak, so send it now. The summary has no back arrow (see
    // the `!completed` render guard), so it can't be re-rated from there.
    if (useReviewSession.getState().completed) {
      const last = reviewBuffer.flush();
      if (last) await sendReview(last);
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

  const handleGoBack = () => {
    // Drop the unsent rating for the card we're returning to, so re-rating it
    // cannot create a second review (#283).
    reviewBuffer.back();
    const moved = goBack();
    if (!moved) {
      return;
    }
    translateX.value = 0;
    translateY.value = 0;
    setFlipped(false);
    void Speech.stop();
    setSpeaking(false);
  };

  const completeSwipeAfterFlyOut = (rating: ReviewRating) => {
    setTimeout(() => {
      handleSwipe(rating);
    }, 350);
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

  const deductLp = useUsageStore((s) => s.deductLp);
  const setUsage = useUsageStore((s) => s.setUsage);
  const {
    toast: milestoneToast,
    celebration: milestoneCelebration,
    dismissCelebration,
    checkStreakMilestones,
    claimOnceMilestone,
  } = useMilestoneToast();

  useEffect(() => {
    if (completed && autoPlaying) setAutoPlaying(false);
  }, [completed, autoPlaying]);

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

      // Cleanup runs on blur — flush any buffered rating, wait for in-flight reviews,
      // then earn LP with retries so a fast tab switch cannot zero out the grant (#153).
      return () => {
        void (async () => {
          const last = reviewBuffer.flush();
          if (last) await sendReview(last);
          const reviewedCount = getSessionReviewedCount(
            sessionReviewsRef.current,
            pendingReviewsRef.current.length,
          );
          await awardSession(reviewedCount);
        })();
      };
    }, [reviewBuffer, sendReview, awardSession]),
  );

  // Milestone + streak rewards still fire when a session is fully completed.
  useEffect(() => {
    if (!completed || cards.length === 0 || !userId) return;

    const handleSessionComplete = async () => {
      // Claim first_review milestone (idempotent – only fires once ever)
      claimOnceMilestone("first_review").catch(() => {});

      // Check streak milestones (idempotent – each fires once per streak level)
      try {
        const statsResult = await getStats();
        await checkStreakMilestones(statsResult.stats.currentStreak);
      } catch {
        // Streak milestones are best-effort
      }
    };

    handleSessionComplete();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completed]);

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
    const text = revealed ? displayBack : speechFront;
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
        const flyX = isRight ? SCREEN_WIDTH * 1.6 : -SCREEN_WIDTH * 1.6;
        const flyY = e.translationY + e.velocityY * 0.35;
        const rating: ReviewRating = isRight ? "good" : "again";

        // Calculate duration based on velocity — keep enough visible travel time.
        const remainingDist = Math.abs(flyX - e.translationX);
        const speed = Math.max(Math.abs(e.velocityX), 600);
        const flyDuration = Math.min(Math.max((remainingDist / speed) * 1000, 500), 1000);

        // Animate fly-out on Y (no callback needed)
        translateY.value = withTiming(flyY, {
          duration: flyDuration,
          easing: Easing.out(Easing.cubic),
        });

        // Animate fly-out on X and only then proceed to next card.
        translateX.value = withTiming(flyX, {
          duration: flyDuration,
          easing: Easing.out(Easing.cubic),
        }, () => {
          runOnJS(completeSwipeAfterFlyOut)(rating);
        });
      } else {
        // Slower, smoother snap-back for better readability.
        translateX.value = withSpring(0, { damping: 8, stiffness: 35, mass: 1.6 });
        translateY.value = withSpring(0, { damping: 8, stiffness: 35, mass: 1.6 });
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
  const canGoBackOne = canGoBack();

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
  const mediaSummary = summarizeCardMedia({
    front: effectiveFront,
    back: effectiveBack,
  });
  const normalizedFront = cleanTerm(mediaSummary.plainFront || effectiveFront);
  const normalizedBack = cleanTerm(mediaSummary.plainBack || effectiveBack);
  const frontParsed = formatCloze(normalizedFront);
  const displayBack = frontParsed.clozeAnswer ?? normalizedBack;
  // Fürs Vorlesen der Vorderseite: die Lücke wird zur Sprech-Pause ("…") statt
  // zur Lösung — Parität zum Web (speechTexts in apps/web/src/lib/speech-text.ts).
  const speechFront = normalizedFront.replace(/\{\{c\d+::.+?\}\}/g, "…");
  const frontImage = mediaSummary.frontImages[0] ?? mediaSummary.primaryImage;
  const backImage = mediaSummary.backImages[0] ?? mediaSummary.primaryImage;
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
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {deckId ? (
              <TouchableOpacity
                onPress={() => router.back()}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={{ width: 34, height: 34, justifyContent: "center", alignItems: "center" }}
              >
                <ArrowLeft size={22} color={c.textSecondary} />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 34 }} />
            )}

            <Text
              numberOfLines={1}
              style={{ flex: 1, fontSize: typography.xxl, fontWeight: typography.bold, color: c.text, textAlign: "center" }}
            >
              {deckTitle ?? t("reviewHeadline")}
            </Text>

            {cards.length > 0 && !completed ? (
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
            ) : (
              <View style={{ width: 34 }} />
            )}
          </View>

          {loading ? (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
              <ActivityIndicator size="large" color={c.primary} />
              <Text style={{ marginTop: spacing.md, color: c.textSecondary, fontSize: typography.base }}>
                {t("review.loadingCards")}
              </Text>
            </View>
          ) : loadError ? (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: spacing.lg, padding: spacing.xl }}>
              <Text style={{ fontSize: typography.lg, color: c.textSecondary, textAlign: "center", lineHeight: 24 }}>
                {t("common.loadError")}
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
                  {t("common.retry")}
                </Text>
              </TouchableOpacity>
            </View>
          ) : completed || cards.length === 0 ? (
            cards.length === 0 ? (
              // Nothing due / no cards — an invitation, not a result.
              <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: spacing.lg }}>
                <View style={{
                  width: 72, height: 72, borderRadius: 36, backgroundColor: c.surfaceSecondary,
                  justifyContent: "center", alignItems: "center",
                }}>
                  <CheckCircle2 size={36} color={c.textTertiary} />
                </View>
                <Text style={{ fontSize: typography.xl, fontWeight: typography.semibold, textAlign: "center", color: c.text }}>
                  {t("review.noCards")}
                </Text>
                <Text style={{ color: c.textSecondary, textAlign: "center", fontSize: typography.base }}>
                  {t("review.noCardsHint")}
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
                    {t("review.reload")}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              // Result: how many known + re-study only the missed ones. Same
              // "Lernen" frame as the other modes — green trophy, never red, a
              // finished round is never a fail.
              <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg }}>
                <View style={{
                  width: 72, height: 72, borderRadius: 36, backgroundColor: c.successLight,
                  justifyContent: "center", alignItems: "center",
                }}>
                  <Trophy size={34} color={c.success} />
                </View>
                <Text style={{ fontSize: typography.xxxl, fontWeight: typography.extrabold, textAlign: "center", color: c.text }}>
                  {displayName
                    ? t("review.resultTitleNamed", { name: displayName })
                    : t("review.resultTitle")}
                </Text>
                <Text style={{ color: c.textSecondary, textAlign: "center", fontSize: typography.base }}>
                  {cards.length === 1
                    ? t("review.resultBodyOne", { known: knownCount })
                    : t("review.resultBody", { total: cards.length, known: knownCount })}
                </Text>
                <View style={{ width: "100%", maxWidth: 340, gap: spacing.sm, marginTop: spacing.sm }}>
                  {missedCards.length > 0 && (
                    <TouchableOpacity
                      onPress={() => start(missedCards)}
                      activeOpacity={0.85}
                      style={{
                        backgroundColor: c.primary, borderRadius: radius.md, paddingVertical: 14,
                        alignItems: "center", justifyContent: "center",
                      }}
                    >
                      <Text style={{ color: "#fff", fontWeight: typography.bold, fontSize: typography.base }}>
                        {t("review.onlyWrong", { count: missedCards.length })}
                      </Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={loadDueCards}
                    activeOpacity={0.85}
                    style={{
                      backgroundColor: missedCards.length > 0 ? c.surface : c.primary,
                      borderWidth: missedCards.length > 0 ? 1 : 0, borderColor: c.border,
                      borderRadius: radius.md, paddingVertical: 14,
                      flexDirection: "row", gap: spacing.sm, alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <RotateCcw size={18} color={missedCards.length > 0 ? c.text : "#fff"} />
                    <Text style={{ color: missedCards.length > 0 ? c.text : "#fff", fontWeight: typography.bold, fontSize: typography.base }}>
                      {t("review.againAll")}
                    </Text>
                  </TouchableOpacity>
                  {deckId && (
                    <TouchableOpacity onPress={() => router.back()} activeOpacity={0.85} style={{ paddingVertical: 12, alignItems: "center" }}>
                      <Text style={{ color: c.textSecondary, fontWeight: typography.semibold, fontSize: typography.base }}>
                        {t("review.done")}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )
          ) : (
            <View style={{ flex: 1, gap: spacing.md }}>
              {/* Progress */}
              <View style={{ gap: spacing.xs }}>
                <Text style={{ color: c.textSecondary, fontSize: typography.sm, fontWeight: typography.medium, textAlign: "center" }}>
                  {t("review.cardOf", { current: index + 1, total: cards.length })}
                </Text>
                <View style={{ height: 4, backgroundColor: c.surfaceSecondary, borderRadius: 2, overflow: "hidden" }}>
                  <View style={{
                    height: "100%", width: `${Math.max(progress * 100, 2)}%`,
                    backgroundColor: progress >= 1 ? c.success : c.primary, borderRadius: 2,
                  }} />
                </View>
              </View>

              {/* Swipe counters */}
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.xs }}>
                <View style={{
                  minWidth: 32, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
                  borderRadius: radius.sm, backgroundColor: `${c.ratingAgain}20`,
                  alignItems: "center", justifyContent: "center",
                }}>
                  <Text style={{ fontSize: typography.sm, fontWeight: typography.bold, color: c.ratingAgain }}>
                    {swipedLeft}
                  </Text>
                </View>
                <View style={{
                  minWidth: 32, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
                  borderRadius: radius.sm, backgroundColor: `${c.ratingGood}20`,
                  alignItems: "center", justifyContent: "center",
                }}>
                  <Text style={{ fontSize: typography.sm, fontWeight: typography.bold, color: c.ratingGood }}>
                    {swipedRight}
                  </Text>
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
                      {/* Text content fades out on swipe */}
                      <Animated.View style={[cardTextOpacity, { alignItems: "center", gap: spacing.md }]}>
                        {frontImage ? (
                          <Image
                            source={{ uri: frontImage.url }}
                            style={{
                              width: Math.min(SCREEN_WIDTH * 0.72, 320),
                              height: Math.min(SCREEN_HEIGHT * 0.22, 220),
                              borderRadius: radius.md,
                              backgroundColor: c.surfaceSecondary,
                            }}
                            resizeMode="contain"
                          />
                        ) : null}
                        <Text style={{
                          fontSize: typography.xxl, fontWeight: typography.semibold,
                          textAlign: "center", color: c.text, lineHeight: 36,
                        }}>
                          {frontParsed.display || frontImage?.alt || "Bildkarte"}
                        </Text>
                        {!revealed && (
                          <Text style={{ marginTop: spacing.xl, color: c.textTertiary, fontSize: typography.base }}>
                            {t("review.tapToFlip")}
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
                      {/* Text content fades out on swipe */}
                      <Animated.View style={[cardTextOpacity, { alignItems: "center", gap: spacing.md }]}>
                        {backImage ? (
                          <Image
                            source={{ uri: backImage.url }}
                            style={{
                              width: Math.min(SCREEN_WIDTH * 0.72, 320),
                              height: Math.min(SCREEN_HEIGHT * 0.22, 220),
                              borderRadius: radius.md,
                              backgroundColor: c.surfaceSecondary,
                            }}
                            resizeMode="contain"
                          />
                        ) : null}
                        <Text style={{
                          fontSize: typography.xxl,
                          fontWeight: frontParsed.clozeAnswer ? typography.bold : typography.normal,
                          textAlign: "center", color: c.text, lineHeight: 36,
                        }}>
                          {displayBack || backImage?.alt || "—"}
                        </Text>
                      </Animated.View>
                    </Animated.View>
                  </Animated.View>
                </GestureDetector>
              </View>

              {/* Non-blocking notice when a review couldn't be saved (server rejected it) */}
              {reviewError && (
                <TouchableOpacity
                  onPress={() => {
                    setReviewError(false);
                    // Auch den Zähler aus der Warteschlange quittieren, sonst
                    // käme der Hinweis beim nächsten Öffnen wieder.
                    acknowledgeRejectedReviews();
                  }}
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
                    justifyContent: "center",
                    gap: spacing.sm,
                  }}
                >
                  <Text style={{ flex: 1, color: c.error, fontSize: typography.sm, fontWeight: typography.medium }}>
                    {t("review.saveError")}
                  </Text>
                  <Text style={{ color: c.error, fontSize: typography.xs, fontWeight: typography.semibold }}>
                    {t("common.close")}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Rating buttons */}
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                {ratingButton("Nochmal", "again", c.ratingAgain)}
                {ratingButton("Schwer", "hard", c.ratingHard)}
                {ratingButton("Gut", "good", c.ratingGood)}
                {ratingButton("Leicht", "easy", c.ratingEasy)}
              </View>

              {/* Bottom row: back arrow, hint, speaker + star — pushed to bottom */}
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.sm, marginTop: spacing.lg, paddingBottom: spacing.sm }}>
                <TouchableOpacity
                  onPress={handleGoBack}
                  disabled={!canGoBackOne}
                  activeOpacity={0.7}
                  hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                  style={{
                    opacity: canGoBackOne ? 1 : 0.3,
                    width: 44,
                    height: 44,
                    borderRadius: radius.full,
                    backgroundColor: c.surfaceSecondary,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <ArrowLeft size={22} color={c.textSecondary} />
                </TouchableOpacity>

                <Text style={{ fontSize: typography.xs, color: c.textTertiary }}>
                  {t("review.swipeOrTap")}
                </Text>

                <View style={{ flexDirection: "row", gap: spacing.lg, alignItems: "center" }}>
                  <TouchableOpacity
                    onPress={() => speakText(revealed ? displayBack : speechFront)}
                    activeOpacity={0.6}
                    hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                    style={{ width: 44, height: 44, justifyContent: "center", alignItems: "center" }}
                  >
                    <Volume2 size={22} color={speaking ? c.primary : c.textTertiary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={toggleStar}
                    activeOpacity={0.6}
                    hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                    style={{ width: 44, height: 44, justifyContent: "center", alignItems: "center" }}
                  >
                    <Star size={22} color={isStarred ? c.warning : c.textTertiary} fill={isStarred ? c.warning : "none"} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>
      </SafeAreaView>
      <MilestoneToastView toast={milestoneToast} />
      <MilestoneCelebration celebration={milestoneCelebration} onDismiss={dismissCelebration} />
    </GestureHandlerRootView>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocalSearchParams, useFocusEffect, Stack } from "expo-router";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  HelpCircle,
  Check,
  Pencil,
} from "lucide-react-native";
import { listCardsInDeck, reviewCard, earnLp, type Card } from "../src/lib/api";
import { setLastUsedDeck } from "../src/lib/lastUsedDeck";
import {
  loadSetup,
  resolveSource,
  saveSetup,
  type StoredSetup,
} from "../src/lib/setupMemory";
import {
  clearSessionProgress,
  isProgressUsable,
  loadSessionProgress,
  saveSessionProgress,
  type SessionProgress,
  type StoredCardResult,
} from "../src/features/review/sessionProgress";
import {
  createReviewSendBuffer,
  type BufferedReview,
} from "../src/features/review/reviewSendBuffer";
import {
  createReviewSyncOperation,
  useOfflineQueueStore,
} from "../src/features/sync/offlineQueueStore";
import { useSessionStore } from "../src/store/sessionStore";
import { useUsageStore } from "../src/store/usageStore";
import { excludeOcclusionCards } from "../src/lib/occlusion";
import { summarizeCardMedia } from "../src/lib/cardMedia";
import { formatCloze } from "../src/lib/cloze";
import { isAnswerCorrect, isCaseOnlyMismatch } from "../src/lib/answerCheck";
import { cleanTerm } from "../src/lib/cardTerms";
import { fetchDeckStats } from "../src/lib/statsApi";
import { useDisplayName } from "../src/lib/useDisplayName";
import {
  CardSourcePicker,
  filterBySource,
  isCardDue,
  type CardSource,
} from "../src/components/cardSourcePicker";
import { useColors, spacing, radius, typography, shadows } from "../src/theme";
import { StudyResult } from "../src/components/StudyResult";
import { LpRoundSummary } from "../src/components/LpRoundSummary";
import { shouldRetryLater } from "../src/features/sync/sendReview";
import {
  beginSessionAward,
  getSessionReviewedCount,
  isSessionEarnFinalized,
  type SessionAwardState,
} from "../src/lib/learn-session-lp";

interface Prompt {
  prompt: string;
  answer: string;
  isCloze: boolean;
}

// Build the "gap to fill" from a card:
//   - cloze cards ({{cN::x}}): show the sentence with a blank, answer is x
//     (the blank is fixed in the text, so direction has no effect)
//   - basic cards: show one side, type the other. `reverse` swaps which side.
function buildPrompt(card: Card, reverse: boolean): Prompt {
  // Prepared like the web (#592, cloze-prompt.ts): image markdown out,
  // translation wrappers out. A side that is only an image has no text
  // afterwards, so the card falls out of hasTypeable — without showing the
  // image, its question would be raw ![…](…) code.
  const media = summarizeCardMedia(card);
  const parsed = formatCloze(media.plainFront);
  if (parsed.clozeAnswer !== null) {
    return { prompt: parsed.display, answer: parsed.clozeAnswer.trim(), isCloze: true };
  }
  // Strip a translation-question wrapper so vocab cards behave as clean pairs.
  const front = cleanTerm(media.plainFront);
  const back = cleanTerm(media.plainBack);
  if (reverse) {
    return { prompt: back, answer: front, isCloze: false };
  }
  return { prompt: front, answer: back, isCloze: false };
}

// A card is usable if it has something to type in whichever direction is chosen.
function hasTypeable(card: Card): boolean {
  const parsed = buildPrompt(card, false);
  if (parsed.isCloze) return parsed.answer.length > 0;
  return parsed.prompt.length > 0 && parsed.answer.length > 0;
}

type Phase = "setup" | "play" | "summary";

export default function ClozeScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { deckId, deckTitle } = useLocalSearchParams<{
    deckId: string;
    deckTitle: string;
  }>();

  // Studying IS using the deck (#415).
  useEffect(() => {
    if (deckId) void setLastUsedDeck({ id: deckId, title: deckTitle ?? "" });
  }, [deckId, deckTitle]);

  const userId = useSessionStore((state) => state.userId);
  const setUsage = useUsageStore((s) => s.setUsage);
  const displayName = useDisplayName();
  const enqueueOfflineReview = useOfflineQueueStore((state) => state.enqueue);
  const recordRejectedReview = useOfflineQueueStore((state) => state.recordRejected);
  const awardStateRef = useRef<SessionAwardState>({ finalized: false, inFlight: null });
  const pendingReviewsRef = useRef<Promise<unknown>[]>([]);
  const sessionReviewsRef = useRef(0);

  const [allCards, setAllCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Settings chosen on the setup screen
  const [strict, setStrict] = useState(true);
  const [reverse, setReverse] = useState(false);
  const [source, setSource] = useState<CardSource>("all");
  const [wobblyIds, setWobblyIds] = useState<Set<string>>(new Set());

  const [phase, setPhase] = useState<Phase>("setup");
  // Punkte-Rückmeldung der Runde (#611): Zahl und Deckel kommen aus der
  // Server-Antwort, nie aus eigener Rechnung.
  const [earnedLp, setEarnedLp] = useState(0);
  const [earnCapReached, setEarnCapReached] = useState(false);
  const [round, setRound] = useState<Card[]>([]);
  const [idx, setIdx] = useState(0);
  // Earliest card the back button may reach. Non-zero only after resuming, so a
  // continued round cannot step back into cards the earlier session rated.
  const [floor, setFloor] = useState(0);
  // Position of an earlier interrupted round for this deck, if one is stored.
  const [saved, setSaved] = useState<SessionProgress | null>(null);
  const [input, setInput] = useState("");
  // One result slot per card in the round (null = not answered yet), so the
  // back button can show an earlier card in its answered state.
  const [results, setResults] = useState<
    ({ input: string; correct: boolean; overridden: boolean } | null)[]
  >([]);

  const loadCards = useCallback(async () => {
    if (!deckId) return;
    setLoading(true);
    setLoadError(false);
    try {
      const { cards: fetched } = await listCardsInDeck(deckId);
      const usable = excludeOcclusionCards(fetched).filter(hasTypeable);
      setAllCards(usable);
      // Wobbly ids power the "Nur Wackelkandidaten" source. Optional — never
      // fail the mode (or show the retry) if the stats endpoint is down.
      try {
        const stats = await fetchDeckStats(deckId);
        setWobblyIds(new Set(stats.wobblyCards.map((c) => c.cardId)));
      } catch {
        setWobblyIds(new Set());
      }
    } catch {
      // Distinguish a load failure (offline / server error) from a deck that
      // genuinely has no typeable cards, so we can offer a retry instead.
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [deckId]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  // Read the stored position once; the offer below only appears while it still
  // matches the pile the current settings produce.
  useEffect(() => {
    if (!deckId) return;
    let active = true;
    void loadSessionProgress(deckId, "cloze").then((progress) => {
      if (active) setSaved(progress);
    });
    return () => {
      active = false;
    };
  }, [deckId]);

  // #610: Zuletzt gestartete Einstellungen dieses Decks als Vorbelegung. Der
  // Merker wird asynchron gelesen und erst angewendet, wenn auch die Karten da
  // sind — die gemerkte Quelle wird nur übernommen, wenn sie heute wieder
  // Karten hätte (eine leere Quelle wäre eine Sackgasse mit gesperrtem Start).
  const [storedSetup, setStoredSetup] = useState<StoredSetup | null | undefined>(undefined);
  useEffect(() => {
    if (!deckId) return;
    let active = true;
    void loadSetup(deckId, "cloze").then((stored) => {
      if (active) setStoredSetup(stored);
    });
    return () => {
      active = false;
    };
  }, [deckId]);

  // The chosen source decides which cards this round draws from.
  const starredCount = allCards.filter((c) => c.starred).length;
  const wobblyCount = allCards.filter((c) => wobblyIds.has(c.id)).length;
  const dueCount = allCards.filter((c) => isCardDue(c)).length;
  const studyPool = filterBySource(allCards, source, wobblyIds);

  const setupRestoredRef = useRef(false);
  useEffect(() => {
    if (setupRestoredRef.current || loading || storedSetup === undefined) return;
    if (phase !== "setup") return;
    setupRestoredRef.current = true;
    if (storedSetup?.strict !== undefined) setStrict(storedSetup.strict);
    if (storedSetup?.reverse !== undefined) setReverse(storedSetup.reverse);
    const wanted = resolveSource(storedSetup?.source, {
      starred: starredCount,
      wobbly: wobblyCount,
      due: dueCount,
    });
    if (wanted) setSource(wanted);
    // Ohne gemerkte Wahl ist das Tagespensum die Voreinstellung (#610):
    // „Nur fällige", sobald es gerade welche gibt.
    else if (!storedSetup?.source && dueCount > 0) setSource("due");
  }, [loading, storedSetup, phase, starredCount, wobblyCount, dueCount]);

  const canResume =
    saved !== null && isProgressUsable(saved, studyPool.map((card) => card.id), source);

  const current = round[idx];
  const parsed = current ? buildPrompt(current, reverse) : null;

  // Derived view state of the card on screen.
  const currentResult = results[idx] ?? null;
  const revealed = currentResult !== null;
  const wasCorrect = currentResult
    ? currentResult.correct || currentResult.overridden
    : false;
  // Gelbe „Fast"-Stufe (#610, Laras Entscheidung): Die Antwort scheitert NUR
  // an der Groß-/Kleinschreibung. Sie zählt nicht automatisch als richtig —
  // der „Trotzdem als richtig zählen"-Knopf darunter entscheidet.
  const nearMiss =
    revealed && !wasCorrect && parsed
      ? isCaseOnlyMismatch(currentResult?.input ?? "", parsed.answer)
      : false;
  const displayedInput = currentResult ? currentResult.input : input;

  const setResultAt = (
    i: number,
    value: { input: string; correct: boolean; overridden: boolean } | null
  ) => {
    setResults((prev) => prev.map((r, j) => (j === i ? value : r)));
  };

  // Der Lückentext zählt für die Planung, weil die Antwort getippt wird — sie
  // lässt sich nicht raten wie eine angeklickte Option. Web macht das längst
  // (deck/[id]/cloze/page.tsx), der App fehlte es. Fehlschläge wandern in die
  // Offline-Warteschlange, damit Lernen ohne Netz nicht verloren geht.
  // Bewertungen werden einen Schritt zurückgehalten statt sofort geschickt —
  // derselbe Puffer wie in den Karteikarten (#283). Nur so kann „zählt
  // trotzdem“ die Bewertung der Karte auf dem Schirm noch ÄNDERN. Ging sie
  // sofort raus, blieb der Fehlversuch als Rückfall stehen und das „gut“ kam
  // obendrauf: Die Karte galt als gescheitert UND bestanden.
  const reviewBufferRef = useRef(
    createReviewSendBuffer<ReturnType<typeof createReviewSyncOperation>>(),
  );
  const reviewBuffer = reviewBufferRef.current;

  const sendReview = useCallback(
    (buffered: BufferedReview<ReturnType<typeof createReviewSyncOperation>>) => {
      if (!userId) return;
      sessionReviewsRef.current += 1;
      const reviewPromise = reviewCard(
        userId,
        buffered.cardId,
        buffered.rating,
        buffered.queuedReview.payload,
      ).catch((error) => {
        // Offline oder Serverfehler: für später aufheben. Bei 4xx würde ein
        // erneuter Versuch genauso abgelehnt — fallen lassen, aber ZÄHLEN
        // (#605): Der Lern-Tab zeigt dafür sein Hinweis-Banner, statt dass
        // die Antwort spurlos verschwindet (z. B. Karte anderswo gelöscht).
        if (shouldRetryLater(error)) enqueueOfflineReview(buffered.queuedReview);
        else recordRejectedReview();
      });
      pendingReviewsRef.current.push(reviewPromise);
    },
    [userId, enqueueOfflineReview, recordRejectedReview],
  );

  const review = useCallback(
    (cardId: string, rating: "good" | "again") => {
      if (!userId) return;
      const queuedReview = createReviewSyncOperation({ userId, cardId, rating, mode: "cloze" });
      // Die vorige Karte ist endgültig hinter uns — ihre Bewertung darf raus.
      const previous = reviewBuffer.rate({ cardId, rating, queuedReview });
      if (previous) sendReview(previous);
    },
    [userId, reviewBuffer, sendReview],
  );

  /** Zurückgehaltene Bewertung abschicken: Runde vorbei oder Bildschirm verlassen. */
  const flushReview = useCallback(() => {
    const last = reviewBuffer.flush();
    if (last) sendReview(last);
  }, [reviewBuffer, sendReview]);

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
              setEarnedLp(result.granted);
            }
            setEarnCapReached(result.capReached);
            if (isSessionEarnFinalized(result, reviewedCount)) {
              state.finalized = true;
              break;
            }
          } catch {
            // LP-Gutschrift best-effort
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
          // Erst die zurückgehaltene Bewertung abschicken, dann zählen — sonst
          // fehlt die letzte Karte in der Abrechnung.
          flushReview();
          const reviewedCount = getSessionReviewedCount(
            sessionReviewsRef.current,
            pendingReviewsRef.current.length,
          );
          await awardSession(reviewedCount);
        })();
      };
    }, [awardSession, flushReview]),
  );

  // Jede Runde ist eine eigene Abrechnung. Weil `handleNext` am Rundenende
  // sofort gutschreibt (state.finalized = true), müssten „Nur die nicht
  // gewussten“ / „Alle nochmal“ sonst ohne Lernpunkte laufen — der Ablauf
  // steht dann dauerhaft auf „abgerechnet“. Gleiches Muster wie Web
  // (src/components/app/learn-session.tsx, startRound).
  //
  // Reihenfolge ist wichtig: erst die vorige Gutschrift zu Ende laufen lassen,
  // dann entschärfen. Andernfalls setzt der noch laufende Lauf `finalized`
  // wieder auf true, NACHDEM wir es hier zurückgesetzt haben.
  const startRound = async (
    cardsForRound: Card[],
    startAt = 0,
    storedResults?: Record<string, StoredCardResult>,
  ) => {
    // Eine neue Runde darf keine Bewertung der alten mitschleppen: Die Karte
    // ist vorbei, ihre Bewertung gehört noch zur vorigen Abrechnung.
    flushReview();
    await awardSession(
      getSessionReviewedCount(sessionReviewsRef.current, pendingReviewsRef.current.length),
    );
    awardStateRef.current.finalized = false;
    pendingReviewsRef.current = [];
    sessionReviewsRef.current = 0;
    // Die Punkte-Anzeige gehört zur alten Runde (#611): Stehenbleiben würde für
    // die neue Runde eine Gutschrift behaupten, die noch nicht erfolgt ist.
    setEarnedLp(0);
    setEarnCapReached(false);

    // `startAt` resumes an interrupted round (sessionProgress.ts). The floor
    // travels with it: the skipped cards were answered and sent last time, so
    // the back button must not walk into them and collect a second review.
    const from = Math.min(Math.max(startAt, 0), Math.max(cardsForRound.length - 1, 0));
    // Die Ergebnisse der letzten Sitzung wieder einfüllen, damit die Auswertung
    // die ganze Runde zählt und alte falsche Karten wieder im Wiederholungs-
    // Stapel landen. Nur unterhalb der Untergrenze: alles ab der Einstiegskarte
    // wird in dieser Sitzung neu beantwortet. Die Eingabe von damals ist nicht
    // gespeichert (leer) — sichtbar wird sie nie, der Zurück-Pfeil endet an der
    // Untergrenze.
    const initialResults: (typeof results)[number][] = new Array(cardsForRound.length).fill(null);
    if (storedResults) {
      for (let i = 0; i < from; i++) {
        const skippedCard = cardsForRound[i];
        const stored = skippedCard ? storedResults[skippedCard.id] : undefined;
        if (stored) initialResults[i] = { input: "", ...stored };
      }
    }
    setRound(cardsForRound);
    setResults(initialResults);
    setIdx(from);
    setFloor(from);
    setInput("");
    setPhase("play");
  };

  const handleCheck = () => {
    if (revealed || !current || !parsed) return;
    const correct = isAnswerCorrect(input, parsed.answer, { strict });
    setResultAt(idx, { input, correct, overridden: false });
    void review(current.id, correct ? "good" : "again");
  };

  // "Weiß ich nicht": reveal the answer, count it wrong (goes to the retry pile).
  const handleDontKnow = () => {
    if (revealed || !current) return;
    setResultAt(idx, { input, correct: false, overridden: false });
    void review(current.id, "again");
  };

  // Self-graded override: the learner decides a wrong-marked answer counts —
  // also retroactively when navigating back to an earlier card.
  const handleOverride = () => {
    if (!currentResult || wasCorrect || !current || !userId) return;
    setResultAt(idx, { ...currentResult, overridden: true });
    const queuedReview = createReviewSyncOperation({
      userId,
      cardId: current.id,
      rating: "good",
      mode: "cloze",
    });
    // Solange die Bewertung dieser Karte noch bei uns liegt, wird sie ersetzt —
    // die Karte bekommt dann genau ein „gut“ und keinen Rückfall. Nur beim
    // rückwirkenden Übersteuern (zurückgeblättert, Bewertung längst beim
    // Server) bleibt eine korrigierende zweite Bewertung als einziger Weg.
    if (!reviewBuffer.amend(current.id, "good", queuedReview)) {
      sendReview({ cardId: current.id, rating: "good", queuedReview });
    }
  };

  const handleNext = () => {
    if (idx + 1 >= round.length) {
      setPhase("summary");
      // Die letzte Karte hat kein „danach“, das den Puffer freigäbe — und die
      // Abrechnung zählt gleich, also muss sie vorher raus.
      flushReview();
      const reviewedCount = getSessionReviewedCount(
        sessionReviewsRef.current,
        pendingReviewsRef.current.length,
      );
      void awardSession(reviewedCount);
      return;
    }
    setIdx((i) => i + 1);
    setInput("");
  };

  const handleBack = () => {
    if (idx <= floor) return;
    setIdx((i) => i - 1);
    setInput("");
  };

  // ─── Remember where an interrupted round stopped ─────────────────────────
  // Written per card rather than on leaving: the app can be killed from the
  // task switcher without any teardown running. The summary clears the entry —
  // a finished round has nothing to resume.
  useEffect(() => {
    if (!deckId || round.length === 0) return;
    if (phase === "summary") {
      void clearSessionProgress(deckId, "cloze");
      return;
    }
    if (phase !== "play") return;
    const card = round[idx];
    if (!card) return;
    // Die Ergebnisse der beantworteten Karten wandern mit ins Lesezeichen —
    // nach Karten-Id, nicht nach Position, damit sie ein verändertes Deck
    // überleben. Wiederhergestellte Ergebnisse einer noch früheren Sitzung
    // stehen bereits in `results` und bleiben so über mehrere Unterbrechungen
    // hinweg erhalten.
    const answered: Record<string, StoredCardResult> = {};
    round.forEach((roundCard, i) => {
      const result = results[i];
      if (result) answered[roundCard.id] = { correct: result.correct, overridden: result.overridden };
    });
    void saveSessionProgress(deckId, "cloze", {
      index: idx,
      cardId: card.id,
      source,
      reverse,
      total: round.length,
      ...(Object.keys(answered).length > 0 ? { results: answered } : {}),
    });
  }, [deckId, phase, round, idx, source, reverse, results]);

  // Round outcome, derived from the per-card results.
  const correctCount = results.filter(
    (r) => r && (r.correct || r.overridden)
  ).length;
  const wrong = round.filter((card, i) => {
    const r = results[i];
    return r != null && !(r.correct || r.overridden);
  });

  const screenHeader = (title: string) => (
    <Stack.Screen
      options={{
        title,
        headerBackTitle: "Zurück",
        headerTintColor: colors.primary,
        headerStyle: { backgroundColor: colors.background },
      }}
    />
  );

  if (loading) {
    return (
      <>
        {screenHeader("Lückentext")}
        <SafeAreaView
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: colors.background,
          }}
        >
          <ActivityIndicator size="large" color={colors.primary} />
        </SafeAreaView>
      </>
    );
  }

  // Load failed (offline / server error) — distinct from "no typeable cards".
  if (loadError) {
    return (
      <>
        {screenHeader("Lückentext")}
        <SafeAreaView
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: colors.background,
            padding: spacing.xxl,
            gap: spacing.lg,
          }}
        >
          <Text
            style={{
              fontSize: typography.lg,
              color: colors.textSecondary,
              textAlign: "center",
              lineHeight: 24,
            }}
          >
            {t("common.loadError")}
          </Text>
          <TouchableOpacity
            onPress={loadCards}
            activeOpacity={0.8}
            style={{
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.xl,
              borderRadius: radius.md,
              backgroundColor: colors.surfaceSecondary,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: typography.semibold }}>
              {t("common.retry")}
            </Text>
          </TouchableOpacity>
        </SafeAreaView>
      </>
    );
  }

  if (allCards.length === 0) {
    return (
      <>
        {screenHeader("Lückentext")}
        <SafeAreaView
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: colors.background,
            padding: spacing.xxl,
          }}
        >
          <HelpCircle size={48} color={colors.textTertiary} />
          <Text
            style={{
              marginTop: spacing.lg,
              fontSize: typography.lg,
              color: colors.textSecondary,
              textAlign: "center",
            }}
          >
            Dieses Deck hat keine Karten, bei denen man etwas eintippen kann.
          </Text>
        </SafeAreaView>
      </>
    );
  }

  // Setup — choose strict checking and which side is asked
  if (phase === "setup") {
    const leftSide = reverse ? "Rückseite" : "Vorderseite";
    const rightSide = reverse ? "Vorderseite" : "Rückseite";

    return (
      <>
        {screenHeader(deckTitle ?? "Lückentext")}
        <SafeAreaView
          edges={["bottom"]}
          style={{ flex: 1, backgroundColor: colors.background }}
        >
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              padding: spacing.xl,
              gap: spacing.xl,
            }}
            showsVerticalScrollIndicator={false}
          >
            {/* Intro */}
            <View style={{ alignItems: "center", gap: spacing.sm, marginTop: spacing.lg }}>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 18,
                  backgroundColor: colors.warningLight,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Pencil size={32} color={colors.warning} />
              </View>
              <Text
                style={{
                  fontSize: typography.xl,
                  fontWeight: typography.bold,
                  color: colors.text,
                  textAlign: "center",
                }}
                numberOfLines={2}
              >
                {deckTitle ?? "Lückentext"}
              </Text>
              <Text style={{ fontSize: typography.base, color: colors.textSecondary }}>
                Antwort eintippen
              </Text>
            </View>

            <View style={{ gap: spacing.md }}>
              {/* Genau prüfen toggle */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  backgroundColor: colors.surface,
                  borderRadius: radius.lg,
                  padding: spacing.lg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  ...shadows.sm,
                }}
              >
                <View style={{ flex: 1, paddingRight: spacing.md }}>
                  <Text
                    style={{
                      fontSize: typography.base,
                      fontWeight: typography.semibold,
                      color: colors.text,
                    }}
                  >
                    Genau prüfen
                  </Text>
                  <Text
                    style={{
                      fontSize: typography.sm,
                      color: colors.textSecondary,
                      marginTop: 2,
                    }}
                  >
                    {strict
                      ? "Groß/klein und Akzente zählen"
                      : "Verzeiht Groß/klein, Akzente, kleine Tippfehler"}
                  </Text>
                </View>
                <Switch
                  value={strict}
                  onValueChange={setStrict}
                  trackColor={{ false: colors.surfaceSecondary, true: colors.primary }}
                  thumbColor="#ffffff"
                  ios_backgroundColor={colors.surfaceSecondary}
                />
              </View>

              {/* Direction — one arrow in the middle, tap to swap */}
              <TouchableOpacity
                onPress={() => setReverse((r) => !r)}
                activeOpacity={0.8}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: radius.lg,
                  padding: spacing.lg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  ...shadows.sm,
                }}
              >
                <Text
                  style={{
                    fontSize: typography.sm,
                    color: colors.textSecondary,
                    marginBottom: spacing.md,
                  }}
                >
                  Abgefragte Richtung
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text
                    style={{
                      flex: 1,
                      textAlign: "right",
                      fontSize: typography.base,
                      fontWeight: typography.semibold,
                      color: colors.text,
                    }}
                  >
                    {leftSide}
                  </Text>
                  <View style={{ width: 44, alignItems: "center" }}>
                    <ArrowRight size={22} color={colors.primary} />
                  </View>
                  <Text
                    style={{
                      flex: 1,
                      textAlign: "left",
                      fontSize: typography.base,
                      fontWeight: typography.semibold,
                      color: colors.text,
                    }}
                  >
                    {rightSide}
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: typography.xs,
                    color: colors.textTertiary,
                    textAlign: "center",
                    marginTop: spacing.md,
                  }}
                >
                  Richtung tauschen
                </Text>
              </TouchableOpacity>

              {/* Kartenquelle — Alle / Nur markierte / Nur Wackelkandidaten */}
              <CardSourcePicker
                value={source}
                onChange={setSource}
                allCount={allCards.length}
                starredCount={starredCount}
                wobblyCount={wobblyCount}
                dueCount={dueCount}
              />
            </View>

            <View style={{ flex: 1 }} />

            {/* Weitermachen — only while an interrupted round still fits */}
            {canResume && saved && (
              <TouchableOpacity
                onPress={() => {
                  setReverse(saved.reverse);
                  // Beim Start die Wahl für dieses Deck merken (#610) — mit
                  // der Richtung, in der die fortgesetzte Runde wirklich läuft.
                  if (deckId)
                    void saveSetup(deckId, "cloze", {
                      strict,
                      reverse: saved.reverse,
                      source,
                    });
                  void startRound(studyPool, saved.index, saved.results);
                }}
                activeOpacity={0.85}
                style={{
                  backgroundColor: colors.primary,
                  paddingVertical: 16,
                  borderRadius: radius.lg,
                  alignItems: "center",
                  marginBottom: spacing.sm,
                  ...shadows.md,
                }}
              >
                <Text
                  style={{
                    color: colors.textInverse,
                    fontWeight: typography.bold,
                    fontSize: typography.lg,
                  }}
                >
                  Weitermachen
                </Text>
                <Text
                  style={{ color: colors.textInverse, fontSize: typography.sm, marginTop: 2 }}
                >
                  {`Karte ${saved.index + 1} von ${studyPool.length}`}
                </Text>
              </TouchableOpacity>
            )}

            {/* Start — becomes the secondary action once a resume is offered */}
            <TouchableOpacity
              onPress={() => {
                // Beim Start die Wahl für dieses Deck merken (#610).
                if (deckId) void saveSetup(deckId, "cloze", { strict, reverse, source });
                void startRound(studyPool);
              }}
              disabled={studyPool.length === 0}
              activeOpacity={0.85}
              style={{
                backgroundColor:
                  studyPool.length === 0
                    ? colors.surfaceSecondary
                    : canResume
                      ? colors.surface
                      : colors.primary,
                borderWidth: canResume && studyPool.length > 0 ? 1 : 0,
                borderColor: colors.border,
                paddingVertical: 16,
                borderRadius: radius.lg,
                alignItems: "center",
                ...(canResume ? {} : shadows.md),
              }}
            >
              <Text
                style={{
                  color:
                    studyPool.length === 0
                      ? colors.textTertiary
                      : canResume
                        ? colors.text
                        : colors.textInverse,
                  fontWeight: typography.bold,
                  fontSize: typography.lg,
                }}
              >
                {canResume ? "Von vorne beginnen" : "Starten"}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </>
    );
  }

  // Summary
  if (phase === "summary") {
    // Zählt Karten mit Ergebnis: nach einem Weitermachen sind das die dieser
    // Sitzung plus die aus dem Lesezeichen wiederhergestellten („11 von 12").
    // Bei einem Lesezeichen von vor dem Ergebnisse-Merken fehlen die alten —
    // dann zählt ehrlich nur diese Sitzung.
    const total = results.filter((result) => result !== null).length;
    const correct = correctCount;
    const wrongCount = wrong.length;
    const allRight = wrongCount === 0;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

    return (
      <>
        {screenHeader("Auswertung")}
        <SafeAreaView
          edges={["bottom"]}
          style={{ flex: 1, backgroundColor: colors.background }}
        >
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: "center",
              alignItems: "center",
              padding: spacing.xxl,
              gap: spacing.xl,
            }}
            showsVerticalScrollIndicator={false}
          >
            <StudyResult
              headline={`${pct}%`}
              subtitle={`${correct} von ${total} richtig`}
              accessory={
                <View style={{ gap: spacing.sm, alignItems: "center" }}>
                  <Text
                    style={{
                      textAlign: "center",
                      fontSize: typography.base,
                      color: allRight ? colors.success : colors.textSecondary,
                      fontWeight: allRight ? typography.bold : typography.medium,
                    }}
                  >
                    {allRight
                      ? `Alles richtig — stark${displayName ? `, ${displayName}` : ""}!`
                      : `${wrongCount} ${wrongCount === 1 ? "Karte" : "Karten"} noch offen.`}
                  </Text>
                  {/* Bis #611 sagte dieser Modus kein Wort zu den Punkten —
                      obwohl er längst abrechnet. */}
                  <LpRoundSummary earned={earnedLp} capReached={earnCapReached} />
                </View>
              }
              actions={[
                ...(allRight
                  ? []
                  : [
                      {
                        label: `Nur die nicht gewussten (${wrongCount})`,
                        onPress: () => void startRound(wrong),
                        variant: "primary" as const,
                      },
                    ]),
                {
                  label: "Alle nochmal",
                  onPress: () => void startRound(studyPool),
                  variant: allRight ? ("primary" as const) : ("secondary" as const),
                  reload: true,
                },
                { label: "Einstellungen", onPress: () => setPhase("setup"), variant: "ghost" as const },
              ]}
            />
          </ScrollView>
        </SafeAreaView>
      </>
    );
  }

  // Playing
  const progress = round.length > 0 ? (idx + (revealed ? 1 : 0)) / round.length : 0;

  return (
    <>
      {screenHeader(deckTitle ?? "Lückentext")}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <SafeAreaView
          edges={["bottom"]}
          style={{ flex: 1, backgroundColor: colors.background }}
        >
          <ScrollView
            contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Progress */}
            <View style={{ gap: spacing.xs }}>
              <Text
                style={{
                  fontSize: typography.sm,
                  color: colors.textSecondary,
                  fontWeight: typography.medium,
                  textAlign: "center",
                }}
              >
                Karte {idx + 1} von {round.length}
              </Text>
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
                    backgroundColor: colors.primary,
                    borderRadius: 2,
                  }}
                />
              </View>
            </View>

            {/* Prompt card */}
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                padding: spacing.xl,
                gap: spacing.md,
                ...shadows.sm,
              }}
            >
              <Text
                style={{
                  fontSize: typography.xs,
                  color: colors.textTertiary,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                {parsed?.isCloze ? "Ergänze die Lücke" : "Wie lautet die Antwort?"}
              </Text>
              <Text
                style={{
                  fontSize: typography.xl,
                  fontWeight: typography.semibold,
                  color: colors.text,
                  lineHeight: 30,
                }}
              >
                {parsed?.prompt}
              </Text>
            </View>

            {/* Answer input */}
            <TextInput
              key={idx}
              value={displayedInput}
              onChangeText={setInput}
              editable={!revealed}
              autoFocus
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="done"
              blurOnSubmit={false}
              onSubmitEditing={handleCheck}
              placeholder="Antwort eintippen…"
              placeholderTextColor={colors.textTertiary}
              style={{
                borderWidth: 1.5,
                borderColor: !revealed
                  ? colors.border
                  : wasCorrect
                    ? colors.success
                    : nearMiss
                      ? colors.warning
                      : colors.error,
                borderRadius: radius.md,
                paddingHorizontal: 14,
                paddingVertical: 14,
                fontSize: typography.lg,
                backgroundColor: colors.surface,
                color: colors.text,
              }}
            />

            {/* Feedback after checking — the solution word always shows,
                whether right or wrong. */}
            {revealed && (
              <View style={{ gap: spacing.sm }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.sm,
                    backgroundColor: wasCorrect
                      ? colors.successLight
                      : nearMiss
                        ? colors.warningLight
                        : colors.errorLight,
                    borderRadius: radius.md,
                    padding: spacing.md,
                  }}
                >
                  {wasCorrect ? (
                    <CheckCircle2 size={22} color={colors.success} />
                  ) : nearMiss ? (
                    <AlertTriangle size={22} color={colors.warning} />
                  ) : (
                    <XCircle size={22} color={colors.error} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: typography.base,
                        fontWeight: typography.bold,
                        color: wasCorrect
                          ? colors.success
                          : nearMiss
                            ? colors.warning
                            : colors.error,
                      }}
                    >
                      {wasCorrect
                        ? "Richtig"
                        : nearMiss
                          ? "Fast — achte auf die Großschreibung"
                          : "Falsch"}
                    </Text>
                    <Text
                      style={{
                        fontSize: typography.base,
                        color: colors.text,
                        marginTop: 2,
                      }}
                    >
                      Lösung: {parsed?.answer}
                    </Text>
                  </View>
                </View>

                {/* Let the learner overrule a strict "wrong" themselves */}
                {!wasCorrect && (
                  <TouchableOpacity
                    onPress={handleOverride}
                    activeOpacity={0.8}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: spacing.sm,
                      paddingVertical: 12,
                      borderRadius: radius.md,
                      borderWidth: 1,
                      borderColor: colors.success,
                      backgroundColor: colors.surface,
                    }}
                  >
                    <Check size={18} color={colors.success} />
                    <Text
                      style={{
                        color: colors.success,
                        fontWeight: typography.semibold,
                        fontSize: typography.base,
                      }}
                    >
                      Trotzdem als richtig zählen
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Action row: back to the previous card + check/next. Earlier
                cards show their stored answer; the override stays available. */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <TouchableOpacity
                onPress={handleBack}
                // Beim Weitermachen endet die Runde nicht bei Karte 1, sondern
                // an der Untergrenze — der Pfeil muss überall dort ausgegraut
                // sein, wo handleBack sperrt (wie Web cloze/page.tsx).
                disabled={idx <= floor}
                activeOpacity={0.7}
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: radius.full ?? 999,
                  backgroundColor: colors.surfaceSecondary,
                  justifyContent: "center",
                  alignItems: "center",
                  opacity: idx <= floor ? 0.3 : 1,
                }}
              >
                <ArrowLeft size={22} color={colors.textSecondary} />
              </TouchableOpacity>
              {!revealed ? (
                <>
                  <TouchableOpacity
                    onPress={handleCheck}
                    disabled={input.trim().length === 0}
                    activeOpacity={0.85}
                    style={{
                      flex: 1,
                      backgroundColor:
                        input.trim().length === 0 ? colors.surfaceSecondary : colors.primary,
                      paddingVertical: 15,
                      borderRadius: radius.md,
                      alignItems: "center",
                      ...shadows.sm,
                    }}
                  >
                    <Text
                      style={{
                        color:
                          input.trim().length === 0 ? colors.textTertiary : colors.textInverse,
                        fontWeight: typography.bold,
                        fontSize: typography.base,
                      }}
                    >
                      Prüfen
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleDontKnow}
                    activeOpacity={0.85}
                    style={{
                      flex: 1,
                      backgroundColor: colors.surface,
                      paddingVertical: 15,
                      borderRadius: radius.md,
                      alignItems: "center",
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Text
                      style={{
                        color: colors.textSecondary,
                        fontWeight: typography.bold,
                        fontSize: typography.base,
                      }}
                    >
                      Weiß ich nicht
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  onPress={handleNext}
                  activeOpacity={0.85}
                  style={{
                    flex: 1,
                    backgroundColor: colors.primary,
                    paddingVertical: 15,
                    borderRadius: radius.md,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: spacing.sm,
                    ...shadows.sm,
                  }}
                >
                  <Text
                    style={{
                      color: colors.textInverse,
                      fontWeight: typography.bold,
                      fontSize: typography.base,
                    }}
                  >
                    {idx + 1 >= round.length ? "Zur Auswertung" : "Weiter"}
                  </Text>
                  <ArrowRight size={18} color={colors.textInverse} />
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </>
  );
}

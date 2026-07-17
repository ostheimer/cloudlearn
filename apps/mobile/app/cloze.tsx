import { useCallback, useEffect, useRef, useState } from "react";
import { useLocalSearchParams, Stack } from "expo-router";
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
  ArrowLeft,
  ArrowRight,
  HelpCircle,
  Check,
  Pencil,
} from "lucide-react-native";
import { listCardsInDeck, reviewCard, earnLp, isApiError, type Card } from "../src/lib/api";
import {
  createReviewSyncOperation,
  useOfflineQueueStore,
} from "../src/features/sync/offlineQueueStore";
import { useSessionStore } from "../src/store/sessionStore";
import { useUsageStore } from "../src/store/usageStore";
import { excludeOcclusionCards } from "../src/lib/occlusion";
import { summarizeCardMedia } from "../src/lib/cardMedia";
import { isAnswerCorrect } from "../src/lib/answerCheck";
import { cleanTerm } from "../src/lib/cardTerms";
import { fetchDeckStats } from "../src/lib/statsApi";
import {
  CardSourcePicker,
  filterBySource,
  type CardSource,
} from "../src/components/cardSourcePicker";
import { useColors, spacing, radius, typography, shadows } from "../src/theme";
import { StudyResult } from "../src/components/StudyResult";

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
  const media = summarizeCardMedia(card);
  const rawFront = (media.plainFront || card.front || "").trim();
  const rawBack = (media.plainBack || card.back || "").trim();

  const match = rawFront.match(/\{\{c\d+::(.+?)\}\}/);
  if (match) {
    const answer = (match[1] ?? "").trim();
    const prompt = rawFront.replace(/\{\{c\d+::.+?\}\}/g, "______");
    return { prompt, answer, isCloze: true };
  }
  // Strip a translation-question wrapper so vocab cards behave as clean pairs.
  const front = cleanTerm(rawFront);
  const back = cleanTerm(rawBack);
  if (reverse) {
    return { prompt: back, answer: front, isCloze: false };
  }
  return { prompt: front, answer: back, isCloze: false };
}

// A card is usable if it has something to type in whichever direction is chosen.
function hasTypeable(card: Card): boolean {
  const parsed = buildPrompt(card, false);
  if (parsed.isCloze) return parsed.answer.length > 0;
  const media = summarizeCardMedia(card);
  const front = (media.plainFront || card.front || "").trim();
  const back = (media.plainBack || card.back || "").trim();
  return front.length > 0 && back.length > 0;
}

type Phase = "setup" | "play" | "summary";

export default function ClozeScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { deckId, deckTitle } = useLocalSearchParams<{
    deckId: string;
    deckTitle: string;
  }>();

  const userId = useSessionStore((state) => state.userId);
  const setUsage = useUsageStore((s) => s.setUsage);
  const enqueueOfflineReview = useOfflineQueueStore((state) => state.enqueue);
  // Zählt, ob seit der letzten Abrechnung überhaupt etwas passiert ist. Der
  // Server leitet die Menge ohnehin aus den gespeicherten Wiederholungen ab —
  // ein Aufruf am Ende genügt und kann nicht doppelt gutschreiben.
  const reviewedSinceEarnRef = useRef(0);

  const [allCards, setAllCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Settings chosen on the setup screen
  const [strict, setStrict] = useState(true);
  const [reverse, setReverse] = useState(false);
  const [source, setSource] = useState<CardSource>("all");
  const [wobblyIds, setWobblyIds] = useState<Set<string>>(new Set());

  const [phase, setPhase] = useState<Phase>("setup");
  const [round, setRound] = useState<Card[]>([]);
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState("");
  // One result slot per card in the round (null = not answered yet), so the
  // back button can show an earlier card in its answered state.
  const [results, setResults] = useState<
    ({ input: string; correct: boolean; overridden: boolean } | null)[]
  >([]);

  const startRound = (cardsForRound: Card[]) => {
    setRound(cardsForRound);
    setResults(new Array(cardsForRound.length).fill(null));
    setIdx(0);
    setInput("");
    setPhase("play");
  };

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

  // The chosen source decides which cards this round draws from.
  const starredCount = allCards.filter((c) => c.starred).length;
  const wobblyCount = allCards.filter((c) => wobblyIds.has(c.id)).length;
  const studyPool = filterBySource(allCards, source, wobblyIds);

  const current = round[idx];
  const parsed = current ? buildPrompt(current, reverse) : null;

  // Derived view state of the card on screen.
  const currentResult = results[idx] ?? null;
  const revealed = currentResult !== null;
  const wasCorrect = currentResult
    ? currentResult.correct || currentResult.overridden
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
  const review = useCallback(
    async (cardId: string, rating: "good" | "again") => {
      if (!userId) return;
      const queued = createReviewSyncOperation({ userId, cardId, rating });
      reviewedSinceEarnRef.current += 1;
      try {
        await reviewCard(userId, cardId, rating, queued.payload);
      } catch (error) {
        // Offline oder Serverfehler: für später aufheben. Bei 4xx würde ein
        // erneuter Versuch genauso abgelehnt — dann lieber fallen lassen.
        if (!isApiError(error) || error.status >= 500) enqueueOfflineReview(queued);
      }
    },
    [userId, enqueueOfflineReview]
  );

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
    if (!currentResult || wasCorrect || !current) return;
    setResultAt(idx, { ...currentResult, overridden: true });
    void review(current.id, "good");
  };

  // Am Rundenende einmal abrechnen. Die Menge holt sich der Server aus den
  // Wiederholungen, die er wirklich gespeichert hat (earn_session_lp ist
  // wiederholungsfest) — ein Aufruf reicht und kann nicht zu viel gutschreiben.
  const collectSessionLp = useCallback(async () => {
    if (reviewedSinceEarnRef.current === 0 || !userId) return;
    reviewedSinceEarnRef.current = 0;
    try {
      const result = await earnLp("session");
      if (result.granted > 0) setUsage({ lpBalance: result.newBalance });
    } catch {
      // LP-Gutschrift best-effort
    }
  }, [userId, setUsage]);

  const handleNext = () => {
    if (idx + 1 >= round.length) {
      setPhase("summary");
      void collectSessionLp();
      return;
    }
    setIdx((i) => i + 1);
    setInput("");
  };

  const handleBack = () => {
    if (idx === 0) return;
    setIdx((i) => i - 1);
    setInput("");
  };

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
                  Tippen zum Tauschen
                </Text>
              </TouchableOpacity>

              {/* Kartenquelle — Alle / Nur markierte / Nur Wackelkandidaten */}
              <CardSourcePicker
                value={source}
                onChange={setSource}
                allCount={allCards.length}
                starredCount={starredCount}
                wobblyCount={wobblyCount}
              />
            </View>

            <View style={{ flex: 1 }} />

            {/* Start */}
            <TouchableOpacity
              onPress={() => startRound(studyPool)}
              disabled={studyPool.length === 0}
              activeOpacity={0.85}
              style={{
                backgroundColor:
                  studyPool.length === 0 ? colors.surfaceSecondary : colors.primary,
                paddingVertical: 16,
                borderRadius: radius.lg,
                alignItems: "center",
                ...shadows.md,
              }}
            >
              <Text
                style={{
                  color:
                    studyPool.length === 0 ? colors.textTertiary : colors.textInverse,
                  fontWeight: typography.bold,
                  fontSize: typography.lg,
                }}
              >
                Starten
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </>
    );
  }

  // Summary
  if (phase === "summary") {
    const total = round.length;
    const correct = correctCount;
    const wrongCount = wrong.length;
    const allRight = wrongCount === 0;

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
              headline={`${correct} von ${total}`}
              subtitle={
                allRight
                  ? "alles richtig — stark!"
                  : `${wrongCount} ${wrongCount === 1 ? "Karte" : "Karten"} noch offen`
              }
              actions={[
                ...(allRight
                  ? []
                  : [
                      {
                        label: `Nur die falschen (${wrongCount})`,
                        onPress: () => startRound(wrong),
                        variant: "primary" as const,
                      },
                    ]),
                {
                  label: `Alle nochmal (${studyPool.length})`,
                  onPress: () => startRound(studyPool),
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
                {idx + 1} / {round.length}
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
                    backgroundColor: wasCorrect ? colors.successLight : colors.errorLight,
                    borderRadius: radius.md,
                    padding: spacing.md,
                  }}
                >
                  {wasCorrect ? (
                    <CheckCircle2 size={22} color={colors.success} />
                  ) : (
                    <XCircle size={22} color={colors.error} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: typography.base,
                        fontWeight: typography.bold,
                        color: wasCorrect ? colors.success : colors.error,
                      }}
                    >
                      {wasCorrect ? "Richtig" : "Falsch"}
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
                disabled={idx === 0}
                activeOpacity={0.7}
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: radius.full ?? 999,
                  backgroundColor: colors.surfaceSecondary,
                  justifyContent: "center",
                  alignItems: "center",
                  opacity: idx === 0 ? 0.3 : 1,
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

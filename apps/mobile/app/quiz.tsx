import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocalSearchParams, useRouter, Stack, useFocusEffect } from "expo-router";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Switch,
  Text,
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
  Trophy,
  RotateCcw,
  HelpCircle,
  Brain,
  Zap,
} from "lucide-react-native";
import { earnLp, listCardsInDeck, type Card } from "../src/lib/api";
import { sendReview } from "../src/features/sync/sendReview";
import { setLastUsedDeck } from "../src/lib/lastUsedDeck";
import { useDisplayName } from "../src/lib/useDisplayName";
import {
  beginSessionAward,
  getSessionReviewedCount,
  isSessionEarnFinalized,
  type SessionAwardState,
} from "../src/lib/learn-session-lp";
import { useSessionStore } from "../src/store/sessionStore";
import { useUsageStore } from "../src/store/usageStore";
import { excludeOcclusionCards } from "../src/lib/occlusion";
import {
  defaultQuizCopyDe,
  countQuizableCards,
  generateQuestions,
  type QuizQuestion,
} from "../src/lib/quizQuestions";
import { fetchDeckStats } from "../src/lib/statsApi";
import {
  CardSourcePicker,
  filterBySource,
  type CardSource,
} from "../src/components/cardSourcePicker";
import { QuestionCountPicker } from "../src/components/questionCountPicker";
import {
  encodeCount,
  loadSetup,
  resolveCount,
  resolveSource,
  saveSetup,
  type StoredSetup,
} from "../src/lib/setupMemory";
import { useColors, spacing, radius, typography, shadows } from "../src/theme";

export default function QuizScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const displayName = useDisplayName();
  const { deckId, deckTitle } = useLocalSearchParams<{
    deckId: string;
    deckTitle: string;
  }>();
  const router = useRouter();

  // Studying IS using the deck — Home's "Zuletzt genutzt" must not depend on
  // whether the learner happened to route through the deck screen first (#415).
  useEffect(() => {
    if (deckId) void setLastUsedDeck({ id: deckId, title: deckTitle ?? "" });
  }, [deckId, deckTitle]);
  const userId = useSessionStore((s) => s.userId);
  const setUsage = useUsageStore((s) => s.setUsage);
  const quizCopy = useMemo(
    () => ({
      ...defaultQuizCopyDe,
      trueLabel: t("quiz.trueLabel", { defaultValue: defaultQuizCopyDe.trueLabel }),
      falseLabel: t("quiz.falseLabel", { defaultValue: defaultQuizCopyDe.falseLabel }),
      trueFalsePrompt: t("quiz.trueFalsePrompt", {
        defaultValue: defaultQuizCopyDe.trueFalsePrompt,
      }),
      imagePrompt: t("quiz.imagePrompt", { defaultValue: defaultQuizCopyDe.imagePrompt }),
    }),
    [t]
  );

  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  // One slot per question (null = unanswered) so going back to a previous
  // question shows it in its answered state.
  const [selections, setSelections] = useState<(number | null)[]>([]);
  const [finished, setFinished] = useState(false);
  // Lernpunkte der Runde — Zahl aus der SERVER-Antwort, nicht selbst gerechnet.
  // Der Server zählt Rate-Modi je Karte und Lerntag nur einmal (Anti-Farming,
  // Schritt 8); eine eigene Rechnung würde bei der zweiten Runde lügen.
  const [earnedLp, setEarnedLp] = useState(0);

  // LP-Abrechnung nach dem #397-Muster (wie Lernen/Lückentext): Antworten
  // werden sofort gemeldet, die eine Gutschrift je Runde wartet erst alle
  // offenen Meldungen ab. So verliert ein Abbruch mitten in der Runde weder
  // Streak noch Statistik noch Punkte (#566).
  const awardStateRef = useRef<SessionAwardState>({ finalized: false, inFlight: null });
  const pendingReviewsRef = useRef<Promise<unknown>[]>([]);
  const sessionReviewsRef = useRef(0);

  // Setup choices (picked before the quiz starts)
  const [inSetup, setInSetup] = useState(true);
  const [reverse, setReverse] = useState(false);
  const [typeMC, setTypeMC] = useState(true);
  const [typeTF, setTypeTF] = useState(true);
  const [source, setSource] = useState<CardSource>("all");
  const [wobblyIds, setWobblyIds] = useState<Set<string>>(new Set());
  // Rundenlänge — wählbar wie bei der Prüfung (#570). Standard 10 (Laras
  // Entscheidung 28.07.); `count >= usableCount` bedeutet „Alle".
  const [count, setCount] = useState(10);
  const anyType = typeMC || typeTF;

  // The chosen source; choice questions need at least two cards from it.
  const starredCount = cards.filter((c) => c.starred).length;
  const wobblyCount = cards.filter((c) => wobblyIds.has(c.id)).length;
  const pool = filterBySource(cards, source, wobblyIds);
  const canStart = anyType && pool.length >= 2;
  // Obergrenze der Auswahl: EXAKT die Pool-Regel der Fragen-Erzeugung (#612) —
  // ein Bild zählt als Seite, Doppel-Scans zählen einmal. Die alte reine
  // Text-Prüfung versprach „Alle (12)" und lieferte dann 10 Fragen.
  const usableCount = countQuizableCards(pool);

  // Schrumpft der Pool (andere Kartenquelle), darf die gewählte Anzahl nicht
  // darüber liegen; nur klemmen, nie zurückwachsen (10 bleibt der Standard).
  useEffect(() => {
    if (usableCount > 0) setCount((c) => Math.min(c, usableCount));
  }, [usableCount]);

  // #610: Zuletzt gestartete Einstellungen dieses Decks als Vorbelegung. Der
  // Merker wird asynchron gelesen und erst angewendet, wenn auch die Karten da
  // sind — die gemerkte Quelle wird nur übernommen, wenn sie heute wieder
  // Karten hätte (eine leere Quelle wäre eine Sackgasse mit gesperrtem Start).
  const [storedSetup, setStoredSetup] = useState<StoredSetup | null | undefined>(undefined);
  useEffect(() => {
    if (!deckId) return;
    let active = true;
    void loadSetup(deckId, "quiz").then((stored) => {
      if (active) setStoredSetup(stored);
    });
    return () => {
      active = false;
    };
  }, [deckId]);

  const setupRestoredRef = useRef(false);
  useEffect(() => {
    if (setupRestoredRef.current || loading || storedSetup === undefined) return;
    if (!inSetup) return;
    setupRestoredRef.current = true;
    if (!storedSetup) return;
    if (storedSetup.reverse !== undefined) setReverse(storedSetup.reverse);
    if (storedSetup.typeMC !== undefined) setTypeMC(storedSetup.typeMC);
    if (storedSetup.typeTF !== undefined) setTypeTF(storedSetup.typeTF);
    const wanted = resolveSource(storedSetup.source, {
      starred: starredCount,
      wobbly: wobblyCount,
    });
    if (wanted) setSource(wanted);
    // Obergrenze der Anzahl ist der Vorrat der Quelle, die ab jetzt gilt —
    // der Klemm-Effekt oben zieht sie bei Quellenwechseln weiter mit.
    const wantedPool = filterBySource(cards, wanted ?? source, wobblyIds);
    const wantedMax = wantedPool.filter(
      (c) => (c.front ?? "").trim() && (c.back ?? "").trim()
    ).length;
    const storedCount = resolveCount(storedSetup.count, wantedMax);
    if (storedCount !== null) setCount(storedCount);
  }, [loading, storedSetup, inSetup, starredCount, wobblyCount, cards, source, wobblyIds]);

  // Load cards
  const loadCards = useCallback(async () => {
    if (!deckId) return;
    setLoading(true);
    setLoadError(false);
    try {
      const { cards: fetched } = await listCardsInDeck(deckId);
      setCards(excludeOcclusionCards(fetched));
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
      // genuinely has too few cards, so we can offer a retry instead.
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [deckId]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  /**
   * Die EINE Gutschrift der Runde. `beginSessionAward` sorgt dafür, dass sie
   * trotz mehrerer Aufrufer (Rundenende, Blur-Cleanup, Folgerunden-Start) nur
   * einmal läuft. Schlägt sie fehl, sind die Wiederholungen trotzdem schon
   * draußen — Streak und Statistik hängen daran und sind wichtiger als die
   * Punkte; die Oberfläche zeigt dann einfach keine an.
   */
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
        // „Abbrechen" im Header ist ein normales Zurück ohne eigenen Handler —
        // nur dieses Blur-Cleanup sieht den Abbruch mitten in der Runde noch
        // und rechnet die bis dahin beantworteten Fragen ab (#566).
        const reviewedCount = getSessionReviewedCount(
          sessionReviewsRef.current,
          pendingReviewsRef.current.length,
        );
        void awardSession(reviewedCount);
      };
    }, [awardSession]),
  );

  // Jede Runde ist eine eigene Abrechnung. Weil `handleNext` am Rundenende
  // sofort gutschreibt (state.finalized = true), liefen „Alle nochmal" und
  // „Nur die nicht gewussten" sonst dauerhaft ohne Lernpunkte. Reihenfolge
  // wie cloze.startRound: erst die vorige Gutschrift zu Ende laufen lassen,
  // DANN wieder scharf machen — sonst setzt der noch laufende Lauf
  // `finalized` wieder auf true, nachdem es hier zurückgesetzt wurde.
  const beginRound = async (qs: QuizQuestion[]) => {
    await awardSession(
      getSessionReviewedCount(sessionReviewsRef.current, pendingReviewsRef.current.length),
    );
    awardStateRef.current.finalized = false;
    pendingReviewsRef.current = [];
    sessionReviewsRef.current = 0;
    setEarnedLp(0);
    setQuestions(qs);
    setCurrentIdx(0);
    setSelections(new Array<number | null>(qs.length).fill(null));
    setFinished(false);
    setInSetup(false);
  };

  const startQuiz = () => {
    if (!canStart) return;
    const q = generateQuestions(pool, count, quizCopy, Math.random, {
      reverse,
      allowMc: typeMC,
      allowTrueFalse: typeTF,
    });
    if (q.length === 0) return;
    // Beim Start die Wahl für dieses Deck merken (#610). „Alle" wird als
    // Absicht gespeichert, nicht als Zahl — das Deck darf wachsen.
    if (deckId)
      void saveSetup(deckId, "quiz", {
        reverse,
        typeMC,
        typeTF,
        source,
        count: encodeCount(count, usableCount),
      });
    void beginRound(q);
  };

  // Selection of the question currently on screen (derived, not own state,
  // so navigating back shows the stored answer).
  const selected = selections[currentIdx] ?? null;

  const question = questions[currentIdx];
  const progress =
    questions.length > 0 ? (currentIdx + 1) / questions.length : 0;

  /**
   * Antwort antippen: sofort als Wiederholung melden, nicht erst am Rundenende
   * sammeln — ein Abbruch mitten in der Runde verlor sonst alles (#566).
   *
   * Bis Issue #406 meldete Multiple Choice in der App gar nichts. Der Modus
   * "quiz" sorgt dafür, dass der Lernplan NUR bei Fehlern angefasst wird:
   * richtig Geratenes beweist nichts.
   *
   * Kein Rückhalte-Puffer wie im Lückentext (#283) nötig: Eine angetippte
   * Antwort ist endgültig — der Zurück-Pfeil zeigt alte Fragen nur gesperrt
   * an, es gibt kein „zählt trotzdem". Nichts kann sich nachträglich ändern,
   * also kann nichts doppelt gemeldet werden.
   */
  const handleSelect = (optionIdx: number) => {
    if (selected !== null) return; // Already answered
    setSelections((s) => s.map((v, i) => (i === currentIdx ? optionIdx : v)));
    if (userId && question) {
      sessionReviewsRef.current += 1;
      const reviewPromise = sendReview({
        userId,
        cardId: question.cardId,
        rating: optionIdx === question.correctIndex ? "good" : "again",
        mode: "quiz",
      });
      pendingReviewsRef.current.push(reviewPromise);
    }
  };

  const handleNext = () => {
    if (currentIdx + 1 >= questions.length) {
      setFinished(true);
      // Ohne await: Das Ergebnis erscheint sofort, die Abrechnung läuft
      // dahinter. Nur die Punkte-Zahl kommt nach.
      const reviewedCount = getSessionReviewedCount(
        sessionReviewsRef.current,
        pendingReviewsRef.current.length,
      );
      void awardSession(reviewedCount);
    } else {
      setCurrentIdx((i) => i + 1);
    }
  };

  const handleBack = () => {
    setCurrentIdx((i) => Math.max(0, i - 1));
  };

  // Grading derived from the per-question selections.
  const answers = questions.map(
    (q, i) => selections[i] !== null && selections[i] === q.correctIndex
  );
  const answeredCount = selections.filter((s) => s !== null).length;
  const correctCount = answers.filter(Boolean).length;
  const scorePercent =
    answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;

  // Cards whose question was wrong or unanswered — for the "only the wrong ones"
  // button. Quiz questions carry their source cardId, so a shorter quiz can be
  // rebuilt from just those cards.
  const wrongCards = (() => {
    const ids = new Set(questions.filter((_, i) => !answers[i]).map((q) => q.cardId));
    return pool.filter((c) => ids.has(c.id));
  })();
  // Multiple Choice braucht mindestens 2 Karten für Ablenker — bei genau
  // einer falschen lieferte generateQuestions keine Fragen und der Knopf war
  // tot (#592); wie im Web erst ab 2 zeigen.
  const canRetryWrong = wrongCards.length >= 2;
  const startQuizFrom = (sourceCards: Card[]) => {
    const q = generateQuestions(sourceCards, Math.min(count, sourceCards.length), quizCopy, Math.random, {
      reverse,
      allowMc: typeMC,
      allowTrueFalse: typeTF,
    });
    if (q.length === 0) return;
    void beginRound(q);
  };

  if (loading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Multiple Choice",
            headerBackTitle: "Zurück",
            headerTintColor: colors.primary,
            headerStyle: { backgroundColor: colors.background },
          }}
        />
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

  // Load failed (offline / server error) — distinct from "too few cards".
  if (loadError) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Multiple Choice",
            headerBackTitle: "Zurück",
            headerTintColor: colors.primary,
            headerStyle: { backgroundColor: colors.background },
          }}
        />
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

  if (cards.length < 2) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Multiple Choice",
            headerBackTitle: "Zurück",
            headerTintColor: colors.primary,
            headerStyle: { backgroundColor: colors.background },
          }}
        />
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
              fontSize: typography.xl,
              fontWeight: typography.bold,
              color: colors.text,
              textAlign: "center",
            }}
          >
            Zu wenige Karten
          </Text>
          <Text
            style={{
              marginTop: spacing.sm,
              fontSize: typography.base,
              color: colors.textSecondary,
              textAlign: "center",
            }}
          >
            Für Multiple Choice braucht das Deck mindestens 2 Karten.
          </Text>
        </SafeAreaView>
      </>
    );
  }

  // Setup — direction + question kinds, before the quiz starts
  if (inSetup) {
    const typeRow = (
      label: string,
      value: boolean,
      onChange: (v: boolean) => void,
      border = true
    ) => (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingVertical: spacing.sm,
          borderBottomWidth: border ? 1 : 0,
          borderBottomColor: colors.borderLight,
        }}
      >
        <Text style={{ fontSize: typography.base, color: colors.text }}>{label}</Text>
        <Switch
          value={value}
          onValueChange={onChange}
          trackColor={{ false: colors.surfaceSecondary, true: colors.primary }}
          thumbColor="#ffffff"
          ios_backgroundColor={colors.surfaceSecondary}
        />
      </View>
    );

    const setupCardStyle = {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.sm,
    } as const;

    return (
      <>
        <Stack.Screen
          options={{
            title: deckTitle ?? "Multiple Choice",
            headerBackTitle: "Zurück",
            headerTintColor: colors.primary,
            headerStyle: { backgroundColor: colors.background },
          }}
        />
        <SafeAreaView
          edges={["bottom"]}
          style={{ flex: 1, backgroundColor: colors.background }}
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, padding: spacing.xl, gap: spacing.lg }}
            showsVerticalScrollIndicator={false}
          >
            {/* Intro */}
            <View style={{ alignItems: "center", gap: spacing.sm, marginTop: spacing.sm }}>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 18,
                  backgroundColor: colors.accentLight,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Brain size={32} color={colors.accent} />
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
                {deckTitle ?? "Multiple Choice"}
              </Text>
              <Text style={{ fontSize: typography.base, color: colors.textSecondary }}>
                Antwort aus Optionen wählen
              </Text>
            </View>

            {/* Richtung — one arrow in the middle, tap to swap */}
            <TouchableOpacity
              onPress={() => setReverse((r) => !r)}
              activeOpacity={0.8}
              style={setupCardStyle}
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
                  {reverse ? "Rückseite" : "Vorderseite"}
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
                  {reverse ? "Vorderseite" : "Rückseite"}
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

            {/* Anzahl Fragen — wählbar wie bei der Prüfung (#570) */}
            <QuestionCountPicker count={count} max={usableCount} onChange={setCount} />

            {/* Fragetypen */}
            <View style={setupCardStyle}>
              <Text
                style={{
                  fontSize: typography.sm,
                  color: colors.textSecondary,
                  marginBottom: spacing.xs,
                }}
              >
                Fragetypen
              </Text>
              {typeRow("Multiple Choice", typeMC, setTypeMC)}
              {typeRow("Wahr / Falsch", typeTF, setTypeTF, false)}
              {!anyType && (
                <Text
                  style={{
                    fontSize: typography.xs,
                    color: colors.error,
                    marginTop: spacing.xs,
                  }}
                >
                  Mindestens ein Typ muss an sein.
                </Text>
              )}
            </View>

            {/* Kartenquelle — Alle / Nur markierte / Nur Wackelkandidaten */}
            <CardSourcePicker
              value={source}
              onChange={setSource}
              allCount={cards.length}
              starredCount={starredCount}
              wobblyCount={wobblyCount}
            />
            {source !== "all" && pool.length < 2 && (
              <Text style={{ fontSize: typography.xs, color: colors.error }}>
                Für diese Auswahl sind mindestens 2 Karten nötig.
              </Text>
            )}

            <View style={{ flex: 1 }} />

            {/* Start */}
            <TouchableOpacity
              onPress={startQuiz}
              disabled={!canStart}
              activeOpacity={0.85}
              style={{
                backgroundColor: canStart ? colors.primary : colors.surfaceSecondary,
                paddingVertical: 16,
                borderRadius: radius.lg,
                alignItems: "center",
                ...shadows.md,
              }}
            >
              <Text
                style={{
                  color: canStart ? colors.textInverse : colors.textTertiary,
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

  // Results screen
  if (finished) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Ergebnis",
            headerBackTitle: "Zurück",
            headerTintColor: colors.primary,
            headerStyle: { backgroundColor: colors.background },
          }}
        />
        <SafeAreaView
          edges={["bottom"]}
          style={{ flex: 1, backgroundColor: colors.background }}
        >
          <ScrollView
            contentContainerStyle={{
              padding: spacing.xxl,
              gap: spacing.xl,
              alignItems: "center",
            }}
          >
            {/* Trophy — always green: a finished round is no fail; the
                red/yellow/green grade belongs to the Test (Quiz is a learning
                mode with instant per-question feedback). */}
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: colors.successLight,
                justifyContent: "center",
                alignItems: "center",
                marginTop: spacing.xl,
              }}
            >
              <Trophy size={40} color={colors.success} />
            </View>

            <Text
              style={{
                fontSize: typography.xxxl,
                fontWeight: typography.extrabold,
                color: colors.text,
              }}
            >
              {scorePercent}%
            </Text>

            <Text
              style={{
                fontSize: typography.base,
                color: colors.text,
              }}
            >
              {correctCount} von {answers.length} richtig
            </Text>

            <Text
              style={{
                fontSize: typography.base,
                color: colors.textTertiary,
                textAlign: "center",
              }}
            >
              {correctCount === answers.length
                ? `Hervorragend${displayName ? `, ${displayName}` : ""}! Du beherrschst den Stoff.`
                : scorePercent >= 80
                ? "Hervorragend! Du beherrschst den Stoff."
                : scorePercent >= 50
                ? "Gut! Etwas mehr Übung und du hast es drauf."
                : "Weiter üben! Wiederholung ist der Schlüssel."}
            </Text>

            {/* Nur anzeigen, wenn wirklich Punkte kamen. Eine zweite Runde mit
                denselben Karten am selben Tag bringt keine — dann steht hier
                nichts, statt „+0 Lernpunkte" zu behaupten. */}
            {earnedLp > 0 && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.xs,
                  backgroundColor: colors.successLight,
                  paddingVertical: spacing.xs,
                  paddingHorizontal: spacing.md,
                  borderRadius: radius.full ?? 999,
                }}
              >
                <Zap size={15} color={colors.success} />
                <Text
                  style={{
                    fontSize: typography.sm,
                    fontWeight: typography.semibold,
                    color: colors.success,
                  }}
                >
                  +{earnedLp} Lernpunkte
                </Text>
              </View>
            )}

            {/* Answer summary */}
            <View style={{ width: "100%", gap: spacing.sm }}>
              {questions.map((q, i) => {
                const wasCorrect = answers[i];
                return (
                  <View
                    key={i}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.md,
                      backgroundColor: colors.surface,
                      padding: spacing.md,
                      borderRadius: radius.md,
                      borderWidth: 1,
                      borderColor: wasCorrect
                        ? colors.success + "40"
                        : colors.error + "40",
                    }}
                  >
                    {wasCorrect ? (
                      <CheckCircle2 size={20} color={colors.success} />
                    ) : (
                      <XCircle size={20} color={colors.error} />
                    )}
                    <View style={{ flex: 1 }}>
                      {/* Wahr/Falsch: nur die Vorderseite plus „Richtig: Falsch"
                          las sich wie ein Widerspruch, weil die geprüfte
                          Zuordnung fehlte (#497). Farbe = hast du die Frage
                          getroffen, Zeichen (=/≠) = gehört das Paar wirklich
                          zusammen; der Satz nennt den getippten Knopf wörtlich
                          und bei einem Schwindel-Paar folgt die echte Antwort. */}
                      <Text
                        style={{
                          fontSize: typography.sm,
                          color: colors.text,
                          fontWeight: typography.medium,
                        }}
                        numberOfLines={q.type === "trueFalse" ? 3 : 1}
                      >
                        {q.type === "trueFalse"
                          ? `${q.tfPairing!.front} ${q.tfPairing!.isCorrect ? "=" : "≠"} ${q.tfPairing!.back}`
                          : q.questionText}
                      </Text>
                      {q.type === "trueFalse" && q.tfPairing ? (
                        <>
                          <Text
                            style={{
                              fontSize: typography.xs,
                              color: colors.textSecondary,
                              marginTop: 2,
                            }}
                          >
                            {`Du hast „${
                              wasCorrect === q.tfPairing.isCorrect ? "Richtig" : "Falsch"
                            }“ getippt — ${
                              wasCorrect ? "passt:" : "doch"
                            } das Paar gehört ${
                              q.tfPairing.isCorrect ? "wirklich" : "nicht"
                            } zusammen.`}
                          </Text>
                          {!q.tfPairing.isCorrect && (
                            <Text
                              style={{
                                fontSize: typography.xs,
                                color: colors.success,
                                marginTop: 2,
                              }}
                            >
                              Tatsächlich gehört dazu: {q.tfPairing.correctBack}
                            </Text>
                          )}
                        </>
                      ) : (
                        !wasCorrect && (
                          <Text
                            style={{
                              fontSize: typography.xs,
                              color: colors.success,
                              marginTop: 2,
                            }}
                          >
                            Richtig: {q.correctAnswer}
                          </Text>
                        )
                      )}
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Actions */}
            <View style={{ width: "100%", gap: spacing.sm }}>
              {canRetryWrong && (
                <TouchableOpacity
                  onPress={() => startQuizFrom(wrongCards)}
                  style={{
                    backgroundColor: colors.primary,
                    paddingVertical: 14,
                    borderRadius: radius.md,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: colors.textInverse, fontWeight: typography.bold }}>
                    Nur die nicht gewussten ({wrongCards.length})
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={startQuiz}
                style={{
                  backgroundColor: canRetryWrong ? colors.surface : colors.primary,
                  borderWidth: canRetryWrong ? 1 : 0,
                  borderColor: colors.border,
                  paddingVertical: 14,
                  borderRadius: radius.md,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: spacing.sm,
                }}
              >
                <RotateCcw size={18} color={canRetryWrong ? colors.text : colors.textInverse} />
                <Text
                  style={{
                    color: canRetryWrong ? colors.text : colors.textInverse,
                    fontWeight: typography.bold,
                  }}
                >
                  Alle nochmal
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setInSetup(true)}
                style={{
                  paddingVertical: 12,
                  borderRadius: radius.md,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontWeight: typography.semibold,
                    fontSize: typography.base,
                  }}
                >
                  Einstellungen
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </>
    );
  }

  // Active quiz
  return (
    <>
      <Stack.Screen
        options={{
          title: deckTitle ?? "Multiple Choice",
          headerBackTitle: "Abbrechen",
          headerTintColor: colors.primary,
          headerStyle: { backgroundColor: colors.background },
        }}
      />
      <SafeAreaView
        edges={["bottom"]}
        style={{ flex: 1, backgroundColor: colors.background }}
      >
        <View style={{ flex: 1, padding: spacing.lg, gap: spacing.lg }}>
          {/* Progress */}
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
                  fontSize: typography.sm,
                  color: colors.textSecondary,
                  fontWeight: typography.medium,
                }}
              >
                Frage {currentIdx + 1} von {questions.length}
              </Text>
              <Text
                style={{
                  fontSize: typography.sm,
                  color: colors.success,
                  fontWeight: typography.semibold,
                }}
              >
                {correctCount} richtig
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
                  backgroundColor: colors.primary,
                  borderRadius: 2,
                }}
              />
            </View>
          </View>

          {/* Question card */}
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.xl,
              padding: spacing.xxl,
              borderWidth: 1,
              borderColor: colors.border,
              ...shadows.md,
              gap: spacing.lg,
            }}
          >
            {/* Badge */}
            <View
              style={{
                alignSelf: "flex-start",
                backgroundColor:
                  question!.type === "mc"
                    ? colors.primaryLight
                    : question!.type === "imageMc"
                    ? colors.infoLight
                    : colors.accentLight,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs,
                borderRadius: radius.full,
              }}
            >
              <Text
                style={{
                  fontSize: typography.xs,
                  fontWeight: typography.bold,
                  color:
                    question!.type === "mc"
                      ? colors.primary
                      : question!.type === "imageMc"
                      ? colors.info
                      : colors.accent,
                }}
              >
                {question!.type === "mc"
                  ? t("quiz.mode.mc", { defaultValue: "MULTIPLE CHOICE" })
                  : question!.type === "imageMc"
                  ? t("quiz.mode.image", { defaultValue: "BILD QUIZ" })
                  : t("quiz.mode.tf", { defaultValue: "WAHR / FALSCH" })}
              </Text>
            </View>

            {/* Question text */}
            {question!.type === "trueFalse" && question!.tfPairing ? (
              <View style={{ gap: spacing.md }}>
                <Text
                  style={{
                    fontSize: typography.sm,
                    color: colors.textSecondary,
                  }}
                >
                  {question!.questionText}
                </Text>
                {question!.image ? (
                  <Image
                    source={{ uri: question!.image.url }}
                    style={{
                      width: "100%",
                      height: 180,
                      borderRadius: radius.md,
                      backgroundColor: colors.surfaceSecondary,
                    }}
                    resizeMode="contain"
                  />
                ) : null}
                <View
                  style={{
                    backgroundColor: colors.surfaceSecondary,
                    borderRadius: radius.md,
                    padding: spacing.lg,
                    gap: spacing.sm,
                  }}
                >
                  <Text
                    style={{
                      fontSize: typography.lg,
                      fontWeight: typography.bold,
                      color: colors.text,
                    }}
                  >
                    {question!.tfPairing.front}
                  </Text>
                  <View
                    style={{
                      height: 1,
                      backgroundColor: colors.border,
                    }}
                  />
                  <Text
                    style={{
                      fontSize: typography.base,
                      color: colors.textSecondary,
                    }}
                  >
                    = {question!.tfPairing.back}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={{ gap: spacing.md }}>
                {question!.image ? (
                  <Image
                    source={{ uri: question!.image.url }}
                    style={{
                      width: "100%",
                      height: 190,
                      borderRadius: radius.md,
                      backgroundColor: colors.surfaceSecondary,
                    }}
                    resizeMode="contain"
                  />
                ) : null}
                <Text
                  style={{
                    fontSize: typography.xl,
                    fontWeight: typography.semibold,
                    color: colors.text,
                    lineHeight: 28,
                  }}
                >
                  {question!.questionText}
                </Text>
              </View>
            )}
          </View>

          {/* Options */}
          <View style={{ gap: spacing.sm }}>
            {question!.options.map((opt, i) => {
              const isSelected = selected === i;
              const isCorrect = i === question!.correctIndex;
              const showResult = selected !== null;

              let bgColor: string = colors.surface;
              let borderColor: string = colors.border;
              let textColor: string = colors.text;

              if (showResult) {
                if (isCorrect) {
                  bgColor = colors.successLight;
                  borderColor = colors.success;
                  textColor = colors.success;
                } else if (isSelected && !isCorrect) {
                  bgColor = colors.errorLight;
                  borderColor = colors.error;
                  textColor = colors.error;
                }
              } else if (isSelected) {
                bgColor = colors.primaryLight;
                borderColor = colors.primary;
              }

              return (
                <TouchableOpacity
                  key={i}
                  onPress={() => handleSelect(i)}
                  disabled={selected !== null}
                  activeOpacity={0.7}
                  style={{
                    backgroundColor: bgColor,
                    borderRadius: radius.md,
                    padding: spacing.lg,
                    borderWidth: 2,
                    borderColor,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.md,
                  }}
                >
                  {/* Letter badge */}
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: showResult
                        ? isCorrect
                          ? colors.success
                          : isSelected
                          ? colors.error
                          : colors.surfaceSecondary
                        : colors.surfaceSecondary,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    {showResult && isCorrect ? (
                      <CheckCircle2 size={18} color={colors.textInverse} />
                    ) : showResult && isSelected ? (
                      <XCircle size={18} color={colors.textInverse} />
                    ) : (
                      <Text
                        style={{
                          fontSize: typography.sm,
                          fontWeight: typography.bold,
                          color: colors.textSecondary,
                        }}
                      >
                        {String.fromCharCode(65 + i)}
                      </Text>
                    )}
                  </View>
                  <Text
                    style={{
                      flex: 1,
                      fontSize: typography.base,
                      fontWeight: isSelected
                        ? typography.semibold
                        : typography.normal,
                      color: textColor,
                    }}
                    numberOfLines={3}
                  >
                    {opt}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Bottom row: back to the previous (answered) question + next.
              Past questions show their locked answer; Weiter moves forward. */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <TouchableOpacity
              onPress={handleBack}
              disabled={currentIdx === 0}
              activeOpacity={0.7}
              style={{
                width: 50,
                height: 50,
                borderRadius: radius.full ?? 999,
                backgroundColor: colors.surfaceSecondary,
                justifyContent: "center",
                alignItems: "center",
                opacity: currentIdx === 0 ? 0.3 : 1,
              }}
            >
              <ArrowLeft size={22} color={colors.textSecondary} />
            </TouchableOpacity>
            {selected !== null && (
              <TouchableOpacity
                onPress={handleNext}
                activeOpacity={0.8}
                style={{
                  flex: 1,
                  backgroundColor: colors.primary,
                  borderRadius: radius.md,
                  paddingVertical: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: spacing.sm,
                }}
              >
                <Text
                  style={{
                    color: colors.textInverse,
                    fontSize: typography.lg,
                    fontWeight: typography.bold,
                  }}
                >
                  {currentIdx + 1 >= questions.length ? "Ergebnis" : "Weiter"}
                </Text>
                <ArrowRight size={18} color={colors.textInverse} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </SafeAreaView>
    </>
  );
}

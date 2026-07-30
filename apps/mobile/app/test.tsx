import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { usePreventRemove } from "@react-navigation/native";
import {
  ActivityIndicator,
  Alert,
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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from "react-i18next";
import {
  CheckCircle2,
  XCircle,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  Trophy,
  HelpCircle,
  Check,
  Timer,
  FileText,
  Star,
  Pencil,
} from "lucide-react-native";
import { listCardsInDeck, recordTestAttempt, updateCard, type Card } from "../src/lib/api";
import CardEditor from "../src/components/CardEditor";
import { toggleCardStar } from "../src/lib/toggleCardStar";
import { sendReview } from "../src/features/sync/sendReview";
import { setLastUsedDeck } from "../src/lib/lastUsedDeck";
import { useDisplayName } from "../src/lib/useDisplayName";
import { useSessionStore } from "../src/store/sessionStore";
import { excludeOcclusionCards } from "../src/lib/occlusion";
import { isAnswerCorrect } from "../src/lib/answerCheck";
import {
  answeredIndices,
  buildTestQuestions,
  type TestAnswer,
  type TestQuestion,
  type TestQuestionType,
} from "../src/lib/testQuestions";
import { fetchDeckStats } from "../src/lib/statsApi";
import {
  CardSourcePicker,
  filterBySource,
  isCardDue,
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
import { useReviewSession } from "../src/features/review/reviewSession";

const SECONDS_PER_QUESTION = 30;

/** Wie viele Wiederholungen gleichzeitig gemeldet werden — wie im Web (#358). */
const REVIEW_CHUNK_SIZE = 25;

function lastResultKey(deckId: string) {
  return `test-last-result:${deckId}`;
}

function formatTime(s: number) {
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

type Answer = TestAnswer;

const EMPTY_ANSWER: Answer = { mc: null, tf: null, text: "" };

interface Graded {
  correct: boolean;
  overridden: boolean;
}

type Phase = "setup" | "play" | "result";

function gradeAnswer(q: TestQuestion, a: Answer, strict: boolean): boolean {
  if (q.type === "mc") return a.mc === q.correctIndex;
  if (q.type === "trueFalse") return a.tf === q.tfIsCorrect;
  return isAnswerCorrect(a.text, q.expected, { strict });
}

/**
 * Meldet die Antworten einer Prüfung — in Häppchen, mit Warten dazwischen.
 *
 * Ein `map` ohne `await` feuert bei einer 100-Fragen-Prüfung 100 gleichzeitige
 * Anfragen los; die Bremse auf der Review-Route (#358) würde einen Teil davon
 * abweisen. Gleiche Aufteilung wie im Web.
 *
 * Auf Modul-Ebene, weil auch der Notausgang beim Verlassen sie braucht — dann
 * läuft sie weiter, wenn der Bildschirm schon weg ist. `sendReview` hebt dabei
 * auf, was gerade nicht rausgeht (Warteschlange, #460).
 */
async function flushReviews(
  userId: string,
  toSend: ReadonlyArray<{ cardId: string; rating: "good" | "again" }>
): Promise<void> {
  for (let i = 0; i < toSend.length; i += REVIEW_CHUNK_SIZE) {
    const chunk = toSend.slice(i, i + REVIEW_CHUNK_SIZE);
    await Promise.allSettled(
      chunk.map((r) =>
        // mode "test": hält den Streak und füllt die Statistik, gibt aber keine
        // Lernpunkte, und nur FEHLER bewegen den Lernplan.
        sendReview({ userId, cardId: r.cardId, rating: r.rating, mode: "test" })
      )
    );
  }
}

export default function TestScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const displayName = useDisplayName();
  const router = useRouter();
  const startReview = useReviewSession((s) => s.start);
  const userId = useSessionStore((s) => s.userId);
  const { deckId, deckTitle } = useLocalSearchParams<{
    deckId: string;
    deckTitle: string;
  }>();

  // Studying IS using the deck (#415). A Test earns no LP and no daily-goal
  // credit, but it is still unambiguously "this deck was what I worked on".
  useEffect(() => {
    if (deckId) void setLastUsedDeck({ id: deckId, title: deckTitle ?? "" });
  }, [deckId, deckTitle]);

  const [allCards, setAllCards] = useState<Card[]>([]);
  // Stern-Stand der laufenden Runde, für sofort sichtbares Markieren (#610).
  const [starredMap, setStarredMap] = useState<Record<string, boolean>>({});
  // Stift-Knopf (#610): patcht nur die Karte selbst — die schon gebaute
  // Frage (Optionen, richtige Antwort) ändert sich erst in der nächsten Runde.
  const [editingCard, setEditingCard] = useState(false);
  const [savingCard, setSavingCard] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [lastResult, setLastResult] = useState<number | null>(null);

  // Settings
  const [count, setCount] = useState(0);
  const [typeTF, setTypeTF] = useState(true);
  const [typeMC, setTypeMC] = useState(true);
  const [typeWritten, setTypeWritten] = useState(true);
  const [strict, setStrict] = useState(true);
  const [reverse, setReverse] = useState(false);
  const [source, setSource] = useState<CardSource>("all");
  const [wobblyIds, setWobblyIds] = useState<Set<string>>(new Set());
  const [timed, setTimed] = useState(false);

  const [phase, setPhase] = useState<Phase>("setup");
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [graded, setGraded] = useState<Graded[]>([]);
  const [idx, setIdx] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Wurde diese Runde vorzeitig beendet? Dann ist die Prozentzahl auf weniger
  // Fragen berechnet, als man sich vorgenommen hatte, und darf NICHT als
  // „Letztes Ergebnis" stehenbleiben.
  const [aborted, setAborted] = useState(false);
  /**
   * Sind die Antworten dieser Runde schon gemeldet?
   *
   * Es gibt drei Wege hinaus — Abgeben, vorzeitig Beenden und der Notausgang
   * beim Verlassen des Bildschirms. Ohne diese Sperre könnten zwei davon
   * zusammenfallen und dieselbe Karte doppelt melden.
   */
  const sentRef = useRef(false);
  // Ein stabiler Schlüssel je Prüfungsrunde, damit ein Doppel-Abgeben (Zeit-Modus
  // feuert submit, während man noch tippt) EINE test_attempts-Zeile ergibt.
  const roundKeyRef = useRef("");
  // Wurde für DIESE Runde eine Prüfungs-Zeile geschrieben (nur bei voller
  // Abgabe)? Nur dann darf „Trotzdem als richtig zählen" die Note nachziehen —
  // sonst legte ein Override in der Durchsicht einer ABGEBROCHENEN Prüfung
  // nachträglich doch eine Zeile an.
  const attemptRecordedRef = useRef(false);

  // All cards with both a question and an answer — the base pool for the test.
  const usableCards = useMemo(
    () =>
      allCards.filter(
        (c) => (c.front ?? "").trim().length > 0 && (c.back ?? "").trim().length > 0
      ),
    [allCards]
  );
  // Unfiltered usable count — the "empty deck" screen must not depend on the
  // chosen source, or picking one could lock the learner out of the setup.
  const deckUsableCount = usableCards.length;
  const starredCount = useMemo(
    () => usableCards.filter((c) => c.starred).length,
    [usableCards]
  );
  const wobblyCount = useMemo(
    () => usableCards.filter((c) => wobblyIds.has(c.id)).length,
    [usableCards, wobblyIds]
  );
  const dueCount = useMemo(
    () => usableCards.filter((c) => isCardDue(c)).length,
    [usableCards]
  );
  // The chosen source drives which cards the test draws from; the question
  // count then follows this pool.
  const pool = useMemo(
    () => filterBySource(usableCards, source, wobblyIds),
    [usableCards, source, wobblyIds]
  );
  const usableCount = pool.length;

  const loadCards = useCallback(async () => {
    if (!deckId) return;
    setLoading(true);
    setLoadError(false);
    try {
      const { cards: fetched } = await listCardsInDeck(deckId);
      setAllCards(excludeOcclusionCards(fetched));
      // Wobbly ids power the "Nur Wackelkandidaten" source. They are optional —
      // never fail the mode (or show the retry) if the stats endpoint is down.
      try {
        const stats = await fetchDeckStats(deckId);
        setWobblyIds(new Set(stats.wobblyCards.map((c) => c.cardId)));
      } catch {
        setWobblyIds(new Set());
      }
    } catch {
      // Distinguish a load failure (offline / server error) from a deck with no
      // usable cards, so we can offer a retry instead of the empty state.
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [deckId]);

  useEffect(() => {
    if (!deckId) return;
    loadCards();
    AsyncStorage.getItem(lastResultKey(deckId)).then((value) => {
      const n = value ? parseInt(value, 10) : NaN;
      if (!Number.isNaN(n)) setLastResult(n);
    });
  }, [deckId, loadCards]);

  // Default the question count to the maximum once cards are loaded. Danach
  // nur noch klemmen, nie zurücksetzen (#610, gleiche Regel wie das Quiz):
  // Ein Quellenwechsel soll eine gewählte oder gemerkte Anzahl nicht
  // stillschweigend auf „Alle" zurückdrehen.
  const countInitializedRef = useRef(false);
  useEffect(() => {
    if (usableCount <= 0) return;
    if (!countInitializedRef.current) {
      countInitializedRef.current = true;
      setCount(usableCount);
      return;
    }
    setCount((c) => Math.min(c, usableCount));
  }, [usableCount]);

  // #610: Zuletzt gestartete Einstellungen dieses Decks als Vorbelegung. Der
  // Merker wird asynchron gelesen und erst angewendet, wenn auch die Karten da
  // sind — die gemerkte Quelle wird nur übernommen, wenn sie heute wieder
  // Karten hätte (eine leere Quelle wäre eine Sackgasse mit gesperrtem Start).
  const [storedSetup, setStoredSetup] = useState<StoredSetup | null | undefined>(undefined);
  useEffect(() => {
    if (!deckId) return;
    let active = true;
    void loadSetup(deckId, "test").then((stored) => {
      if (active) setStoredSetup(stored);
    });
    return () => {
      active = false;
    };
  }, [deckId]);

  const setupRestoredRef = useRef(false);
  useEffect(() => {
    if (setupRestoredRef.current || loading || storedSetup === undefined) return;
    if (phase !== "setup") return;
    setupRestoredRef.current = true;
    const counts = { starred: starredCount, wobbly: wobblyCount, due: dueCount };
    // Ohne gemerkte Wahl ist das Tagespensum die Voreinstellung (#610).
    if (!storedSetup) {
      if (counts.due > 0) setSource("due");
      return;
    }
    if (storedSetup.reverse !== undefined) setReverse(storedSetup.reverse);
    if (storedSetup.strict !== undefined) setStrict(storedSetup.strict);
    if (storedSetup.timed !== undefined) setTimed(storedSetup.timed);
    if (storedSetup.typeTF !== undefined) setTypeTF(storedSetup.typeTF);
    if (storedSetup.typeMC !== undefined) setTypeMC(storedSetup.typeMC);
    if (storedSetup.typeWritten !== undefined) setTypeWritten(storedSetup.typeWritten);
    const wanted = resolveSource(storedSetup.source, counts);
    if (wanted) setSource(wanted);
    else if (!storedSetup.source && counts.due > 0) setSource("due");
    // Obergrenze der Anzahl ist der Vorrat der Quelle, die ab jetzt gilt —
    // der Klemm-Effekt oben zieht sie bei Quellenwechseln weiter mit.
    const wantedMax = filterBySource(usableCards, wanted ?? source, wobblyIds).length;
    const storedCount = resolveCount(storedSetup.count, wantedMax);
    if (storedCount !== null) {
      countInitializedRef.current = true;
      setCount(storedCount);
    }
  }, [loading, storedSetup, phase, starredCount, wobblyCount, dueCount, usableCards, source, wobblyIds]);

  const anyType = typeTF || typeMC || typeWritten;

  const startTest = () => {
    const types: TestQuestionType[] = [];
    if (typeTF) types.push("trueFalse");
    if (typeMC) types.push("mc");
    if (typeWritten) types.push("written");
    if (types.length === 0) return;

    const qs = buildTestQuestions(pool, {
      count: count || usableCount,
      types,
      reverse,
    });
    if (qs.length === 0) return;

    // Beim Start die Wahl für dieses Deck merken (#610). „Alle" wird als
    // Absicht gespeichert, nicht als Zahl — das Deck darf wachsen.
    if (deckId)
      void saveSetup(deckId, "test", {
        reverse,
        strict,
        timed,
        typeTF,
        typeMC,
        typeWritten,
        source,
        count: encodeCount(count || usableCount, usableCount),
      });

    setQuestions(qs);
    // Stern-Stand für diese Runde (#610) — frisch aus den Karten, damit ein
    // Markieren in einer anderen Runde dazwischen nicht veraltet mitläuft.
    setStarredMap(Object.fromEntries(pool.map((c) => [c.id, c.starred ?? false])));
    setAnswers(qs.map(() => ({ ...EMPTY_ANSWER })));
    setGraded([]);
    setIdx(0);
    setRemaining(timed ? qs.length * SECONDS_PER_QUESTION : 0);
    // Eine neue Runde darf wieder melden — sonst bliebe „Nochmal" nach einem
    // vorzeitigen Beenden für immer stumm.
    sentRef.current = false;
    roundKeyRef.current = `test-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    attemptRecordedRef.current = false;
    setAborted(false);
    setPhase("play");
  };

  const setAnswer = (i: number, patch: Partial<Answer>) => {
    setAnswers((prev) => prev.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  };

  /**
   * Schließt die Runde ab: bewerten, melden, Ergebnis zeigen.
   *
   * `scope: "all"` ist das normale Abgeben — jede Frage zählt, eine leer
   * gelassene als falsch. `scope: "answered"` ist das vorzeitige Beenden: Dann
   * bleiben nur die Fragen übrig, auf die es wirklich eine Antwort gibt.
   *
   * Vorher meldete die Prüfung gar nichts, bis man abgab. Für die App sah ein
   * Prüfungstag deshalb aus wie ein Tag ohne Lernen (Issue #406, behoben in
   * #409) — und wer vorzeitig rausging, verlor alles trotzdem wieder.
   */
  const finish = (scope: "all" | "answered") => {
    if (sentRef.current) return;
    const keep = scope === "all" ? questions.map((_, i) => i) : answeredIndices(answers);
    const keptQuestions = keep.map((i) => questions[i]!);
    const keptAnswers = keep.map((i) => answers[i] ?? EMPTY_ANSWER);

    const toSend: Array<{ cardId: string; rating: "good" | "again" }> = [];
    const result: Graded[] = keptQuestions.map((q, i) => {
      const correct = gradeAnswer(q, keptAnswers[i]!, strict);
      if (userId) toSend.push({ cardId: q.cardId, rating: correct ? "good" : "again" });
      return { correct, overridden: false };
    });

    sentRef.current = true;
    setQuestions(keptQuestions);
    setAnswers(keptAnswers);
    setGraded(result);
    setAborted(scope === "answered");

    // Bewusst kein await: Das Ergebnis erscheint sofort, das Melden läuft
    // dahinter weiter. Es wird nichts abgerechnet, worauf jemand warten müsste.
    if (toSend.length > 0 && userId) void flushReviews(userId, toSend);

    // Die Prüfung als EINHEIT festhalten — nur bei vollständiger Abgabe. Ein
    // Abbruch (scope "answered") ist keine gültige Prüfungsnote; die
    // beantworteten Karten zählen trotzdem einzeln (oben), nur die Prüfungs-Zeile
    // entsteht nicht.
    if (scope === "all" && userId && keptQuestions.length > 0) {
      attemptRecordedRef.current = true;
      void recordTestAttempt(
        userId,
        deckId,
        roundKeyRef.current,
        keptQuestions.map((q, i) => ({ cardId: q.cardId, correct: result[i]!.correct }))
      ).catch(() => {});
    }

    setPhase("result");
  };

  const submit = () => finish("all");

  // Countdown (only in timed mode). Auto-submits when it hits zero.
  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (phase !== "play" || !timed) return;
    if (remaining <= 0) {
      submit();
      return;
    }
    timerRef.current = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, timed, remaining]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const answeredCount = useMemo(() => answeredIndices(answers).length, [answers]);

  /**
   * Zurück-Taste und Wisch-Geste abfangen, solange eine Prüfung mit Antworten
   * läuft.
   *
   * `usePreventRemove` hält den Bildschirm auf, bis wir entscheiden. Ohne die
   * Nachfrage wäre der Weg raus derselbe wie bisher — und alles Beantwortete
   * wäre weg, ohne dass jemand danach gefragt hätte.
   *
   * Ohne Antworten wird nicht gefragt: Da gibt es nichts zu verlieren, und ein
   * Fenster, das nur „nichts passiert" sagt, ist reine Reibung.
   */
  usePreventRemove(phase === "play" && answeredCount > 0 && !sentRef.current, ({ data }) => {
    Alert.alert(
      "Prüfung beenden?",
      `Du hast ${answeredCount} von ${questions.length} ${
        questions.length === 1 ? "Frage" : "Fragen"
      } beantwortet. Deine bisherigen Antworten werden gespeichert und zählen für Streak, Statistik und Lernplan.`,
      [
        // „Weiter machen" ist der cancel-Knopf (wird fett/betont dargestellt):
        // Wer die Prüfung aus Versehen verlässt, kommt am leichtesten zurück.
        // „Beenden" ist destructive → roter Text.
        { text: "Weiter machen", style: "cancel" },
        {
          text: "Beenden und speichern",
          style: "destructive",
          onPress: () => {
            finish("answered");
            // NICHT dispatch(data.action): Das Ergebnis der beantworteten
            // Fragen soll hier stehenbleiben (Laras Entscheidung). Der
            // Bildschirm wechselt auf „result", die Sperre greift dann nicht
            // mehr, und der nächste Druck auf Zurück geht ohne Nachfrage durch.
            void data;
          },
        },
      ]
    );
  });

  /**
   * Notausgang: Was beim Verlassen noch nicht gemeldet wurde, geht jetzt raus.
   *
   * Fängt alles, was an der Nachfrage vorbeikommt — etwa ein Sprung von außen
   * in die App hinein. Der Effekt hat KEINE Abhängigkeiten und liest den Stand
   * über eine Ref: Liefe er bei jeder Antwort neu, würde seine Aufräum-Funktion
   * mitten in der Prüfung feuern und nach der ersten Frage melden.
   */
  const liveRef = useRef({ phase, questions, answers, strict, userId });
  // Nachführen in einem Effekt ohne Abhängigkeiten, NICHT beim Zeichnen: React
  // darf einen begonnenen Durchlauf verwerfen. Schriebe man die Ref beim
  // Zeichnen, könnte darin ein Stand landen, den es nie auf den Bildschirm
  // geschafft hat.
  useEffect(() => {
    liveRef.current = { phase, questions, answers, strict, userId };
  });
  useEffect(() => {
    return () => {
      const { phase: p, questions: qs, answers: as, strict: st, userId: uid } = liveRef.current;
      if (sentRef.current || p !== "play" || !uid) return;
      const keep = answeredIndices(as);
      if (keep.length === 0) return;
      sentRef.current = true;
      void flushReviews(
        uid,
        keep.map((i) => ({
          cardId: qs[i]!.cardId,
          rating: gradeAnswer(qs[i]!, as[i] ?? EMPTY_ANSWER, st)
            ? ("good" as const)
            : ("again" as const),
        }))
      );
    };
  }, []);

  const scoredCount = graded.filter((g) => g.correct || g.overridden).length;
  const percent =
    questions.length > 0 ? Math.round((scoredCount / questions.length) * 100) : 0;

  // The wrong questions' source cards, ready to hand to a flashcard round. A
  // test stays a test (no re-learning inside it); this just offers to practice
  // the misses in the learning mode. `overridden` answers count as correct.
  const wrongPracticeCards = (() => {
    const ids = new Set(
      questions.filter((_, i) => !(graded[i]?.correct || graded[i]?.overridden)).map((q) => q.cardId),
    );
    return allCards
      .filter((c) => ids.has(c.id))
      .map((c) => ({ id: c.id, front: c.front, back: c.back }));
  })();
  const practiceWrongCards = () => {
    if (wrongPracticeCards.length === 0) return;
    startReview(wrongPracticeCards);
    router.push(`/practice?title=${encodeURIComponent(deckTitle ?? "Falsche Antworten")}`);
  };

  // Persist the latest percentage (updates when an answer is overridden). Eine
  // vorzeitig beendete Runde bleibt draußen: „Letztes Ergebnis: 40 %" nach
  // einem Abbruch bei Frage drei sagt nichts über das Können aus.
  useEffect(() => {
    if (phase === "result" && deckId && !aborted) {
      AsyncStorage.setItem(lastResultKey(deckId), String(percent)).catch(() => {});
      setLastResult(percent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, percent]);

  const overrideCorrect = (i: number) => {
    setGraded((prev) => prev.map((g, j) => (j === i ? { ...g, overridden: true } : g)));

    // Die gespeicherte Prüfungsnote nachziehen: dieselbe Runde (roundKeyRef),
    // eine Karte jetzt zusätzlich als richtig. Nur wenn diese Runde überhaupt
    // eine Prüfungs-Zeile hat — nach einem Abbruch gibt es keine, und ein
    // Override in dessen Durchsicht darf keine anlegen. Der Server nimmt per
    // greatest() die höhere Trefferzahl, das Nachziehen kann also nur steigen.
    if (userId && attemptRecordedRef.current) {
      void recordTestAttempt(
        userId,
        deckId,
        roundKeyRef.current,
        questions.map((q, j) => ({
          cardId: q.cardId,
          correct: !!(graded[j]?.correct || graded[j]?.overridden || j === i),
        }))
      ).catch(() => {});
    }
  };

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

  const cardStyle = {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  } as const;

  if (loading) {
    return (
      <>
        {screenHeader("Test")}
        <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </SafeAreaView>
      </>
    );
  }

  // Load failed (offline / server error) — distinct from "no usable cards".
  if (loadError) {
    return (
      <>
        {screenHeader("Test")}
        <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background, padding: spacing.xxl, gap: spacing.lg }}>
          <Text style={{ fontSize: typography.lg, color: colors.textSecondary, textAlign: "center", lineHeight: 24 }}>
            {t("common.loadError")}
          </Text>
          <TouchableOpacity
            onPress={loadCards}
            activeOpacity={0.8}
            style={{ paddingVertical: spacing.md, paddingHorizontal: spacing.xl, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary }}
          >
            <Text style={{ color: colors.text, fontWeight: typography.semibold }}>{t("common.retry")}</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </>
    );
  }

  if (deckUsableCount === 0) {
    return (
      <>
        {screenHeader("Test")}
        <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background, padding: spacing.xxl }}>
          <HelpCircle size={48} color={colors.textTertiary} />
          <Text style={{ marginTop: spacing.lg, fontSize: typography.lg, color: colors.textSecondary, textAlign: "center" }}>
            Dieses Deck hat keine Karten mit Frage und Antwort für einen Test.
          </Text>
        </SafeAreaView>
      </>
    );
  }

  // ─── Setup ───────────────────────────────────────────────────────────────
  if (phase === "setup") {
    const typeRow = (label: string, value: boolean, onChange: (v: boolean) => void, border = true) => (
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

    return (
      <>
        {screenHeader(deckTitle ?? "Test")}
        <SafeAreaView edges={["bottom"]} style={{ flex: 1, backgroundColor: colors.background }}>
          <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }} showsVerticalScrollIndicator={false}>
            {/* Intro */}
            <View style={{ alignItems: "center", gap: spacing.sm, marginTop: spacing.sm }}>
              <View style={{ width: 60, height: 60, borderRadius: 16, backgroundColor: colors.errorLight, justifyContent: "center", alignItems: "center" }}>
                <FileText size={30} color={colors.error} />
              </View>
              <Text style={{ fontSize: typography.xl, fontWeight: typography.bold, color: colors.text }}>Test einrichten</Text>
              {lastResult != null && (
                <Text style={{ fontSize: typography.sm, color: colors.textSecondary }}>Letztes Ergebnis: {lastResult} %</Text>
              )}
            </View>

            {/* Anzahl Fragen — gemeinsamer Baustein mit dem Quiz (#570) */}
            <QuestionCountPicker count={count} max={usableCount} onChange={setCount} />

            {/* Aufgabentypen */}
            <View style={cardStyle}>
              <Text style={{ fontSize: typography.sm, color: colors.textSecondary, marginBottom: spacing.xs }}>Aufgabentypen</Text>
              {typeRow("Wahr / Falsch", typeTF, setTypeTF)}
              {typeRow("Multiple Choice", typeMC, setTypeMC)}
              {typeRow("Schriftlich (tippen)", typeWritten, setTypeWritten, false)}
              {!anyType && (
                <Text style={{ fontSize: typography.xs, color: colors.error, marginTop: spacing.xs }}>Mindestens ein Typ muss an sein.</Text>
              )}
            </View>

            {/* Kartenquelle — Alle / Nur markierte / Nur Wackelkandidaten */}
            <CardSourcePicker
              value={source}
              onChange={setSource}
              allCount={deckUsableCount}
              starredCount={starredCount}
              wobblyCount={wobblyCount}
              dueCount={dueCount}
            />

            {/* Richtung — one arrow in the middle, tap to swap */}
            <TouchableOpacity onPress={() => setReverse((r) => !r)} activeOpacity={0.8} style={cardStyle}>
              <Text style={{ fontSize: typography.sm, color: colors.textSecondary, marginBottom: spacing.sm }}>Abgefragte Richtung</Text>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={{ flex: 1, textAlign: "right", fontSize: typography.base, fontWeight: typography.semibold, color: colors.text }}>{reverse ? "Rückseite" : "Vorderseite"}</Text>
                <View style={{ width: 44, alignItems: "center" }}>
                  <ArrowRight size={22} color={colors.primary} />
                </View>
                <Text style={{ flex: 1, textAlign: "left", fontSize: typography.base, fontWeight: typography.semibold, color: colors.text }}>{reverse ? "Vorderseite" : "Rückseite"}</Text>
              </View>
              <Text style={{ fontSize: typography.xs, color: colors.textTertiary, textAlign: "center", marginTop: spacing.sm }}>Richtung tauschen</Text>
            </TouchableOpacity>

            {/* Genau prüfen */}
            <View style={{ ...cardStyle, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flex: 1, paddingRight: spacing.md }}>
                <Text style={{ fontSize: typography.base, fontWeight: typography.semibold, color: colors.text }}>Genau prüfen</Text>
                <Text style={{ fontSize: typography.sm, color: colors.textSecondary, marginTop: 2 }}>nur beim Eintippen</Text>
              </View>
              <Switch value={strict} onValueChange={setStrict} trackColor={{ false: colors.surfaceSecondary, true: colors.primary }} thumbColor="#ffffff" ios_backgroundColor={colors.surfaceSecondary} />
            </View>

            {/* Auf Zeit */}
            <View style={{ ...cardStyle, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flex: 1, paddingRight: spacing.md }}>
                <Text style={{ fontSize: typography.base, fontWeight: typography.semibold, color: colors.text }}>Auf Zeit</Text>
                <Text style={{ fontSize: typography.sm, color: colors.textSecondary, marginTop: 2 }}>
                  {timed ? `${formatTime((count || usableCount) * SECONDS_PER_QUESTION)} für die ganze Prüfung` : "optional, ohne Zeitdruck"}
                </Text>
              </View>
              <Switch value={timed} onValueChange={setTimed} trackColor={{ false: colors.surfaceSecondary, true: colors.primary }} thumbColor="#ffffff" ios_backgroundColor={colors.surfaceSecondary} />
            </View>

            <TouchableOpacity
              onPress={startTest}
              disabled={!anyType || usableCount === 0}
              activeOpacity={0.85}
              style={{ backgroundColor: anyType && usableCount > 0 ? colors.primary : colors.surfaceSecondary, paddingVertical: 16, borderRadius: radius.lg, alignItems: "center", ...shadows.md }}
            >
              <Text style={{ color: anyType && usableCount > 0 ? colors.textInverse : colors.textTertiary, fontWeight: typography.bold, fontSize: typography.lg }}>Test starten</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </>
    );
  }

  // ─── Result ──────────────────────────────────────────────────────────────
  if (phase === "result") {
    return (
      <>
        {screenHeader("Ergebnis")}
        <SafeAreaView edges={["bottom"]} style={{ flex: 1, backgroundColor: colors.background }}>
          <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }} showsVerticalScrollIndicator={false}>
            <View style={{ alignItems: "center", gap: spacing.sm }}>
              <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: percent >= 80 ? colors.successLight : percent >= 50 ? colors.warningLight : colors.errorLight, justifyContent: "center", alignItems: "center" }}>
                <Trophy size={38} color={percent >= 80 ? colors.success : percent >= 50 ? colors.warning : colors.error} />
              </View>
              <Text style={{ fontSize: typography.xxxl, fontWeight: typography.extrabold, color: colors.text }}>{percent}%</Text>
              <Text style={{ fontSize: typography.base, color: colors.textSecondary }}>{scoredCount} von {questions.length} richtig</Text>
              {/* Persönliches Lob nur bei voller Punktzahl — eine Prüfung
                  bleibt sonst bewusst nüchtern (wie im Web). */}
              {percent === 100 && (
                <Text style={{ fontSize: typography.base, fontWeight: typography.bold, color: colors.success }}>
                  Volle Punktzahl — stark{displayName ? `, ${displayName}` : ""}!
                </Text>
              )}
              {/* Ohne diesen Satz sähe eine vorzeitig beendete Prüfung aus wie
                  eine vollständige — mit einer Quote, die sich auf weniger
                  Fragen bezieht, als man sich vorgenommen hatte. */}
              {aborted && (
                <Text style={{ fontSize: typography.sm, color: colors.textTertiary, textAlign: "center" }}>
                  Vorzeitig beendet — gewertet sind die {questions.length}{" "}
                  {questions.length === 1 ? "Frage" : "Fragen"}, die du beantwortet hast.
                </Text>
              )}
            </View>

            {/* Durchsicht */}
            <Text style={{ fontSize: typography.sm, color: colors.textSecondary, marginTop: spacing.sm }}>Durchsicht</Text>
            {questions.map((q, i) => {
              const a = answers[i] ?? { mc: null, tf: null, text: "" };
              const g = graded[i] ?? { correct: false, overridden: false };
              const ok = g.correct || g.overridden;
              const yourAnswer =
                q.type === "mc"
                  ? a.mc != null ? q.options[a.mc] ?? "—" : "—"
                  : q.type === "trueFalse"
                    ? a.tf === true ? "Richtig" : a.tf === false ? "Falsch" : "—"
                    : a.text.trim() || "—";
              const solution =
                q.type === "trueFalse"
                  ? q.tfIsCorrect ? "Richtig" : "Falsch"
                  : q.expected;
              return (
                <View key={i} style={{ ...cardStyle, gap: spacing.xs }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                    {ok ? <CheckCircle2 size={18} color={colors.success} /> : <XCircle size={18} color={colors.error} />}
                    <Text style={{ flex: 1, fontSize: typography.sm, fontWeight: typography.semibold, color: colors.text }}>{q.prompt}</Text>
                  </View>
                  {q.type === "trueFalse" && (
                    <Text style={{ fontSize: typography.sm, color: colors.textSecondary }}>Aussage: {q.tfShownBack}</Text>
                  )}
                  <Text style={{ fontSize: typography.sm, color: ok ? colors.success : colors.error }}>Du: {yourAnswer}</Text>
                  {!ok && <Text style={{ fontSize: typography.sm, color: colors.text }}>Lösung: {solution}</Text>}
                  {q.type === "written" && !g.correct && !g.overridden && (
                    <TouchableOpacity onPress={() => overrideCorrect(i)} activeOpacity={0.8} style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, marginTop: spacing.xs, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.success }}>
                      <Check size={16} color={colors.success} />
                      <Text style={{ color: colors.success, fontWeight: typography.semibold, fontSize: typography.sm }}>Trotzdem als richtig zählen</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}

            <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
              <TouchableOpacity onPress={startTest} activeOpacity={0.85} style={{ backgroundColor: colors.primary, paddingVertical: 14, borderRadius: radius.md, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm }}>
                <RotateCcw size={18} color={colors.textInverse} />
                <Text style={{ color: colors.textInverse, fontWeight: typography.bold }}>Alle nochmal</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setPhase("setup")} activeOpacity={0.85} style={{ paddingVertical: 12, borderRadius: radius.md, alignItems: "center" }}>
                <Text style={{ color: colors.textSecondary, fontWeight: typography.semibold, fontSize: typography.base }}>Einstellungen</Text>
              </TouchableOpacity>
              {wrongPracticeCards.length > 0 && (
                <TouchableOpacity onPress={practiceWrongCards} activeOpacity={0.85} style={{ paddingVertical: 8, alignItems: "center" }}>
                  <Text style={{ color: colors.primary, fontWeight: typography.semibold, fontSize: typography.sm, textDecorationLine: "underline" }}>
                    Falsche als Karteikarten üben ({wrongPracticeCards.length})
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      </>
    );
  }

  // ─── Play ────────────────────────────────────────────────────────────────
  const q = questions[idx]!;
  const a = answers[idx] ?? { mc: null, tf: null, text: "" };
  const isLast = idx + 1 >= questions.length;
  const progress = questions.length > 0 ? (idx + 1) / questions.length : 0;

  return (
    <>
      {screenHeader(deckTitle ?? "Test")}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <SafeAreaView edges={["bottom"]} style={{ flex: 1, backgroundColor: colors.background }}>
          <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* Progress + timer */}
            <View style={{ gap: spacing.xs }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: typography.sm, color: colors.textSecondary, fontWeight: typography.medium }}>Frage {idx + 1} von {questions.length}</Text>
                {timed && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
                    <Timer size={14} color={remaining <= 30 ? colors.error : colors.textSecondary} />
                    <Text style={{ fontSize: typography.sm, fontWeight: typography.bold, color: remaining <= 30 ? colors.error : colors.textSecondary }}>{formatTime(remaining)}</Text>
                  </View>
                )}
              </View>
              <View style={{ height: 4, backgroundColor: colors.surfaceSecondary, borderRadius: 2, overflow: "hidden" }}>
                <View style={{ height: "100%", width: `${Math.max(progress * 100, 2)}%`, backgroundColor: colors.primary, borderRadius: 2 }} />
              </View>
            </View>

            {/* Prompt */}
            <View style={{ ...cardStyle, position: "relative", padding: spacing.xl, gap: spacing.md }}>
              <TouchableOpacity
                onPress={() => setEditingCard(true)}
                activeOpacity={0.6}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={{ position: "absolute", top: spacing.md, left: spacing.md }}
              >
                <Pencil size={19} color={colors.textTertiary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => toggleCardStar(q.cardId, starredMap, setStarredMap)}
                activeOpacity={0.6}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={{ position: "absolute", top: spacing.md, right: spacing.md }}
              >
                <Star
                  size={20}
                  color={starredMap[q.cardId] ? colors.warning : colors.textTertiary}
                  fill={starredMap[q.cardId] ? colors.warning : "none"}
                />
              </TouchableOpacity>
              <Text style={{ fontSize: typography.xs, color: colors.textTertiary, textTransform: "uppercase", letterSpacing: 0.5, paddingRight: 28 }}>
                {q.type === "written" ? "Antwort eintippen" : q.type === "mc" ? "Wähle die richtige Antwort" : "Stimmt diese Zuordnung?"}
              </Text>
              <Text style={{ fontSize: typography.xl, fontWeight: typography.semibold, color: colors.text, lineHeight: 30 }}>{q.prompt}</Text>
              {q.type === "trueFalse" && (
                <View style={{ backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md }}>
                  <Text style={{ fontSize: typography.lg, color: colors.text, textAlign: "center" }}>{q.tfShownBack}</Text>
                </View>
              )}
            </View>

            {/* Input by type */}
            {q.type === "written" && (
              <TextInput
                key={idx}
                value={a.text}
                onChangeText={(t) => setAnswer(idx, { text: t })}
                autoFocus
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="done"
                placeholder="Antwort eintippen…"
                placeholderTextColor={colors.textTertiary}
                style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 14, fontSize: typography.lg, backgroundColor: colors.surface, color: colors.text }}
              />
            )}

            {q.type === "mc" && (
              <View style={{ gap: spacing.sm }}>
                {q.options.map((opt, oi) => {
                  const selected = a.mc === oi;
                  return (
                    <TouchableOpacity
                      key={oi}
                      onPress={() => setAnswer(idx, { mc: oi })}
                      activeOpacity={0.8}
                      style={{ backgroundColor: selected ? colors.primaryLight : colors.surface, borderWidth: 2, borderColor: selected ? colors.primary : colors.border, borderRadius: radius.md, padding: 14 }}
                    >
                      <Text style={{ fontSize: typography.base, fontWeight: selected ? typography.semibold : typography.normal, color: selected ? colors.primary : colors.text }}>{opt}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {q.type === "trueFalse" && (
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                {[true, false].map((val) => {
                  const selected = a.tf === val;
                  return (
                    <TouchableOpacity
                      key={String(val)}
                      onPress={() => setAnswer(idx, { tf: val })}
                      activeOpacity={0.8}
                      style={{ flex: 1, backgroundColor: selected ? colors.primaryLight : colors.surface, borderWidth: 2, borderColor: selected ? colors.primary : colors.border, borderRadius: radius.md, paddingVertical: 16, alignItems: "center" }}
                    >
                      <Text style={{ fontSize: typography.base, fontWeight: typography.semibold, color: selected ? colors.primary : colors.text }}>{val ? "Richtig" : "Falsch"}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Back to the previous question (answers stay editable until
                Abgeben — like flipping pages in a real exam) + next/submit */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <TouchableOpacity
                onPress={() => setIdx((i) => Math.max(0, i - 1))}
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
              <TouchableOpacity
                onPress={() => (isLast ? submit() : setIdx((i) => i + 1))}
                activeOpacity={0.85}
                style={{ flex: 1, backgroundColor: colors.primary, paddingVertical: 15, borderRadius: radius.md, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, ...shadows.sm }}
              >
                <Text style={{ color: colors.textInverse, fontWeight: typography.bold, fontSize: typography.base }}>{isLast ? "Abgeben" : "Weiter"}</Text>
                {!isLast && <ArrowRight size={18} color={colors.textInverse} />}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
      <CardEditor
        visible={editingCard}
        card={
          q
            ? (() => {
                const raw = allCards.find((c) => c.id === q.cardId);
                return raw ? { front: raw.front, back: raw.back, difficulty: "medium" } : null;
              })()
            : null
        }
        saving={savingCard}
        onCancel={() => setEditingCard(false)}
        onSave={async ({ front, back }) => {
          if (!q) return;
          setSavingCard(true);
          try {
            const { card: updated } = await updateCard(q.cardId, { front, back });
            // Nur die Karte selbst patchen (#610) — die schon gebaute Frage
            // dieser Runde bleibt unverändert. Die nächste Runde baut aus dem
            // aktualisierten Text neu.
            setAllCards((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
            setEditingCard(false);
          } catch {
            // Speichern fehlgeschlagen — Editor bleibt offen.
          } finally {
            setSavingCard(false);
          }
        }}
      />
    </>
  );
}

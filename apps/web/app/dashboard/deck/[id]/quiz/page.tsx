"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/app/auth-context";
import { listCardsInDeck, reviewCard, updateCard, earnLp, getStats, isApiError, type Card } from "@/lib/api";
import { CardEditor } from "@/components/app/card-editor";
import { dailyGoalLine } from "@/lib/daily-goal-line";
import { useDisplayName } from "@/lib/use-display-name";
import { toggleCardStar } from "@/lib/toggle-card-star";
import { useWobblyIds } from "@/lib/use-wobbly-ids";
import { filterBySource, isCardDue, type CardSource } from "@/lib/card-source";
import {
  encodeCount,
  loadSetup,
  resolveCount,
  resolveSource,
  saveSetup,
} from "@/lib/setup-memory";
import { CardSourcePicker } from "@/components/app/card-source-picker";
import { QuestionCountPicker } from "@/components/app/question-count-picker";
import { countQuizableCards, generateQuestions, type QuizQuestion } from "@/lib/quizQuestions";
import {
  beginSessionAward,
  getSessionReviewedCount,
  isSessionEarnFinalized,
  type SessionAwardState,
} from "@/lib/learn-session-lp";
import {
  isCardGone,
  persistedReviewCount,
  unsavedReviewsNotice,
} from "@/lib/unsaved-reviews";
import {
  ArrowLeft,
  X,
  Check,
  CheckCircle,
  Trophy,
  Star,
  Pencil,
  Zap,
  AlertTriangle,
  ListChecks,
} from "@/components/icons";

export default function QuizPage() {
  const params = useParams<{ id: string }>();
  const deckId = params.id;
  const router = useRouter();
  const { userId } = useAuth();
  const displayName = useDisplayName();

  const [cards, setCards] = useState<Card[]>([]);
  // Stern-Stand der laufenden Runde, für sofort sichtbares Markieren (#610).
  const [starredMap, setStarredMap] = useState<Record<string, boolean>>({});
  // Stift-Knopf (#610): öffnet den Karten-Editor, ohne die Runde zu verlassen.
  // Patcht nur die Karte selbst — die schon gebauten Fragen (Optionen,
  // richtige Antwort) ändern sich erst in der nächsten Runde.
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Im Setup-Menü gewählte Einstellungen
  const [reverse, setReverse] = useState(false);
  const [allowMc, setAllowMc] = useState(true);
  const [allowTrueFalse, setAllowTrueFalse] = useState(true);
  const [source, setSource] = useState<CardSource>("all");
  // Rundenlänge — wählbar wie bei der Prüfung (#570). Standard 10 (Laras
  // Entscheidung 28.07.); vorher lief das Web ungebremst durchs ganze Deck.
  const [count, setCount] = useState(10);
  const { ids: wobblyIds, settled: wobblySettled } = useWobblyIds(deckId);

  const [phase, setPhase] = useState<"setup" | "play" | "result">("setup");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [answers, setAnswers] = useState<boolean[]>([]);

  const [earned, setEarned] = useState<number | null>(null);
  const [earnCapReached, setEarnCapReached] = useState(false);
  const [dailyGoalText, setDailyGoalText] = useState<string | null>(null);
  const awardStateRef = useRef<SessionAwardState>({ finalized: false, inFlight: null });
  const pendingReviewsRef = useRef<Promise<unknown>[]>([]);
  // Endgültig verlorene Bewertungen (#605): Ref für die Abrechnung, State für
  // die Ergebnis-Zeile — immer zusammen fortgeschrieben.
  const unsavedRef = useRef(0);
  const [unsavedCount, setUnsavedCount] = useState(0);

  // Tagesziel im Rundenergebnis (#610): jede Karte wurde schon während der
  // Runde einzeln ans Backend gemeldet, `reviewsToday` ist beim Abschluss also
  // schon aktuell.
  useEffect(() => {
    if (phase !== "result") return;
    let cancelled = false;
    getStats()
      .then(({ stats }) => {
        if (!cancelled) setDailyGoalText(dailyGoalLine(stats.dailyGoal, stats.reviewsToday));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [phase]);

  const load = useCallback(async () => {
    if (!deckId) return;
    try {
      const { cards: c } = await listCardsInDeck(deckId);
      // Bild-Occlusion-Karten gehören nur in den Occlusion-Modus (kein Bild hier).
      setCards(c.filter((x) => x.type !== "occlusion"));
      setError(null);
    } catch (e) {
      setError(isApiError(e) ? e.message : "Karten konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [deckId]);

  useEffect(() => {
    load();
  }, [load]);

  const anyType = allowMc || allowTrueFalse;
  const total = questions.length;
  const q = questions[index];
  const answered = picked !== null;

  // Die gewählte Kartenquelle (Alle / Nur markierte / Nur Wackelkandidaten).
  const sourced = useMemo(
    () => filterBySource(cards, source, wobblyIds),
    [cards, source, wobblyIds]
  );
  // Obergrenze der Anzahl-Auswahl: EXAKT die Pool-Regel der Fragen-Erzeugung
  // (#612) — nach der Aufbereitung leere Seiten fallen raus, Doppel-Scans
  // zählen einmal. Die alte reine Text-Prüfung versprach „Alle (12)" und
  // lieferte dann 10 Fragen.
  const usableCount = useMemo(() => countQuizableCards(sourced), [sourced]);

  // Schrumpft der Pool (andere Kartenquelle), darf die gewählte Anzahl nicht
  // darüber liegen; nur klemmen, nie zurückwachsen (10 bleibt der Standard).
  useEffect(() => {
    if (usableCount > 0) setCount((c) => Math.min(c, usableCount));
  }, [usableCount]);

  // #610: Die Schalter der letzten Runde sofort beim Öffnen vorbelegen — da
  // steht noch der Spinner, es kann also keine eigene Wahl überschrieben
  // werden. Quelle und Anzahl folgen im Effekt darunter, sobald feststeht,
  // ob die gemerkte Quelle heute wieder Karten hätte.
  useEffect(() => {
    const stored = loadSetup(deckId, "quiz");
    if (stored?.reverse !== undefined) setReverse(stored.reverse);
    if (stored?.typeMC !== undefined) setAllowMc(stored.typeMC);
    if (stored?.typeTF !== undefined) setAllowTrueFalse(stored.typeTF);
  }, [deckId]);

  const setupRestoredRef = useRef(false);
  const setupTouchedRef = useRef(false);
  useEffect(() => {
    if (setupRestoredRef.current || setupTouchedRef.current) return;
    if (phase !== "setup" || loading || !wobblySettled) return;
    setupRestoredRef.current = true;
    const stored = loadSetup(deckId, "quiz");
    // Multiple Choice braucht 2 Karten (Ablenker) — eine Quelle mit weniger
    // darf nie vorbelegt werden, sonst steht man vor gesperrtem Start.
    const usable = (n: number) => (n >= 2 ? n : 0);
    const counts = {
      starred: usable(cards.filter((c) => c.starred).length),
      wobbly: usable(cards.filter((c) => wobblyIds.has(c.id)).length),
      due: usable(cards.filter((c) => isCardDue(c)).length),
    };
    // Ohne gemerkte Wahl ist das Tagespensum die Voreinstellung (#610).
    if (!stored) {
      if (counts.due > 0) setSource("due");
      return;
    }
    const wanted = resolveSource(stored.source, counts);
    if (wanted) setSource(wanted);
    else if (!stored.source && counts.due > 0) setSource("due");
    // Obergrenze der Anzahl ist der Vorrat der Quelle, die ab jetzt gilt —
    // der Klemm-Effekt oben zieht sie bei Quellenwechseln weiter mit.
    const pool = filterBySource(cards, wanted ?? source, wobblyIds);
    const max = pool.filter((c) => (c.front || "").trim() && (c.back || "").trim()).length;
    const storedCount = resolveCount(stored.count, max);
    if (storedCount !== null) setCount(storedCount);
  }, [deckId, phase, loading, wobblySettled, cards, wobblyIds, source]);

  const awardSession = useCallback((count: number) => {
    const state = awardStateRef.current;
    return beginSessionAward(state, count, async () => {
      try {
        const maxAttempts = 3;
        const retryDelayMs = 250;

        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
          if (attempt > 0) {
            await new Promise((resolve) => window.setTimeout(resolve, retryDelayMs));
          }

          const pendingReviews = pendingReviewsRef.current;
          pendingReviewsRef.current = [];
          await Promise.allSettled(pendingReviews);

          // Erst NACH dem Abwarten zählen (#605): Beansprucht wird nur, was
          // der Server wirklich gespeichert hat — abgelehnte Bewertungen
          // gelöschter Karten gehen ab.
          const saved = persistedReviewCount(count, unsavedRef.current);
          if (saved === 0) {
            state.finalized = true;
            break;
          }

          const res = await earnLp("session", saved);
          setEarned(res.granted);
          setEarnCapReached(res.capReached);

          if (isSessionEarnFinalized(res, saved)) {
            state.finalized = true;
            break;
          }
        }
      } catch {
        /* LP-Gutschrift ist best-effort */
      }
    });
  }, []);

  // „Beenden" ist nicht der einzige Ausgang: Browser-Zurück oder ein Link
  // verlassen die Runde ohne quit(). Nur dieses Abbau-Aufräumen sieht das
  // noch und rechnet die bis dahin beantworteten Fragen ab (App-Vorbild: das
  // Blur-Cleanup in quiz.tsx, #566). Die Anzahl kommt aus pendingReviewsRef —
  // jede Antwort stößt genau einen Review an; `answers` wäre hier nur der
  // eingefrorene Stand vom Einhängen. Nach einer regulären Abrechnung ist der
  // Ref leer bzw. der Award abgeschlossen, dann tut das hier nichts.
  useEffect(() => {
    return () => {
      const reviewedCount = getSessionReviewedCount(0, pendingReviewsRef.current.length);
      void awardSession(reviewedCount);
    };
  }, [awardSession]);

  // Startet eine Runde mit den übergebenen Karten (alle Karten oder nur die
  // nicht gewussten). Schreibt zuerst die LP der eben beendeten Runde gut und
  // setzt danach den Award-Zustand + offene Reviews zurück.
  const startQuizWith = useCallback(async (cardsForRound: Card[]) => {
    await awardSession(total);
    const qs = generateQuestions(cardsForRound, { reverse, allowMc, allowTrueFalse, count });
    awardStateRef.current = { finalized: false, inFlight: null };
    pendingReviewsRef.current = [];
    unsavedRef.current = 0;
    setUnsavedCount(0);
    setEarned(null);
    setEarnCapReached(false);
    setQuestions(qs);
    // Stern-Stand für diese Runde (#610) — frisch aus den Karten, damit ein
    // Markieren in einer anderen Runde dazwischen nicht veraltet mitläuft.
    setStarredMap(Object.fromEntries(cardsForRound.map((c) => [c.id, c.starred ?? false])));
    setIndex(0);
    setPicked(null);
    setAnswers([]);
    setPhase("play");
  }, [reverse, allowMc, allowTrueFalse, count, awardSession, total]);

  // „Alle nochmal" wie der Start: immer die gewählte Kartenquelle.
  const startQuiz = useCallback(
    () => startQuizWith(sourced),
    [startQuizWith, sourced]
  );

  function pick(i: number) {
    if (picked !== null || !q) return;
    setPicked(i);
    const correct = i === q.correctIndex;
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = correct;
      return next;
    });
    if (userId) {
      // Bis Schritt 8 schickte ein TREFFER gar nichts — nur so ließ sich
      // verhindern, dass Raten die Planung vorspult (#210). Der Preis war
      // absurd: Wer alles richtig hatte, bekam null Lernpunkte, weil die aus
      // genau diesen Zeilen entstehen. „Warum bekommt man nur Punkte, wenn man
      // was falsch hat?"
      //
      // Jetzt trägt jede Antwort mode:"quiz". Der Server schreibt den Eintrag
      // (Punkte, Streak, Statistik), lässt die Planung bei einem Treffer aber
      // in Ruhe — movesTheSchedule in reviewService. Das Versprechen aus #210
      // hält also weiterhin, nur ohne die Nebenwirkung.
      const reviewPromise = reviewCard(userId, q.cardId, correct ? "good" : "again", {
        mode: "quiz",
      }).catch((error) => {
        // Karte inzwischen gelöscht (#605): endgültig verloren — zählen und am
        // Rundenende ehrlich ausweisen. Alles andere bleibt best-effort.
        if (isCardGone(error)) {
          unsavedRef.current += 1;
          setUnsavedCount(unsavedRef.current);
        }
      });
      pendingReviewsRef.current.push(reviewPromise);
    }
  }

  function next() {
    if (index + 1 >= total) {
      const reviewedCount = getSessionReviewedCount(total, pendingReviewsRef.current.length);
      void awardSession(reviewedCount);
      setPhase("result");
      return;
    }
    setPicked(null);
    setIndex((i) => i + 1);
  }

  async function quit() {
    const answeredCount = answers.filter((a) => a !== undefined).length;
    const reviewedCount = getSessionReviewedCount(
      answeredCount,
      pendingReviewsRef.current.length,
    );
    await awardSession(reviewedCount);
    router.push(`/dashboard/deck/${deckId}`);
  }

  if (loading) return <div className="spinner" />;

  if (error) {
    return (
      <div className="empty-state">
        <div className="ic" aria-hidden>
          <AlertTriangle size={30} />
        </div>
        <h3>Konnte nicht laden</h3>
        <p>{error}</p>
        <Link href={`/dashboard/deck/${deckId}`} className="btn btn-primary">
          Zurück zum Deck
        </Link>
      </div>
    );
  }

  if (cards.length < 2) {
    return (
      <div className="empty-state">
        <div className="ic" aria-hidden>
          <ListChecks size={30} />
        </div>
        <h3>Zu wenige Karten</h3>
        <p>Für Multiple Choice braucht das Deck mindestens 2 Karten.</p>
        <Link href={`/dashboard/deck/${deckId}`} className="btn btn-primary">
          Zurück zum Deck
        </Link>
      </div>
    );
  }

  // ---------- Setup ----------
  if (phase === "setup") {
    const leftSide = reverse ? "Rückseite" : "Vorderseite";
    const rightSide = reverse ? "Vorderseite" : "Rückseite";
    const starredCount = cards.filter((c) => c.starred).length;
    const wobblyCount = cards.filter((c) => wobblyIds.has(c.id)).length;
    return (
      <div className="study-wrap">
        <Link href={`/dashboard/deck/${deckId}`} className="crumb">
          <ArrowLeft size={16} /> Zurück zum Deck
        </Link>

        <div className="cl-intro">
          <span
            className="cl-intro__ic"
            aria-hidden
            style={{ background: "rgba(139,92,246,0.14)", color: "var(--violet)" }}
          >
            <ListChecks size={30} />
          </span>
          <h1 className="h2">Multiple Choice</h1>
          <p className="muted">Antwort aus Optionen wählen</p>
        </div>

        <CardSourcePicker
          value={source}
          onChange={(next) => {
            // Eigene Wahl schlägt die Vorbelegung — auch wenn die
            // Wackelkandidaten erst danach eintreffen (#610).
            setupTouchedRef.current = true;
            setSource(next);
          }}
          allCount={cards.length}
          starredCount={starredCount}
          wobblyCount={wobblyCount}
          dueCount={cards.filter((c) => isCardDue(c)).length}
          minCount={2}
        />

        <button type="button" className="cl-dir" onClick={() => setReverse((r) => !r)}>
          <div className="cl-dir__lbl">Abgefragte Richtung</div>
          <div className="cl-dir__row">
            <b>{leftSide}</b>
            <span className="cl-dir__arrow" aria-hidden>
              <ArrowLeft size={20} style={{ transform: "rotate(180deg)" }} />
            </span>
            <b>{rightSide}</b>
          </div>
          <div className="cl-dir__hint">Richtung tauschen</div>
        </button>

        {/* Anzahl Fragen — wählbar wie bei der Prüfung (#570) */}
        <QuestionCountPicker
          count={count}
          max={usableCount}
          onChange={(next) => {
            setupTouchedRef.current = true;
            setCount(next);
          }}
        />

        <div className="cl-optcard">
          <div className="cl-dir__lbl">Fragetypen</div>
          <div className="quiz-typerow">
            <span>Multiple Choice</span>
            <button
              type="button"
              className={`cl-switch${allowMc ? " on" : ""}`}
              role="switch"
              aria-checked={allowMc}
              aria-label="Multiple Choice"
              onClick={() => setAllowMc((v) => !v)}
            >
              <i />
            </button>
          </div>
          <div className="quiz-typerow">
            <span>Wahr / Falsch</span>
            <button
              type="button"
              className={`cl-switch${allowTrueFalse ? " on" : ""}`}
              role="switch"
              aria-checked={allowTrueFalse}
              aria-label="Wahr / Falsch"
              onClick={() => setAllowTrueFalse((v) => !v)}
            >
              <i />
            </button>
          </div>
          {!anyType && (
            <div style={{ fontSize: "0.75rem", color: "#ef4444", marginTop: 6 }}>
              Mindestens ein Typ muss an sein.
            </div>
          )}
        </div>

        <button
          type="button"
          className="btn btn-primary btn-lg btn-block"
          disabled={!anyType}
          onClick={() => {
            // Beim Start die Wahl für dieses Deck merken (#610). „Alle" wird
            // als Absicht gespeichert, nicht als Zahl — das Deck darf wachsen.
            saveSetup(deckId, "quiz", {
              reverse,
              typeMC: allowMc,
              typeTF: allowTrueFalse,
              source,
              count: encodeCount(count, usableCount),
            });
            void startQuiz();
          }}
        >
          Starten
        </button>
      </div>
    );
  }

  // ---------- Ergebnis ----------
  if (phase === "result") {
    const correct = answers.filter(Boolean).length;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    // Nicht gewusst = Karten hinter falsch beantworteten Fragen (per cardId
    // dedupliziert; eine Karte kann mehrere Fragen tragen).
    const wrongCardIds = Array.from(
      new Set(questions.filter((_, i) => answers[i] === false).map((qq) => qq.cardId)),
    );
    const wrongCards = cards.filter((c) => wrongCardIds.includes(c.id));
    // Multiple Choice braucht mind. 2 Karten für Ablenker — bei weniger würde
    // generateQuestions keine Fragen liefern, dann Knopf ausblenden.
    const canRetryWrong = wrongCards.length >= 2;
    const allRight = correct === total;
    // Der Name gehört nur in die fehlerfreie Runde — wie überall sonst.
    const msg = allRight
      ? `Hervorragend${displayName ? `, ${displayName}` : ""}! Du beherrschst den Stoff.`
      : pct >= 80
        ? "Hervorragend! Du beherrschst den Stoff."
        : pct >= 50
          ? "Gut! Etwas mehr Übung und du hast es drauf."
          : "Weiter üben! Wiederholung ist der Schlüssel.";
    return (
      <div className="study-wrap">
        <div className="study-done">
          {/* Immer die grüne Trophäe im grünen Kreis (App-Kanon, #595 Teil C):
              eine geschaffte Runde ist nie ein Misserfolg — die Bewertung trägt
              die Prozentzahl. */}
          <div className="big big--ring" aria-hidden>
            <Trophy size={42} />
          </div>
          <div style={{ fontSize: "2.6rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
            {pct}%
          </div>
          <p className="lead" style={{ margin: 0 }}>
            {correct} von {total} richtig
          </p>
          <p className="muted" style={{ margin: 0 }}>
            {msg}
          </p>
          {/* Ehrliche Zeile (#605): was der Server nie gespeichert hat, weil
              die Karten inzwischen gelöscht wurden. */}
          {unsavedCount > 0 && (
            <p className="study-unsaved">{unsavedReviewsNotice(unsavedCount)}</p>
          )}
          {earned !== null && earned > 0 && (
            <span className="lp-pill">
              <Zap size={15} /> +{earned} Lernpunkte
            </span>
          )}
          {earned === 0 && earnCapReached && (
            <p className="muted" style={{ fontSize: "0.9rem" }}>
              Heutiges Lernpunkte-Limit erreicht — morgen gibt es wieder welche.
            </p>
          )}
          {dailyGoalText && (
            <p className="muted" style={{ fontSize: "0.9rem" }}>
              {dailyGoalText}
            </p>
          )}

          <div className="quiz-sum">
            {questions.map((qq, i) => {
              const ok = answers[i];
              // Wahr/Falsch: nur die Vorderseite plus „Richtig: Falsch" las sich
              // wie ein Widerspruch, weil die geprüfte Zuordnung fehlte (#497).
              // Farbe = hast du die Frage getroffen, Zeichen (=/≠) = gehört das
              // gezeigte Paar wirklich zusammen. Weil man aus Häkchen+Zeichen
              // den eigenen Tipp erst zusammenreimen musste, nennt der Satz ihn
              // wörtlich („Du hast ‚Falsch' getippt — …") und sagt direkt, wie
              // es wirklich ist; bei einem Schwindel-Paar folgt die echte Antwort.
              const tf = qq.type === "trueFalse" ? qq.tfPairing : undefined;
              const label = tf
                ? `${tf.front} ${tf.isCorrect ? "=" : "≠"} ${tf.back}`
                : qq.questionText;
              // Getippt wurde der richtige Knopf genau dann, wenn die Antwort
              // stimmt — der richtige Knopf heißt „Richtig", wenn das Paar echt ist.
              const tfNote = tf
                ? `Du hast „${ok === tf.isCorrect ? "Richtig" : "Falsch"}“ getippt — ${
                    ok ? "passt:" : "doch"
                  } das Paar gehört ${tf.isCorrect ? "wirklich" : "nicht"} zusammen.`
                : null;
              return (
                <div key={i} className={`quiz-sum__row ${ok ? "ok" : "no"}`}>
                  {/* Häkchen/Kreuz sind aria-hidden — das Wort sagt es (#613). */}
                  <span className="sr-only">{ok ? "Richtig:" : "Falsch:"}</span>
                  <span
                    aria-hidden
                    style={{ color: ok ? "var(--green)" : "#ef4444", flex: "none" }}
                  >
                    {ok ? <CheckCircle size={18} /> : <X size={18} />}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className={`quiz-sum__q${tf ? " quiz-sum__q--wrap" : ""}`}>
                      {label}
                    </div>
                    {tf ? (
                      <>
                        <div className="quiz-sum__note">{tfNote}</div>
                        {!tf.isCorrect && (
                          <div className="quiz-sum__fix">
                            Tatsächlich gehört dazu: {tf.correctBack}
                          </div>
                        )}
                      </>
                    ) : (
                      !ok && <div className="quiz-sum__fix">Richtig: {qq.correctAnswer}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: "grid", gap: 8, width: "100%", maxWidth: 320 }}>
            {canRetryWrong && (
              <button
                type="button"
                className="btn btn-primary btn-block"
                onClick={() => startQuizWith(wrongCards)}
              >
                Nur die nicht gewussten ({wrongCards.length})
              </button>
            )}
            <button
              type="button"
              className={canRetryWrong ? "btn btn-ghost btn-block" : "btn btn-primary btn-block"}
              onClick={startQuiz}
            >
              Alle nochmal
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-block"
              style={{ border: "none", boxShadow: "none" }}
              onClick={() => setPhase("setup")}
            >
              Einstellungen
            </button>
            {/* Weg zurück zum Deck wie beim Karteikarten-Ergebnis (#499) */}
            <Link
              href={`/dashboard/deck/${deckId}`}
              className="btn btn-ghost btn-block"
              style={{ border: "none", boxShadow: "none" }}
            >
              Zurück zum Deck
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Spielen ----------
  if (total === 0) {
    return (
      <div className="empty-state">
        <div className="ic" aria-hidden>
          <ListChecks size={30} />
        </div>
        <h3>Keine Fragen</h3>
        <p>Für diese Auswahl lassen sich keine Fragen bilden. Ändere die Einstellungen.</p>
        <button type="button" className="btn btn-primary" onClick={() => setPhase("setup")}>
          Zu den Einstellungen
        </button>
      </div>
    );
  }

  return (
    <div className="study-wrap">
      <div className="study-top">
        <button
          type="button"
          className="crumb"
          style={{ margin: 0, background: "none", border: "none", cursor: "pointer" }}
          onClick={quit}
        >
          <X size={16} /> Beenden
        </button>
        <div className="progress">
          <i style={{ width: `${((index + (answered ? 1 : 0)) / total) * 100}%` }} />
        </div>
        <span className="muted" style={{ fontWeight: 700, fontSize: "0.9rem" }}>
          Frage {index + 1} von {total}
        </span>
      </div>

      <div className="cl-prompt">
        {q && (
          <>
            <button
              type="button"
              className="prompt-edit-btn"
              aria-label="Karte bearbeiten"
              onClick={() => setEditing(true)}
            >
              <Pencil size={16} />
            </button>
            <button
              type="button"
              className={`prompt-star-btn${starredMap[q.cardId] ? " is-starred" : ""}`}
              aria-label={starredMap[q.cardId] ? "Markierung entfernen" : "Karte markieren"}
              aria-pressed={starredMap[q.cardId] ?? false}
              onClick={() => toggleCardStar(q.cardId, starredMap, setStarredMap)}
            >
              <Star size={17} />
            </button>
          </>
        )}
        <div className="quiz-eyebrow">
          {q?.type === "trueFalse" ? "Wahr / Falsch" : "Multiple Choice"}
        </div>
        {q?.type === "trueFalse" && q.tfPairing ? (
          <>
            <div className="quiz-sub">{q.questionText}</div>
            <div className="tf-pair">
              <div className="tf-pair__front">{q.tfPairing.front}</div>
              <div className="tf-pair__hr" />
              <div className="tf-pair__back">= {q.tfPairing.back}</div>
            </div>
          </>
        ) : (
          <div className="cl-q">{q?.questionText}</div>
        )}
      </div>

      <div className="quiz-options">
        {q?.options.map((opt, i) => {
          const isCorrect = i === q.correctIndex;
          const isPicked = i === picked;
          let cls = "quiz-opt";
          if (answered && isCorrect) cls += " quiz-opt--correct";
          else if (answered && isPicked) cls += " quiz-opt--wrong";
          return (
            <button
              key={`${opt}-${i}`}
              type="button"
              className={cls}
              disabled={answered}
              onClick={() => pick(i)}
            >
              <span>{opt}</span>
              {answered && isCorrect && <Check size={18} className="quiz-opt__mark" />}
              {answered && isPicked && !isCorrect && <X size={18} className="quiz-opt__mark" />}
            </button>
          );
        })}
      </div>

      {/* Sichtbares Urteil + Live-Region (#613): Farbe und stumme Icons allein
          erreichen weder Farbenblinde noch Screenreader-Nutzer. Die Region ist
          dauerhaft da, weil Screenreader nur Änderungen in einer schon
          vorhandenen Region zuverlässig vorlesen. */}
      <div className="sr-only" role="status">
        {answered && q
          ? picked === q.correctIndex
            ? "Richtig."
            : q.type === "trueFalse"
              ? "Falsch."
              : `Falsch. Richtige Antwort: ${q.options[q.correctIndex] ?? ""}`
          : ""}
      </div>
      {answered && q && (
        <div className="center" style={{ marginTop: 20 }}>
          <p className={`quiz-verdict ${picked === q.correctIndex ? "ok" : "no"}`}>
            {picked === q.correctIndex ? "Richtig!" : "Leider falsch."}
          </p>
          <button type="button" className="btn btn-primary btn-lg" onClick={next}>
            {index + 1 >= total ? "Ergebnis" : "Weiter"}
          </button>
        </div>
      )}
      {editing && q && (
        <CardEditor
          initial={cards.find((c) => c.id === q.cardId)}
          onClose={() => setEditing(false)}
          onSubmit={async (front, back) => {
            const { card: updated } = await updateCard(q.cardId, { front, back });
            // Nur die Karte selbst patchen (#610) — die schon gebauten Fragen
            // dieser Runde bleiben unverändert, damit Optionen und richtige
            // Antwort zueinander passen. Die nächste Runde baut aus dem
            // aktualisierten Text neu.
            setCards((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
            setEditing(false);
          }}
        />
      )}
    </div>
  );
}

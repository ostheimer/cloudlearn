"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/app/auth-context";
import { Modal } from "@/components/app/modal";
import {
  listCardsInDeck,
  reviewCard,
  recordTestAttempt,
  isApiError,
  type Card,
} from "@/lib/api";
import { useDisplayName } from "@/lib/use-display-name";
import { useWobblyIds } from "@/lib/use-wobbly-ids";
import { filterBySource, type CardSource } from "@/lib/card-source";
import { CardSourcePicker } from "@/components/app/card-source-picker";
import { isAnswerCorrect } from "@/lib/answerCheck";
import {
  answeredIndices,
  buildTestQuestions,
  type TestAnswer,
  type TestQuestion,
  type TestQuestionType,
} from "@/lib/testQuestions";
import {
  ArrowLeft,
  ChevronRight,
  X,
  Check,
  CheckCircle,
  Clock,
  Trophy,
  RotateCw,
  AlertTriangle,
  FileText,
} from "@/components/icons";

const SECONDS_PER_QUESTION = 30;

// Wie viele Antworten beim Abgeben gleichzeitig zum Server gehen. Klein genug,
// dass eine künftige Bremse auf der Review-Route nicht anschlägt, groß genug,
// dass auch eine lange Prüfung in Sekundenbruchteilen durch ist.
const REVIEW_CHUNK_SIZE = 25;

type Answer = TestAnswer;
type Graded = { correct: boolean; overridden: boolean };

const EMPTY_ANSWER: Answer = { mc: null, tf: null, text: "" };

const lastResultKey = (deckId: string) => `clearn:test:last:${deckId}`;

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
 * abweisen und die Antworten wären still weg.
 *
 * Modul-Ebene statt im Bauteil, weil auch der Notausgang sie braucht: Beim
 * Verlassen läuft sie aus der Aufräum-Funktion heraus weiter, wenn der
 * Bildschirm längst weg ist. Ein `fetch` überlebt einen Seitenwechsel innerhalb
 * der App — nur das Schließen des Tabs nicht.
 */
async function flushReviews(
  userId: string,
  toSend: ReadonlyArray<{ cardId: string; rating: "good" | "again" }>
): Promise<void> {
  for (let i = 0; i < toSend.length; i += REVIEW_CHUNK_SIZE) {
    const chunk = toSend.slice(i, i + REVIEW_CHUNK_SIZE);
    await Promise.allSettled(
      chunk.map((r) => reviewCard(userId, r.cardId, r.rating, { mode: "test" }).catch(() => {}))
    );
  }
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const x = s % 60;
  return `${m}:${x.toString().padStart(2, "0")}`;
}

export default function TestPage() {
  const params = useParams<{ id: string }>();
  const deckId = params.id;
  const router = useRouter();
  const { userId } = useAuth();
  const displayName = useDisplayName();

  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<number | null>(null);

  const [count, setCount] = useState(0);
  const [typeTF, setTypeTF] = useState(true);
  const [typeMC, setTypeMC] = useState(true);
  const [typeWritten, setTypeWritten] = useState(true);
  const [strict, setStrict] = useState(true);
  const [reverse, setReverse] = useState(false);
  const [timed, setTimed] = useState(false);
  const [source, setSource] = useState<CardSource>("all");
  const wobblyIds = useWobblyIds(deckId);

  const [phase, setPhase] = useState<"setup" | "play" | "result">("setup");
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [graded, setGraded] = useState<Graded[]>([]);
  const [idx, setIdx] = useState(0);
  const [remaining, setRemaining] = useState(0);
  // Merkt sich, ob die Runde auf „Schriftlich" zurückgefallen ist (zu wenige
  // offene Karten für Wahr/Falsch bzw. Multiple Choice) — für den Hinweis im Spiel.
  const [fellBackToWritten, setFellBackToWritten] = useState(false);
  // Nachfrage vor dem vorzeitigen Beenden.
  const [leavePrompt, setLeavePrompt] = useState(false);
  // Wurde diese Runde vorzeitig beendet? Dann ist die Prozentzahl auf weniger
  // Fragen berechnet, als man sich vorgenommen hatte, und darf NICHT als
  // „Letztes Ergebnis" stehenbleiben.
  const [aborted, setAborted] = useState(false);
  /**
   * Sind die Antworten dieser Runde schon rausgegangen?
   *
   * Es gibt drei Wege hinaus — Abgeben, vorzeitig Beenden und der Notausgang
   * beim Verlassen des Bildschirms. Ohne diese Sperre könnten zwei davon
   * zusammenfallen und dieselbe Karte doppelt melden: einmal „nicht gewusst",
   * einmal dasselbe nochmal. Die Statistik hätte doppelte Zeilen und der
   * Streak-Tag wäre zweimal gezählt.
   */
  const sentRef = useRef(false);
  // Ein stabiler Schlüssel je Prüfungsrunde: Gibt man im Zeit-Modus doppelt ab
  // (Uhr läuft ab, während man tippt) oder klickt schnell zweimal, soll daraus
  // EINE test_attempts-Zeile werden, nicht zwei. Der Server entdoppelt darüber.
  const roundKeyRef = useRef("");
  // Wurde für DIESE Runde eine Prüfungs-Zeile geschrieben (nur bei voller
  // Abgabe)? Nur dann darf „Trotzdem als richtig zählen" die Note nachziehen —
  // sonst legte ein Override im Durchsicht-Bildschirm einer ABGEBROCHENEN
  // Prüfung nachträglich doch eine Zeile an.
  const attemptRecordedRef = useRef(false);

  // Keine LP-Zustände mehr: die Prüfung rechnet nichts ab (Schritt 7). Die
  // Wiederholungen werden weiterhin gesendet — sie tragen Streak und Statistik
  // und holen falsch beantwortete Karten zurück.
  const inputRef = useRef<HTMLInputElement>(null);

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
    try {
      const v = window.localStorage.getItem(lastResultKey(deckId));
      const n = v ? parseInt(v, 10) : NaN;
      if (!Number.isNaN(n)) setLastResult(n);
    } catch {
      /* localStorage nicht verfügbar */
    }
  }, [deckId]);

  useEffect(() => {
    load();
  }, [load]);

  // Die gewählte Kartenquelle (Alle / Nur markierte / Nur Wackelkandidaten).
  const sourced = useMemo(
    () => filterBySource(cards, source, wobblyIds),
    [cards, source, wobblyIds]
  );

  const usableCount = useMemo(
    () => sourced.filter((c) => (c.front || "").trim() && (c.back || "").trim()).length,
    [sourced]
  );

  // Fragenanzahl standardmäßig auf das Maximum, sobald Karten geladen sind.
  useEffect(() => {
    if (usableCount > 0) setCount(usableCount);
  }, [usableCount]);

  const countPresets = useMemo(
    () =>
      [usableCount, 10, 20, 30].filter(
        (n, i, arr) => n > 0 && n <= usableCount && arr.indexOf(n) === i
      ),
    [usableCount]
  );

  const cycleCount = () => {
    if (countPresets.length <= 1) return;
    const i = countPresets.indexOf(count);
    setCount(countPresets[(i + 1) % countPresets.length]!);
  };

  const anyType = typeTF || typeMC || typeWritten;

  const scoredCount = graded.filter((g) => g.correct || g.overridden).length;
  const percent = questions.length > 0 ? Math.round((scoredCount / questions.length) * 100) : 0;

  // Baut den Test aus den übergebenen Karten und geht direkt ins Spiel — die
  // gemeinsame Basis für „Alle nochmal" und „Nur die nicht gewussten"
  // (Teilmenge, überspringt das Setup).
  const buildAndStart = useCallback(
    async (sourceCards: Card[]) => {
      const types: TestQuestionType[] = [];
      if (typeTF) types.push("trueFalse");
      if (typeMC) types.push("mc");
      if (typeWritten) types.push("written");
      let qs = buildTestQuestions(sourceCards, { count: count || usableCount, types, reverse });
      // Wahr/Falsch und Multiple Choice brauchen ≥ 2 Karten (für eine falsche
      // Gegen-Zuordnung). Bei zu wenigen offenen Karten (z. B. „Nur die nicht gewussten"
      // mit 1 Karte) lässt sich damit keine Frage bilden → dann fällt die Runde auf
      // „Schriftlich" zurück, das schon mit einer einzigen Karte funktioniert.
      let fellBack = false;
      if (qs.length === 0 && !typeWritten) {
        const withWritten = buildTestQuestions(sourceCards, {
          count: count || usableCount,
          types: [...types, "written"],
          reverse,
        });
        if (withWritten.length > 0) {
          qs = withWritten;
          fellBack = true;
        }
      }
      setFellBackToWritten(fellBack);
      setQuestions(qs);
      setAnswers(qs.map(() => ({ ...EMPTY_ANSWER })));
      setGraded([]);
      setIdx(0);
      // Eine neue Runde darf wieder melden — sonst bliebe „Nochmal" nach einem
      // vorzeitigen Beenden für immer stumm.
      sentRef.current = false;
      roundKeyRef.current = `test-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      attemptRecordedRef.current = false;
      setAborted(false);
      setLeavePrompt(false);
      // Zeitbudget aus den TATSÄCHLICH gebauten Fragen (nicht der angeforderten
      // Anzahl) — buildTestQuestions kann weniger liefern (z. B. Lücken-Karten bei
      // ausgeschaltetem „Schriftlich"). Nur im Zeit-Modus relevant.
      setRemaining(timed ? qs.length * SECONDS_PER_QUESTION : 0);
      setPhase("play");
    },
    [count, usableCount, typeTF, typeMC, typeWritten, reverse, timed]
  );

  const startTest = useCallback(() => buildAndStart(sourced), [buildAndStart, sourced]);

  /**
   * Schließt die Runde ab: bewerten, melden, Ergebnis zeigen.
   *
   * `scope: "all"` ist das normale Abgeben — jede Frage zählt, eine leer
   * gelassene als falsch. `scope: "answered"` ist das vorzeitige Beenden: Dann
   * bleiben nur die Fragen übrig, auf die es wirklich eine Antwort gibt, und
   * die Durchsicht zeigt genau diese. Unberührte Fragen verschwinden komplett,
   * statt als „nicht gewusst" in den Lernplan zu wandern.
   */
  const finish = useCallback(
    (scope: "all" | "answered") => {
      if (sentRef.current) return;
      const keep =
        scope === "all" ? questions.map((_, i) => i) : answeredIndices(answers);
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

      // Die Prüfung als EINHEIT festhalten — aber nur, wenn sie ganz abgegeben
      // wurde. Ein Abbruch (scope "answered") ist keine gültige Prüfungsnote:
      // „12 von 30" bei Frage 12 hieße 60 %, obwohl 18 Fragen nie beantwortet
      // wurden. Die beantworteten Karten zählen trotzdem einzeln (oben, über
      // flushReviews) — nur die Prüfungs-Zeile entsteht nicht.
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
    },
    [questions, answers, strict, userId, deckId]
  );

  const submit = useCallback(() => finish("all"), [finish]);

  const answeredCount = useMemo(() => answeredIndices(answers).length, [answers]);

  // submit über eine Ref ansprechen, damit der Countdown-Effekt nicht bei jeder
  // Antwort neu startet.
  const submitRef = useRef(submit);
  useEffect(() => {
    submitRef.current = submit;
  }, [submit]);

  // Countdown nur im Zeit-Modus mit vorhandenen Fragen — reiner Sekunden-Tick.
  useEffect(() => {
    if (phase !== "play" || !timed || questions.length === 0) return;
    const id = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(id);
  }, [phase, timed, questions.length]);

  // Zeit abgelaufen → automatisch abgeben (nur wenn es Fragen gibt, sonst würde
  // der „Keine Fragen"-Screen still auf ein 0-%-Ergebnis springen).
  useEffect(() => {
    if (phase === "play" && timed && questions.length > 0 && remaining === 0) {
      submitRef.current();
    }
  }, [phase, timed, remaining, questions.length]);

  /**
   * Notausgang: Was beim Verlassen des Bildschirms noch nicht gemeldet wurde,
   * geht jetzt raus.
   *
   * Deckt alles ab, was an der Nachfrage vorbeiführt — Zurück-Taste des
   * Browsers, ein Klick in der Seitenleiste, ein Link von außen. Die Nachfrage
   * ist der bewusste Weg, dieser hier der stille Rettungsanker.
   *
   * Der Effekt hat KEINE Abhängigkeiten und liest den Stand über eine Ref:
   * Liefe er bei jeder Antwort neu, würde seine Aufräum-Funktion mitten in der
   * Prüfung feuern und nach der ersten Frage melden.
   *
   * Was er nicht kann: das Schließen des Tabs. Dort läuft keine
   * Aufräum-Funktion mehr — dafür ist die Warnung unten da.
   */
  const liveRef = useRef({ phase, questions, answers, strict, userId });
  // Nachführen in einem Effekt ohne Abhängigkeiten, NICHT beim Zeichnen: React
  // darf einen begonnenen Durchlauf verwerfen. Schriebe man die Ref beim
  // Zeichnen, könnte darin ein Stand landen, den es nie auf den Bildschirm
  // geschafft hat — und der Notausgang meldete Antworten aus einer Runde, die
  // so nie stattgefunden hat.
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

  /**
   * Tab schließen oder neu laden: Der Browser fragt mit seinem eigenen Fenster
   * nach. Den Text dürfen Webseiten seit Jahren nicht mehr bestimmen — nur ob
   * gefragt wird.
   *
   * Bestätigt man das Verlassen, gehen die Antworten verloren. Wir könnten sie
   * hier nicht zuverlässig noch rausschicken (der Zugangs-Schlüssel muss dafür
   * erst geholt werden, und dazu kommt es beim Schließen oft nicht mehr). Ein
   * Versuch, der mal klappt und mal nicht, wäre schlimmer als eine klare Regel:
   * Dann wüsste niemand, ob die Prüfung gezählt hat.
   */
  useEffect(() => {
    if (phase !== "play") return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (sentRef.current || answeredIndices(answers).length === 0) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [phase, answers]);

  // Letztes Ergebnis merken (aktualisiert sich beim Nachbewerten). Eine
  // vorzeitig beendete Runde bleibt draußen: „Letztes Ergebnis: 40 %" nach
  // einem Abbruch bei Frage drei sagt nichts über das Können aus.
  useEffect(() => {
    if (phase !== "result" || !deckId || questions.length === 0 || aborted) return;
    try {
      window.localStorage.setItem(lastResultKey(deckId), String(percent));
    } catch {
      /* egal */
    }
    setLastResult(percent);
  }, [phase, percent, deckId, questions.length]);

  // Eingabefeld bei schriftlichen Fragen fokussieren.
  useEffect(() => {
    if (phase === "play" && questions[idx]?.type === "written") inputRef.current?.focus();
  }, [phase, idx, questions]);

  const setAnswer = (i: number, patch: Partial<Answer>) =>
    setAnswers((prev) => prev.map((a, j) => (j === i ? { ...a, ...patch } : a)));

  const overrideCorrect = (i: number) => {
    setGraded((prev) => prev.map((g, j) => (j === i ? { ...g, overridden: true } : g)));
    // „War doch richtig" korrigiert die STATISTIK (der Eintrag zählt als
    // gewusst), aber NICHT mehr die Planung: mit mode:"test" bewegt ein Treffer
    // den Plan nicht. Vorher war es anders gedacht — der Kommentar berief sich
    // auf den Lückentext, wo Selbstbewertung tatsächlich planen darf, weil dort
    // getippt wird.
    //
    // Folge: Eine in der Prüfung falsch beantwortete Karte bleibt früher
    // fällig, auch wenn man sich nachträglich Recht gibt. Das ist gewollt: Die
    // Prüfung hat gezeigt, dass die Antwort nicht saß — sie nochmal zu sehen
    // schadet nicht. Ohne mode:"test" wäre ausgerechnet diese eine
    // Nachbewertung als Karteikarte angekommen und hätte als einzige Regung der
    // ganzen Prüfung den Plan bewegt.
    const card = questions[i];
    if (userId && card) {
      void reviewCard(userId, card.cardId, "good", { mode: "test" }).catch(() => {});
    }

    // Die gespeicherte Prüfungsnote nachziehen: dieselbe Runde (roundKeyRef),
    // die eine Karte jetzt zusätzlich als richtig. Nur wenn diese Runde
    // überhaupt eine Prüfungs-Zeile hat — nach einem Abbruch gibt es keine, und
    // ein Override in dessen Durchsicht darf keine anlegen. Der Server nimmt per
    // greatest() die höhere Trefferzahl, das Nachziehen kann also nur steigen,
    // nie eine echte Abgabe überschreiben.
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

  if (usableCount === 0) {
    return (
      <div className="empty-state">
        <div className="ic" aria-hidden>
          <FileText size={30} />
        </div>
        <h3>Kein Test möglich</h3>
        <p>Dieses Deck hat keine Karten mit Frage und Antwort für einen Test.</p>
        <Link href={`/dashboard/deck/${deckId}`} className="btn btn-primary">
          Zurück zum Deck
        </Link>
      </div>
    );
  }

  // ---------- Setup ----------
  if (phase === "setup") {
    return (
      <div className="study-wrap">
        <Link href={`/dashboard/deck/${deckId}`} className="crumb">
          <ArrowLeft size={16} /> Zurück zum Deck
        </Link>

        <div className="cl-intro">
          <span
            className="cl-intro__ic"
            aria-hidden
            style={{ background: "rgba(239,68,68,0.14)", color: "#ef4444" }}
          >
            <FileText size={28} />
          </span>
          <h1 className="h2">Test einrichten</h1>
          {lastResult != null && (
            <p className="muted" style={{ fontSize: "0.9rem" }}>
              Letztes Ergebnis: {lastResult} %
            </p>
          )}
        </div>

        <CardSourcePicker
          value={source}
          onChange={setSource}
          allCount={cards.length}
          starredCount={cards.filter((c) => c.starred).length}
          wobblyCount={cards.filter((c) => wobblyIds.has(c.id)).length}
        />

        <button type="button" className="cl-optcard test-tap" onClick={cycleCount}>
          <span className="cl-row__t">Anzahl Fragen</span>
          <span className="test-count">
            {count >= usableCount ? `Alle (${usableCount})` : count}
          </span>
        </button>

        <div className="cl-optcard">
          <div className="cl-dir__lbl">Aufgabentypen</div>
          {(
            [
              ["Wahr / Falsch", typeTF, setTypeTF] as const,
              ["Multiple Choice", typeMC, setTypeMC] as const,
              ["Schriftlich (tippen)", typeWritten, setTypeWritten] as const,
            ]
          ).map(([label, val, setter]) => (
            <div className="quiz-typerow" key={label}>
              <span>{label}</span>
              <button
                type="button"
                className={`cl-switch${val ? " on" : ""}`}
                role="switch"
                aria-checked={val}
                aria-label={label}
                onClick={() => setter((v) => !v)}
              >
                <i />
              </button>
            </div>
          ))}
          {!anyType && (
            <div style={{ fontSize: "0.75rem", color: "#ef4444", marginTop: 6 }}>
              Mindestens ein Typ muss an sein.
            </div>
          )}
        </div>

        <button type="button" className="cl-dir" onClick={() => setReverse((r) => !r)}>
          <div className="cl-dir__lbl">Abgefragte Richtung</div>
          <div className="cl-dir__row">
            <b>{reverse ? "Rückseite" : "Vorderseite"}</b>
            <span className="cl-dir__arrow" aria-hidden>
              <ArrowLeft size={20} style={{ transform: "rotate(180deg)" }} />
            </span>
            <b>{reverse ? "Vorderseite" : "Rückseite"}</b>
          </div>
          <div className="cl-dir__hint">Richtung tauschen</div>
        </button>

        <div className="cl-optcard">
          <div className="cl-row">
            <div>
              <div className="cl-row__t">Genau prüfen</div>
              <div className="cl-row__s">nur beim Eintippen</div>
            </div>
            <button
              type="button"
              className={`cl-switch${strict ? " on" : ""}`}
              role="switch"
              aria-checked={strict}
              aria-label="Genau prüfen"
              onClick={() => setStrict((v) => !v)}
            >
              <i />
            </button>
          </div>
        </div>

        <div className="cl-optcard">
          <div className="cl-row">
            <div>
              <div className="cl-row__t">Auf Zeit</div>
              <div className="cl-row__s">
                {timed
                  ? `${formatTime((count || usableCount) * SECONDS_PER_QUESTION)} für die ganze Prüfung`
                  : "optional, ohne Zeitdruck"}
              </div>
            </div>
            <button
              type="button"
              className={`cl-switch${timed ? " on" : ""}`}
              role="switch"
              aria-checked={timed}
              aria-label="Auf Zeit"
              onClick={() => setTimed((v) => !v)}
            >
              <i />
            </button>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-primary btn-lg btn-block"
          disabled={!anyType}
          onClick={() => void startTest()}
        >
          Test starten
        </button>
      </div>
    );
  }

  // ---------- Ergebnis ----------
  if (phase === "result") {
    const pass = percent >= 50;
    // „Nicht gewusst" = als falsch gewertet UND nicht per Selbstbewertung
    // nachträglich als richtig gezählt. Auf die zugehörigen Karten abbilden,
    // damit ein Neustart genau diese wiederholt (eine Frage = eine Karte).
    const wrongCards = questions
      .map((qq, i) => ({ qq, g: graded[i] }))
      .filter(({ g }) => g != null && !g.correct && !g.overridden)
      .map(({ qq }) => cards.find((c) => c.id === qq.cardId))
      .filter((c): c is Card => Boolean(c));
    return (
      <div className="study-wrap">
        <div className="test-reshead">
          <div
            className="big"
            aria-hidden
            style={{ color: pass ? "var(--green)" : "#ef4444" }}
          >
            <Trophy size={48} />
          </div>
          <div style={{ fontSize: "2.4rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
            {percent} %
          </div>
          <p className="muted" style={{ margin: 0 }}>
            {scoredCount} von {questions.length} richtig
          </p>
          {/* Persönliches Lob nur bei voller Punktzahl — eine Prüfung bleibt
              sonst bewusst nüchtern. */}
          {percent === 100 && (
            <p style={{ margin: 0, color: "var(--green)", fontWeight: 700 }}>
              Volle Punktzahl — stark{displayName ? `, ${displayName}` : ""}!
            </p>
          )}
          <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
            Eine Prüfung misst — Lernpunkte gibt es beim Lernen.
          </p>
          {aborted && (
            // Ohne diesen Satz sähe eine vorzeitig beendete Prüfung aus wie eine
            // vollständige — mit einer Quote, die sich auf weniger Fragen
            // bezieht, als man sich vorgenommen hatte.
            <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
              Vorzeitig beendet — gewertet sind die {questions.length}{" "}
              {questions.length === 1 ? "Frage" : "Fragen"}, die du beantwortet
              hast.
            </p>
          )}
        </div>

        <div className="cl-dir__lbl">Durchsicht</div>
        {questions.map((q, i) => {
          const a = answers[i] ?? { mc: null, tf: null, text: "" };
          const g = graded[i] ?? { correct: false, overridden: false };
          const ok = g.correct || g.overridden;
          const yourAnswer =
            q.type === "mc"
              ? a.mc != null
                ? q.options[a.mc] ?? "—"
                : "—"
              : q.type === "trueFalse"
                ? a.tf === true
                  ? "Richtig"
                  : a.tf === false
                    ? "Falsch"
                    : "—"
                : a.text.trim() || "—";
          const solution = q.type === "trueFalse" ? (q.tfIsCorrect ? "Richtig" : "Falsch") : q.expected;
          return (
            <div className="test-rev" key={i}>
              <div className="test-rev__top">
                <span style={{ color: ok ? "var(--green)" : "#ef4444", flex: "none", display: "grid" }} aria-hidden>
                  {ok ? <CheckCircle size={18} /> : <X size={18} />}
                </span>
                <span className="test-rev__q">{q.prompt}</span>
              </div>
              {q.type === "trueFalse" && (
                <div className="test-rev__aussage">Aussage: {q.tfShownBack}</div>
              )}
              <div className={`test-rev__line ${ok ? "ok" : "no"}`}>Du: {yourAnswer}</div>
              {!ok && <div className="test-rev__line">Lösung: {solution}</div>}
              {q.type === "written" && !g.correct && !g.overridden && (
                <button type="button" className="cl-override" onClick={() => overrideCorrect(i)}>
                  <Check size={16} /> Trotzdem als richtig zählen
                </button>
              )}
            </div>
          );
        })}

        {wrongCards.length > 0 ? (
          <>
            <button
              type="button"
              className="btn btn-primary btn-block"
              onClick={() => void buildAndStart(wrongCards)}
            >
              Nur die nicht gewussten ({wrongCards.length})
            </button>
            <button type="button" className="btn btn-ghost btn-block" onClick={() => void startTest()}>
              <RotateCw size={18} /> Alle nochmal
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-primary btn-block" onClick={() => void startTest()}>
            <RotateCw size={18} /> Nochmal
          </button>
        )}
        <button
          type="button"
          className="btn btn-ghost btn-block"
          style={{ border: "none", boxShadow: "none" }}
          onClick={() => setPhase("setup")}
        >
          Einstellungen
        </button>
      </div>
    );
  }

  // ---------- Klausur ----------
  if (questions.length === 0) {
    return (
      <div className="empty-state">
        <div className="ic" aria-hidden>
          <FileText size={30} />
        </div>
        <h3>Keine Fragen</h3>
        <p>Für diese Auswahl lassen sich keine Fragen bilden. Ändere die Einstellungen.</p>
        <button type="button" className="btn btn-primary" onClick={() => setPhase("setup")}>
          Zu den Einstellungen
        </button>
      </div>
    );
  }

  const q = questions[idx]!;
  const a = answers[idx] ?? { mc: null, tf: null, text: "" };
  const isLast = idx + 1 >= questions.length;
  const progress = (idx + 1) / questions.length;
  const fallbackTypeNames =
    [typeTF ? "Wahr/Falsch" : null, typeMC ? "Multiple Choice" : null]
      .filter(Boolean)
      .join(" und ") || "die gewählten Fragetypen";

  return (
    <div className="study-wrap">
      <div className="test-ptop">
        <span>
          {idx + 1} / {questions.length}
        </span>
        {timed && (
          <span
            className="test-timer"
            style={{ color: remaining <= 30 ? "#ef4444" : "var(--ink-3)" }}
          >
            <Clock size={14} /> {formatTime(Math.max(remaining, 0))}
          </span>
        )}
        {/* Vor dieser Taste gab es aus der laufenden Prüfung gar keinen Weg
            hinaus außer der Zurück-Taste des Browsers. */}
        <button
          type="button"
          aria-label="Prüfung beenden"
          onClick={() => {
            if (answeredCount === 0) router.push(`/dashboard/deck/${deckId}`);
            else setLeavePrompt(true);
          }}
          style={{
            background: "none",
            border: "none",
            padding: 4,
            margin: -4,
            display: "grid",
            cursor: "pointer",
            color: "var(--ink-3)",
          }}
        >
          <X size={18} />
        </button>
      </div>
      <div className="progress">
        <i style={{ width: `${Math.max(progress * 100, 2)}%` }} />
      </div>

      {fellBackToWritten && (
        <p
          style={{
            textAlign: "center",
            fontSize: "0.85rem",
            color: "var(--ink-3)",
            margin: "0 0 12px",
          }}
        >
          Für {fallbackTypeNames} sind zu wenige Karten offen — wird als Eintippen wiederholt.
        </p>
      )}

      <div className="cl-prompt">
        <div className="quiz-eyebrow" style={{ color: "#ef4444" }}>
          {q.type === "written"
            ? "Antwort eintippen"
            : q.type === "mc"
              ? "Wähle die richtige Antwort"
              : "Stimmt diese Zuordnung?"}
        </div>
        <div className="cl-q">{q.prompt}</div>
        {q.type === "trueFalse" && <div className="test-tfbox">{q.tfShownBack}</div>}
      </div>

      {q.type === "written" && (
        <input
          ref={inputRef}
          className="cl-input"
          placeholder="Antwort eintippen…"
          value={a.text}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          onChange={(e) => setAnswer(idx, { text: e.target.value })}
        />
      )}

      {q.type === "mc" && (
        <div className="test-opts">
          {q.options.map((opt, oi) => (
            <button
              key={`${opt}-${oi}`}
              type="button"
              className={`test-opt${a.mc === oi ? " sel" : ""}`}
              onClick={() => setAnswer(idx, { mc: oi })}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {q.type === "trueFalse" && (
        <div className="test-tf2">
          {[true, false].map((val) => (
            <button
              key={String(val)}
              type="button"
              className={`test-opt${a.tf === val ? " sel" : ""}`}
              onClick={() => setAnswer(idx, { tf: val })}
            >
              {val ? "Richtig" : "Falsch"}
            </button>
          ))}
        </div>
      )}

      <div className="cl-actions">
        <button
          type="button"
          className="cl-back"
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={idx === 0}
          aria-label="Vorherige Frage"
        >
          <ArrowLeft size={22} />
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => (isLast ? submit() : setIdx((i) => i + 1))}
        >
          {isLast ? "Abgeben" : "Weiter"}
          {!isLast && <ChevronRight size={18} />}
        </button>
      </div>

      {leavePrompt && (
        <Modal title="Prüfung beenden?" onClose={() => setLeavePrompt(false)}>
          <p className="muted" style={{ margin: 0 }}>
            Du hast {answeredCount} von {questions.length}{" "}
            {questions.length === 1 ? "Frage" : "Fragen"} beantwortet. Deine
            bisherigen Antworten werden gespeichert und zählen für Streak,
            Statistik und Lernplan.
          </p>
          <div className="modal__actions">
            {/* „Weiter machen" ist bewusst der betonte (ausgefüllte) Knopf:
                Wer das Fenster aus Versehen öffnet, kommt am leichtesten zurück
                in die Prüfung. Beenden bleibt umrandet und rot markiert. */}
            <button
              type="button"
              className="btn btn-ghost"
              style={{ color: "#ef4444" }}
              onClick={() => {
                setLeavePrompt(false);
                finish("answered");
              }}
            >
              Beenden und speichern
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setLeavePrompt(false)}
            >
              Weiter machen
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

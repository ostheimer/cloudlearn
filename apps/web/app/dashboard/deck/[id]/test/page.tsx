"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/app/auth-context";
import { listCardsInDeck, reviewCard, earnLp, isApiError, type Card } from "@/lib/api";
import { isAnswerCorrect } from "@/lib/answerCheck";
import {
  buildTestQuestions,
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
  Zap,
  RotateCw,
  AlertTriangle,
  FileText,
} from "@/components/icons";

const SECONDS_PER_QUESTION = 30;
const LP_SESSION_MIN = 5;

type Answer = { mc: number | null; tf: boolean | null; text: string };
type Graded = { correct: boolean; overridden: boolean };

const lastResultKey = (deckId: string) => `clearn:test:last:${deckId}`;

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

  const [phase, setPhase] = useState<"setup" | "play" | "result">("setup");
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [graded, setGraded] = useState<Graded[]>([]);
  const [idx, setIdx] = useState(0);
  const [remaining, setRemaining] = useState(0);

  const [earned, setEarned] = useState<number | null>(null);
  const awardedRef = useRef(false);
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

  const usableCount = useMemo(
    () => cards.filter((c) => (c.front || "").trim() && (c.back || "").trim()).length,
    [cards]
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

  const awardSession = useCallback(async (n: number) => {
    if (awardedRef.current || n < LP_SESSION_MIN) return;
    awardedRef.current = true;
    try {
      const r = await earnLp("session", n);
      setEarned(r.granted);
    } catch {
      /* LP-Gutschrift best-effort */
    }
  }, []);

  // Baut den Test aus den übergebenen Karten und geht direkt ins Spiel — die
  // gemeinsame Basis für „Nochmal" (alle Karten) und „Nur nicht gewusste"
  // (Teilmenge, überspringt das Setup). Der LP-Zustand wird genauso
  // zurückgesetzt wie zuvor: die abgeschlossene Sitzung wurde bereits in submit
  // gutgeschrieben, hier startet nur die neue Sitzung frisch.
  const buildAndStart = useCallback(
    (sourceCards: Card[]) => {
      const types: TestQuestionType[] = [];
      if (typeTF) types.push("trueFalse");
      if (typeMC) types.push("mc");
      if (typeWritten) types.push("written");
      const qs = buildTestQuestions(sourceCards, { count: count || usableCount, types, reverse });
      setQuestions(qs);
      setAnswers(qs.map(() => ({ mc: null, tf: null, text: "" })));
      setGraded([]);
      setIdx(0);
      // Zeitbudget aus den TATSÄCHLICH gebauten Fragen (nicht der angeforderten
      // Anzahl) — buildTestQuestions kann weniger liefern (z. B. Lücken-Karten bei
      // ausgeschaltetem „Schriftlich"). Nur im Zeit-Modus relevant.
      setRemaining(timed ? qs.length * SECONDS_PER_QUESTION : 0);
      awardedRef.current = false;
      setEarned(null);
      setPhase("play");
    },
    [count, usableCount, typeTF, typeMC, typeWritten, reverse, timed]
  );

  const startTest = useCallback(() => buildAndStart(cards), [buildAndStart, cards]);

  const submit = useCallback(() => {
    const result: Graded[] = questions.map((q, i) => {
      const a = answers[i] ?? { mc: null, tf: null, text: "" };
      let correct = false;
      if (q.type === "mc") correct = a.mc === q.correctIndex;
      else if (q.type === "trueFalse") correct = a.tf === q.tfIsCorrect;
      else correct = isAnswerCorrect(a.text, q.expected, { strict });
      if (userId) reviewCard(userId, q.cardId, correct ? "good" : "again").catch(() => {});
      return { correct, overridden: false };
    });
    setGraded(result);
    void awardSession(questions.length);
    setPhase("result");
  }, [questions, answers, strict, userId, awardSession]);

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

  // Letztes Ergebnis merken (aktualisiert sich beim Nachbewerten).
  useEffect(() => {
    if (phase !== "result" || !deckId || questions.length === 0) return;
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
    // Selbstbewertung soll auch die SRS-Planung korrigieren (wie im Lückentext):
    // die zuvor als „again" gebuchte Karte jetzt als „good" nachbewerten.
    const card = questions[i];
    if (userId && card) reviewCard(userId, card.cardId, "good").catch(() => {});
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
          <div className="cl-dir__hint">Tippen zum Tauschen</div>
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
          onClick={startTest}
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
          {earned !== null && earned > 0 && (
            <span className="lp-pill">
              <Zap size={15} /> +{earned} Lernpunkte
            </span>
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
              onClick={() => buildAndStart(wrongCards)}
            >
              Nur nicht gewusste ({wrongCards.length})
            </button>
            <button type="button" className="btn btn-ghost btn-block" onClick={startTest}>
              <RotateCw size={18} /> Nochmal alle
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-primary btn-block" onClick={startTest}>
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
      </div>
      <div className="progress">
        <i style={{ width: `${Math.max(progress * 100, 2)}%` }} />
      </div>

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
    </div>
  );
}

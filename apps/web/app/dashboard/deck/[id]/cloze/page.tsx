"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/app/auth-context";
import { listCardsInDeck, reviewCard, earnLp, isApiError, type Card } from "@/lib/api";
import { isAnswerCorrect } from "@/lib/answerCheck";
import { useDisplayName } from "@/lib/use-display-name";
import { useWobblyIds } from "@/lib/use-wobbly-ids";
import { filterBySource, type CardSource } from "@/lib/card-source";
import { CardSourcePicker } from "@/components/app/card-source-picker";
import {
  beginSessionAward,
  getSessionReviewedCount,
  isSessionEarnFinalized,
  type SessionAwardState,
} from "@/lib/learn-session-lp";
import {
  ArrowLeft,
  X,
  Check,
  CheckCircle,
  Trophy,
  Pencil,
  Zap,
  AlertTriangle,
} from "@/components/icons";

type Parsed = { prompt: string; answer: string; isCloze: boolean };
type Result = { input: string; correct: boolean; overridden: boolean };

// Baut die „Lücke zum Füllen" aus einer Karte:
//   - Cloze-Karten ({{cN::x}}): Satz mit Lücke zeigen, Antwort ist x
//     (die Lücke steckt fest im Text, Richtung ändert nichts)
//   - normale Karten: eine Seite zeigen, die andere tippen; `reverse` tauscht.
function buildPrompt(card: Card, reverse: boolean): Parsed {
  const rf = (card.front || "").trim();
  const rb = (card.back || "").trim();
  const m = rf.match(/\{\{c\d+::(.+?)\}\}/);
  if (m) {
    return {
      prompt: rf.replace(/\{\{c\d+::.+?\}\}/g, "______"),
      answer: (m[1] ?? "").trim(),
      isCloze: true,
    };
  }
  return reverse
    ? { prompt: rb, answer: rf, isCloze: false }
    : { prompt: rf, answer: rb, isCloze: false };
}

// Nutzbar, wenn man in der gewählten Richtung etwas eintippen kann.
function hasTypeable(card: Card): boolean {
  const rf = (card.front || "").trim();
  const rb = (card.back || "").trim();
  const m = rf.match(/\{\{c\d+::(.+?)\}\}/);
  if (m) return (m[1] ?? "").trim().length > 0;
  return rf.length > 0 && rb.length > 0;
}

export default function ClozePage() {
  const params = useParams<{ id: string }>();
  const deckId = params.id;
  const router = useRouter();
  const { userId } = useAuth();
  const displayName = useDisplayName();

  const [allCards, setAllCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Im Setup-Menü gewählte Einstellungen
  const [strict, setStrict] = useState(true);
  const [reverse, setReverse] = useState(false);
  const [source, setSource] = useState<CardSource>("all");
  const wobblyIds = useWobblyIds(deckId);

  const [phase, setPhase] = useState<"setup" | "play" | "summary">("setup");
  const [round, setRound] = useState<Card[]>([]);
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState("");
  // Ein Ergebnis-Slot je Karte (null = noch nicht beantwortet), damit der
  // Zurück-Knopf eine frühere Karte in ihrem beantworteten Zustand zeigt.
  const [results, setResults] = useState<(Result | null)[]>([]);

  const [earned, setEarned] = useState<number | null>(null);
  const [earnCapReached, setEarnCapReached] = useState(false);
  const awardStateRef = useRef<SessionAwardState>({ finalized: false, inFlight: null });
  const pendingReviewsRef = useRef<Promise<unknown>[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!deckId) return;
    try {
      const { cards } = await listCardsInDeck(deckId);
      // Bild-Occlusion-Karten gehören nur in den Occlusion-Modus (kein Bild hier).
      setAllCards(cards.filter((c) => c.type !== "occlusion" && hasTypeable(c)));
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

  const current = round[idx];
  const parsed = current ? buildPrompt(current, reverse) : null;
  const result = results[idx] ?? null;
  const revealed = result !== null;
  const wasCorrect = result ? result.correct || result.overridden : false;

  // Eingabefeld bei neuer, unbeantworteter Karte fokussieren.
  useEffect(() => {
    if (phase === "play" && !revealed) inputRef.current?.focus();
  }, [phase, idx, revealed]);

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

          const res = await earnLp("session", count);
          setEarned(res.granted);
          setEarnCapReached(res.capReached);

          if (isSessionEarnFinalized(res, count)) {
            state.finalized = true;
            break;
          }
        }
      } catch {
        /* LP-Gutschrift ist best-effort */
      }
    });
  }, []);

  const startRound = useCallback(async (cards: Card[]) => {
    await awardSession(round.length);
    awardStateRef.current = { finalized: false, inFlight: null };
    pendingReviewsRef.current = [];
    setEarned(null);
    setEarnCapReached(false);
    setRound(cards);
    setResults(new Array(cards.length).fill(null));
    setIdx(0);
    setInput("");
    setPhase("play");
  }, [awardSession, round.length]);

  const setResultAt = (i: number, v: Result | null) =>
    setResults((prev) => prev.map((r, j) => (j === i ? v : r)));

  function review(cardId: string, rating: "good" | "again") {
    if (!userId) return;
    const reviewPromise = reviewCard(userId, cardId, rating, { mode: "cloze" }).catch(() => {});
    pendingReviewsRef.current.push(reviewPromise);
  }

  function check() {
    if (revealed || !current || !parsed) return;
    const correct = isAnswerCorrect(input, parsed.answer, { strict });
    setResultAt(idx, { input, correct, overridden: false });
    review(current.id, correct ? "good" : "again");
  }

  // „Weiß ich nicht": Lösung zeigen, als falsch werten (kommt in die Wiederholung).
  function dontKnow() {
    if (revealed || !current) return;
    setResultAt(idx, { input, correct: false, overridden: false });
    review(current.id, "again");
  }

  // Selbstbewertung: eine als falsch markierte Antwort doch zählen lassen.
  function override() {
    if (!result || wasCorrect || !current) return;
    setResultAt(idx, { ...result, overridden: true });
    review(current.id, "good");
  }

  function next() {
    if (idx + 1 >= round.length) {
      const reviewedCount = getSessionReviewedCount(
        round.length,
        pendingReviewsRef.current.length,
      );
      void awardSession(reviewedCount);
      setPhase("summary");
      return;
    }
    setIdx((i) => i + 1);
    setInput("");
  }

  function back() {
    if (idx === 0) return;
    setIdx((i) => i - 1);
    setInput("");
  }

  async function quit() {
    const answered = results.filter(Boolean).length;
    const reviewedCount = getSessionReviewedCount(
      answered,
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

  if (allCards.length === 0) {
    return (
      <div className="empty-state">
        <div className="ic" aria-hidden>
          <Pencil size={30} />
        </div>
        <h3>Nichts zum Eintippen</h3>
        <p>Dieses Deck hat keine Karten, bei denen man etwas eintippen kann.</p>
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
    return (
      <div className="study-wrap">
        <Link href={`/dashboard/deck/${deckId}`} className="crumb">
          <ArrowLeft size={16} /> Zurück zum Deck
        </Link>

        <div className="cl-intro">
          <span className="cl-intro__ic" aria-hidden>
            <Pencil size={30} />
          </span>
          <h1 className="h2">Lückentext</h1>
          <p className="muted">Antwort eintippen</p>
        </div>

        <div className="cl-optcard">
          <div className="cl-row">
            <div>
              <div className="cl-row__t">Genau prüfen</div>
              <div className="cl-row__s">
                {strict
                  ? "Groß/klein und Akzente zählen"
                  : "Verzeiht Groß/klein, Akzente, kleine Tippfehler"}
              </div>
            </div>
            <button
              type="button"
              className={`cl-switch${strict ? " on" : ""}`}
              role="switch"
              aria-checked={strict}
              aria-label="Genau prüfen"
              onClick={() => setStrict((s) => !s)}
            >
              <i />
            </button>
          </div>
        </div>

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

        <CardSourcePicker
          value={source}
          onChange={setSource}
          allCount={allCards.length}
          starredCount={allCards.filter((c) => c.starred).length}
          wobblyCount={allCards.filter((c) => wobblyIds.has(c.id)).length}
        />

        <button
          type="button"
          className="btn btn-primary btn-lg btn-block"
          onClick={() => startRound(filterBySource(allCards, source, wobblyIds))}
        >
          Starten
        </button>
      </div>
    );
  }

  // ---------- Auswertung ----------
  if (phase === "summary") {
    const total = round.length;
    const correct = results.filter((r) => r && (r.correct || r.overridden)).length;
    const wrong = round.filter((_, i) => {
      const r = results[i];
      return r != null && !(r.correct || r.overridden);
    });
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    const allRight = wrong.length === 0;
    return (
      <div className="study-wrap">
        <div className="study-done">
          <div
            className="big"
            aria-hidden
            style={{ color: allRight ? "var(--amber)" : "var(--brand)" }}
          >
            {allRight ? <Trophy size={54} /> : <CheckCircle size={54} />}
          </div>
          <div style={{ fontSize: "2.6rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
            {pct}%
          </div>
          <p className="lead" style={{ margin: 0 }}>
            {correct} von {total} richtig
          </p>
          {allRight ? (
            <p style={{ margin: 0, color: "var(--green)", fontWeight: 700 }}>
              Alles richtig — stark{displayName ? `, ${displayName}` : ""}!
            </p>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              {wrong.length} {wrong.length === 1 ? "Karte" : "Karten"} noch offen.
            </p>
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
          <div style={{ display: "grid", gap: 8, width: "100%", maxWidth: 320 }}>
            {!allRight && (
              <button
                type="button"
                className="btn btn-primary btn-block"
                onClick={() => startRound(wrong)}
              >
                Nur die nicht gewussten ({wrong.length})
              </button>
            )}
            <button
              type="button"
              className={`btn btn-block ${allRight ? "btn-primary" : "btn-ghost"}`}
              onClick={() => startRound(filterBySource(allCards, source, wobblyIds))}
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
  const progress = round.length > 0 ? (idx + (revealed ? 1 : 0)) / round.length : 0;
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
          <i style={{ width: `${Math.max(progress * 100, 2)}%` }} />
        </div>
        <span className="muted" style={{ fontWeight: 700, fontSize: "0.9rem" }}>
          {idx + 1} / {round.length}
        </span>
      </div>

      <div className="cl-prompt">
        <div className="cl-eyebrow">
          {parsed?.isCloze ? "Ergänze die Lücke" : "Wie lautet die Antwort?"}
        </div>
        <div className="cl-q">{parsed?.prompt}</div>
      </div>

      <input
        ref={inputRef}
        className={`cl-input${revealed ? (wasCorrect ? " ok" : " no") : ""}`}
        placeholder="Antwort eintippen…"
        value={revealed ? result?.input ?? "" : input}
        disabled={revealed}
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && input.trim().length > 0) {
            e.preventDefault();
            check();
          }
        }}
      />

      {revealed && (
        <div className={`cl-fb ${wasCorrect ? "ok" : "no"}`}>
          <span className="cl-fb__ic" aria-hidden>
            {wasCorrect ? <CheckCircle size={22} /> : <X size={22} />}
          </span>
          <div>
            <b>{wasCorrect ? "Richtig" : "Falsch"}</b>
            <div className="cl-fb__sol">Lösung: {parsed?.answer}</div>
          </div>
        </div>
      )}

      {revealed && !wasCorrect && (
        <button type="button" className="cl-override" onClick={override}>
          <Check size={18} /> Trotzdem als richtig zählen
        </button>
      )}

      <div className="cl-actions">
        <button
          type="button"
          className="cl-back"
          onClick={back}
          disabled={idx === 0}
          aria-label="Vorherige Karte"
        >
          <ArrowLeft size={22} />
        </button>
        {revealed ? (
          <button type="button" className="btn btn-primary" onClick={next}>
            {idx + 1 >= round.length ? "Auswertung" : "Weiter"}
          </button>
        ) : (
          <>
            <button
              type="button"
              className="btn btn-primary"
              onClick={check}
              disabled={input.trim().length === 0}
            >
              Prüfen
            </button>
            <button type="button" className="btn btn-ghost" onClick={dontKnow}>
              Weiß ich nicht
            </button>
          </>
        )}
      </div>
    </div>
  );
}

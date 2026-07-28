"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/app/auth-context";
import { reviewCard, earnLp, type Card, type ReviewRating } from "@/lib/api";
import { useDisplayName } from "@/lib/use-display-name";
import { speechTexts } from "@/lib/speech-text";
import { useSpeech } from "@/lib/use-speech";
import { X, Trophy, Zap, Play, Pause, Timer, Volume2 } from "@/components/icons";
import {
  beginSessionAward,
  getSessionReviewedCount,
  isSessionEarnFinalized,
  type SessionAwardState,
} from "@/lib/learn-session-lp";
import { clearSessionProgress, saveSessionProgress } from "@/lib/session-progress";

const RATINGS: { key: ReviewRating; label: string; cls: string }[] = [
  { key: "again", label: "Nochmal", cls: "rating--again" },
  { key: "hard", label: "Schwer", cls: "rating--hard" },
  { key: "good", label: "Gut", cls: "rating--good" },
  { key: "easy", label: "Leicht", cls: "rating--easy" },
];

// Wartezeit des Auto-Abspielens zwischen zwei Schritten — dieselbe Auswahl
// wie in der App, per Tipp auf die Anzeige durchgeschaltet.
const AUTO_PLAY_SPEEDS = [1, 3, 5, 10];

/**
 * The flip-and-rate session, shared by the deck and the folder learn pages.
 * The caller decides WHICH cards are studied and where "back" leads; everything
 * from here on — rating, LP, restart, „nur nicht gewusste" — is the same either
 * way. `pool` is the full round: it must already be filtered (no occlusion
 * cards) and stay referentially stable, since „Alle nochmal" restores it.
 *
 * Weitermachen (sessionProgress wie in der App): Sind `progressDeckId` und
 * `progressSource` gesetzt, merkt sich die Runde bei jedem Kartenwechsel ihre
 * Position im Browser und löscht den Merker am Rundenende. Nur das
 * Deck-Lernen setzt sie — beim Ordner-Lernen wechselt der Fällig-Stapel
 * täglich von selbst, ein gemerkter Stand wäre fast nie mehr gültig, und die
 * Wackelkandidaten-Sonderrunden (?cards=) startet man einfach neu.
 * `startAt` steigt mitten in der Runde ein, nachdem das Setup den Stand als
 * noch gültig geprüft und „Weitermachen" angeboten hat.
 */
export function LearnSession({
  pool,
  backHref,
  backLabel,
  startAt,
  progressDeckId,
  progressSource,
}: {
  pool: Card[];
  backHref: string;
  backLabel: string;
  startAt?: number | undefined;
  progressDeckId?: string | undefined;
  progressSource?: string | undefined;
}) {
  const router = useRouter();
  const { userId } = useAuth();

  // `cards` is the queue actually being studied — possibly a subset of `pool`
  // after „Nur die nicht gewussten".
  const [cards, setCards] = useState<Card[]>(pool);
  const [index, setIndex] = useState(() =>
    Math.min(Math.max(startAt ?? 0, 0), Math.max(pool.length - 1, 0))
  );
  // Wo DIESE Runde begonnen hat: 0 normalerweise, beim Weitermachen die
  // Einstiegskarte. Die übersprungenen Karten wurden letztes Mal bewertet und
  // abgerechnet — Auswertung und LP zählen nur, was ab hier gelernt wurde.
  const [startIndex, setStartIndex] = useState(() =>
    Math.min(Math.max(startAt ?? 0, 0), Math.max(pool.length - 1, 0))
  );
  const [flipped, setFlipped] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [notKnown, setNotKnown] = useState<Card[]>([]);
  const [earned, setEarned] = useState<number | null>(null);
  const [earnCapReached, setEarnCapReached] = useState(false);
  // Anzeigename fürs persönliche Lob am Ende — ohne ihn bleibt es beim
  // schlichten "Runde geschafft!".
  const displayName = useDisplayName();
  const awardStateRef = useRef<SessionAwardState>({ finalized: false, inFlight: null });
  const pendingReviewsRef = useRef<Promise<unknown>[]>([]);

  const total = cards.length;
  const current = cards[index];
  const done = total > 0 && index >= total;

  // ─── Vorlesen + Auto-Abspielen (wie der App-Lernmodus) ───────────────────
  const { supported, speaking, speak, stop } = useSpeech();
  const [autoPlaying, setAutoPlaying] = useState(false);
  const [autoPlaySpeed, setAutoPlaySpeed] = useState(3);
  const spoken = current ? speechTexts(current.front, current.back) : null;

  // LP fürs Lernen gutschreiben — wie die App. Der Server zählt review_logs;
  // wir warten auf laufende Review-Requests, bevor earnLp aufgerufen wird.
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

  useEffect(() => {
    if (done) void awardSession(total - startIndex);
  }, [done, total, startIndex, awardSession]);

  // ─── Merken, wo eine unterbrochene Runde stand (Weitermachen) ────────────
  // Bei jedem Kartenwechsel geschrieben statt beim Verlassen: Ein Tab lässt
  // sich schließen, ohne dass irgendein Aufräum-Code läuft. Das Rundenende
  // löscht den Eintrag — eine fertige Runde hat nichts fortzusetzen.
  useEffect(() => {
    if (!progressDeckId || !progressSource || total === 0) return;
    if (done) {
      clearSessionProgress(progressDeckId, "flashcards");
      return;
    }
    const card = cards[index];
    if (!card) return;
    saveSessionProgress(progressDeckId, "flashcards", {
      index,
      cardId: card.id,
      source: progressSource,
      // Das Web fragt Karteikarten (noch) immer von vorn ab; das Feld hält
      // nur das Format deckungsgleich zur App.
      reverse: false,
      total,
    });
  }, [progressDeckId, progressSource, cards, index, done, total]);

  // useCallback statt schlichter Funktion, weil der Auto-Abspielen-Timer sie
  // aus einem Effekt heraus aufruft.
  const rate = useCallback(
    (rating: ReviewRating) => {
      const card = cards[index];
      if (!card || !userId) return;
      if (rating === "good" || rating === "easy") setCorrect((n) => n + 1);
      else setNotKnown((prev) => [...prev, card]);
      // Ausdrücklich, obwohl "flashcard" ohnehin der Server-Default ist: Jeder
      // Modus soll sagen, wer er ist. Sonst hängt die Richtigkeit dieser Zeile
      // daran, dass der Default nie geändert wird — und dieser Ablauf trägt
      // sowohl die Deck- als auch die Ordner-Lernseite.
      const reviewPromise = reviewCard(userId, card.id, rating, { mode: "flashcard" }).catch(
        () => {
          /* review sync best-effort; scheduling will catch up on next load */
        }
      );
      pendingReviewsRef.current.push(reviewPromise);
      setFlipped(false);
      window.setTimeout(() => setIndex((i) => i + 1), 160);
    },
    [cards, index, userId]
  );

  // Beim Kartenwechsel verstummen — wie die App. Läuft Auto-Abspielen, spricht
  // der Effekt darunter gleich danach die neue Karte.
  useEffect(() => {
    stop();
  }, [index, stop]);

  // Runde fertig → Auto-Abspielen beenden.
  useEffect(() => {
    if (done && autoPlaying) {
      setAutoPlaying(false);
      stop();
    }
  }, [done, autoPlaying, stop]);

  // Der Takt des Auto-Abspielens: nach der Wartezeit erst umdrehen, dann mit
  // „Gut" bewerten und weiterblättern — exakt der App-Ablauf.
  useEffect(() => {
    if (!autoPlaying || done || total === 0) return;
    const timer = window.setTimeout(() => {
      if (!flipped) setFlipped(true);
      else rate("good");
    }, autoPlaySpeed * 1000);
    return () => window.clearTimeout(timer);
  }, [autoPlaying, flipped, index, autoPlaySpeed, done, total, rate]);

  // Beim Auto-Abspielen jede neu sichtbare Seite vorlesen.
  useEffect(() => {
    if (!autoPlaying) return;
    const card = cards[index];
    if (!card) return;
    const texts = speechTexts(card.front, card.back);
    speak(flipped ? texts.back : texts.front);
    return () => stop();
  }, [autoPlaying, flipped, index, cards, speak, stop]);

  function toggleSpeak() {
    if (!spoken) return;
    if (speaking) {
      stop();
      return;
    }
    speak(flipped ? spoken.back : spoken.front);
  }

  function toggleAutoPlay() {
    if (autoPlaying) {
      setAutoPlaying(false);
      stop();
    } else {
      setAutoPlaying(true);
    }
  }

  function cycleSpeed() {
    setAutoPlaySpeed((s) => {
      const idx = AUTO_PLAY_SPEEDS.indexOf(s);
      return AUTO_PLAY_SPEEDS[(idx + 1) % AUTO_PLAY_SPEEDS.length] ?? 3;
    });
  }

  async function startRound(next: Card[]) {
    await awardSession(total - startIndex);
    awardStateRef.current.finalized = false;
    pendingReviewsRef.current = [];
    setEarned(null);
    setEarnCapReached(false);
    setCards(next);
    setNotKnown([]);
    setIndex(0);
    // Folge-Runden („Nur die nicht gewussten" / „Alle nochmal") beginnen
    // wieder ganz vorn — der Weitermachen-Einstieg galt nur der ersten.
    setStartIndex(0);
    setFlipped(false);
    setCorrect(0);
  }

  async function quit() {
    // Sofort verstummen — die LP-Sicherung darunter darf einen Moment dauern,
    // die Stimme soll aber nicht so lange weiterreden.
    setAutoPlaying(false);
    stop();
    // Beim frühen Beenden noch die LP der bisher gelernten Karten sichern —
    // beim Weitermachen zählen nur die ab dem Einstieg gelernten.
    const reviewedCount = getSessionReviewedCount(
      index - startIndex,
      pendingReviewsRef.current.length
    );
    await awardSession(reviewedCount);
    router.push(backHref);
  }

  if (done) {
    // Beim Weitermachen zählt die Auswertung nur die in DIESER Runde
    // gelernten Karten — die übersprungenen wurden letztes Mal bewertet.
    const studied = total - startIndex;
    return (
      <div className="study-wrap">
        <div className="study-done">
          <div className="big" aria-hidden style={{ color: "var(--amber)" }}>
            <Trophy size={56} />
          </div>
          <h2 className="h2">Runde geschafft{displayName ? `, ${displayName}` : ""}!</h2>
          <p className="lead">
            Du hast {studied} {studied === 1 ? "Karte" : "Karten"} wiederholt — {correct} davon
            sicher gewusst.
          </p>
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
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
            {notKnown.length > 0 && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => startRound(notKnown)}
              >
                Nur die nicht gewussten ({notKnown.length})
              </button>
            )}
            <button
              type="button"
              className={notKnown.length > 0 ? "btn btn-ghost" : "btn btn-primary"}
              onClick={() => startRound(pool)}
            >
              Alle nochmal
            </button>
            <button type="button" className="btn btn-ghost" onClick={quit}>
              {backLabel}
            </button>
          </div>
        </div>
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
          <i style={{ width: `${(index / total) * 100}%` }} />
        </div>
        <span className="muted" style={{ fontWeight: 700, fontSize: "0.9rem" }}>
          {index + 1} / {total}
        </span>
      </div>

      {supported && (
        <div className="autoplay-row">
          <button
            type="button"
            className={`autoplay-pill${autoPlaying ? " is-on" : ""}`}
            onClick={toggleAutoPlay}
            aria-pressed={autoPlaying}
            aria-label={
              autoPlaying ? "Automatisches Abspielen anhalten" : "Automatisch abspielen"
            }
          >
            {autoPlaying ? <Pause size={13} /> : <Play size={13} />}
            Auto
          </button>
          {autoPlaying && (
            <button
              type="button"
              className="autoplay-pill"
              onClick={cycleSpeed}
              aria-label={`Wartezeit ${autoPlaySpeed} Sekunden — tippen zum Wechseln`}
            >
              <Timer size={13} />
              {autoPlaySpeed}s
            </button>
          )}
        </div>
      )}

      <div
        className={`flip study-card${flipped ? " is-flipped" : ""}`}
        role="button"
        tabIndex={0}
        aria-label="Karte umdrehen"
        onClick={() => setFlipped((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setFlipped((v) => !v);
          }
        }}
      >
        <div className="flip__inner">
          <div className="flip__face flip__face--front">
            <span className="flip__label">Frage</span>
            <span className="flip__q">{current?.front}</span>
            <span className="flip__hint">Zum Umdrehen klicken</span>
          </div>
          <div className="flip__face flip__face--back">
            <span className="flip__label">Antwort</span>
            <span className="flip__q">{current?.back}</span>
            <span className="flip__hint">Wie gut wusstest du es?</span>
          </div>
        </div>
        {supported && (
          <button
            type="button"
            className={`speak-btn${speaking ? " is-speaking" : ""}`}
            aria-label={speaking ? "Vorlesen stoppen" : "Vorlesen"}
            onClick={(e) => {
              e.stopPropagation();
              toggleSpeak();
            }}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <Volume2 size={18} />
          </button>
        )}
      </div>

      {flipped ? (
        <div className="rating-row">
          {RATINGS.map((r) => (
            <button
              key={r.key}
              type="button"
              className={`rating ${r.cls}`}
              onClick={() => rate(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="center">
          <button type="button" className="btn btn-primary" onClick={() => setFlipped(true)}>
            Antwort zeigen
          </button>
        </div>
      )}
    </div>
  );
}

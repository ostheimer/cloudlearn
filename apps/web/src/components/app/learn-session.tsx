"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/app/auth-context";
import { reviewCard, earnLp, type Card, type ReviewRating } from "@/lib/api";
import { useDisplayName } from "@/lib/use-display-name";
import { X, Trophy, Zap } from "@/components/icons";
import {
  beginSessionAward,
  getSessionReviewedCount,
  isSessionEarnFinalized,
  type SessionAwardState,
} from "@/lib/learn-session-lp";

const RATINGS: { key: ReviewRating; label: string; cls: string }[] = [
  { key: "again", label: "Nochmal", cls: "rating--again" },
  { key: "hard", label: "Schwer", cls: "rating--hard" },
  { key: "good", label: "Gut", cls: "rating--good" },
  { key: "easy", label: "Leicht", cls: "rating--easy" },
];

/**
 * The flip-and-rate session, shared by the deck and the folder learn pages.
 * The caller decides WHICH cards are studied and where "back" leads; everything
 * from here on — rating, LP, restart, „nur nicht gewusste" — is the same either
 * way. `pool` is the full round: it must already be filtered (no occlusion
 * cards) and stay referentially stable, since „Nochmal alle" restores it.
 */
export function LearnSession({
  pool,
  backHref,
  backLabel,
}: {
  pool: Card[];
  backHref: string;
  backLabel: string;
}) {
  const router = useRouter();
  const { userId } = useAuth();

  // `cards` is the queue actually being studied — possibly a subset of `pool`
  // after „Nur nicht gewusste".
  const [cards, setCards] = useState<Card[]>(pool);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [notKnown, setNotKnown] = useState<Card[]>([]);
  const [earned, setEarned] = useState<number | null>(null);
  const [earnCapReached, setEarnCapReached] = useState(false);
  // Anzeigename fürs persönliche Lob am Ende — ohne ihn bleibt es beim
  // schlichten "Session geschafft!".
  const displayName = useDisplayName();
  const awardStateRef = useRef<SessionAwardState>({ finalized: false, inFlight: null });
  const pendingReviewsRef = useRef<Promise<unknown>[]>([]);

  const total = cards.length;
  const current = cards[index];
  const done = total > 0 && index >= total;

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
    if (done) void awardSession(total);
  }, [done, total, awardSession]);

  function rate(rating: ReviewRating) {
    const card = cards[index];
    if (!card || !userId) return;
    if (rating === "good" || rating === "easy") setCorrect((n) => n + 1);
    else setNotKnown((prev) => [...prev, card]);
    // Ausdrücklich, obwohl "flashcard" ohnehin der Server-Default ist: Jeder
    // Modus soll sagen, wer er ist. Sonst hängt die Richtigkeit dieser Zeile
    // daran, dass der Default nie geändert wird — und dieser Ablauf trägt
    // sowohl die Deck- als auch die Ordner-Lernseite.
    const reviewPromise = reviewCard(userId, card.id, rating, { mode: "flashcard" }).catch(() => {
      /* review sync best-effort; scheduling will catch up on next load */
    });
    pendingReviewsRef.current.push(reviewPromise);
    setFlipped(false);
    window.setTimeout(() => setIndex((i) => i + 1), 160);
  }

  async function startRound(next: Card[]) {
    await awardSession(total);
    awardStateRef.current.finalized = false;
    pendingReviewsRef.current = [];
    setEarned(null);
    setEarnCapReached(false);
    setCards(next);
    setNotKnown([]);
    setIndex(0);
    setFlipped(false);
    setCorrect(0);
  }

  async function quit() {
    // Beim frühen Beenden noch die LP der bisher gelernten Karten sichern.
    const reviewedCount = getSessionReviewedCount(index, pendingReviewsRef.current.length);
    await awardSession(reviewedCount);
    router.push(backHref);
  }

  if (done) {
    return (
      <div className="study-wrap">
        <div className="study-done">
          <div className="big" aria-hidden style={{ color: "var(--amber)" }}>
            <Trophy size={56} />
          </div>
          <h2 className="h2">Session geschafft{displayName ? `, ${displayName}` : ""}!</h2>
          <p className="lead">
            Du hast {total} {total === 1 ? "Karte" : "Karten"} wiederholt — {correct} davon sicher
            gewusst.
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
                Nur nicht gewusste ({notKnown.length})
              </button>
            )}
            <button
              type="button"
              className={notKnown.length > 0 ? "btn btn-ghost" : "btn btn-primary"}
              onClick={() => startRound(pool)}
            >
              {notKnown.length > 0 ? "Nochmal alle" : "Nochmal lernen"}
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

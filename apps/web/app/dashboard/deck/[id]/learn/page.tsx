"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/app/auth-context";
import {
  listCardsInDeck,
  reviewCard,
  earnLp,
  isApiError,
  type Card,
  type ReviewRating,
} from "@/lib/api";
import { X, Trophy, Layers, AlertTriangle, Zap } from "@/components/icons";
import {
  isSessionEarnFinalized,
  LP_SESSION_MIN_CARDS,
} from "@/lib/learn-session-lp";

const RATINGS: { key: ReviewRating; label: string; cls: string }[] = [
  { key: "again", label: "Nochmal", cls: "rating--again" },
  { key: "hard", label: "Schwer", cls: "rating--hard" },
  { key: "good", label: "Gut", cls: "rating--good" },
  { key: "easy", label: "Leicht", cls: "rating--easy" },
];

export default function LearnPage() {
  const params = useParams<{ id: string }>();
  const deckId = params.id;
  const router = useRouter();
  const { userId } = useAuth();

  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [earned, setEarned] = useState<number | null>(null);
  const [earnCapReached, setEarnCapReached] = useState(false);
  const awardedRef = useRef(false);
  const awardingRef = useRef(false);
  const pendingReviewsRef = useRef<Promise<unknown>[]>([]);

  const load = useCallback(async () => {
    if (!deckId) return;
    try {
      const { cards: c } = await listCardsInDeck(deckId);
      setCards(c);
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

  const total = cards.length;
  const current = cards[index];
  const done = !loading && total > 0 && index >= total;

  // LP fürs Lernen gutschreiben — wie die App. Der Server zählt review_logs;
  // wir warten auf laufende Review-Requests, bevor earnLp aufgerufen wird.
  const awardSession = useCallback(async (count: number) => {
    if (awardedRef.current || awardingRef.current || count < LP_SESSION_MIN_CARDS) {
      return;
    }

    awardingRef.current = true;
    try {
      const maxAttempts = 3;
      const retryDelayMs = 250;

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        if (attempt > 0) {
          await new Promise((resolve) => window.setTimeout(resolve, retryDelayMs));
        }

        await Promise.allSettled(pendingReviewsRef.current);
        pendingReviewsRef.current = [];

        const res = await earnLp("session", count);
        setEarned(res.granted);
        setEarnCapReached(res.capReached);

        if (isSessionEarnFinalized(res, count)) {
          awardedRef.current = true;
          break;
        }
      }
    } catch {
      /* LP-Gutschrift ist best-effort */
    } finally {
      awardingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (done) void awardSession(total);
  }, [done, total, awardSession]);

  function rate(rating: ReviewRating) {
    const card = cards[index];
    if (!card || !userId) return;
    if (rating === "good" || rating === "easy") setCorrect((n) => n + 1);
    const reviewPromise = reviewCard(userId, card.id, rating).catch(() => {
      /* review sync best-effort; scheduling will catch up on next load */
    });
    pendingReviewsRef.current.push(reviewPromise);
    setFlipped(false);
    window.setTimeout(() => setIndex((i) => i + 1), 160);
  }

  function restart() {
    awardedRef.current = false;
    awardingRef.current = false;
    pendingReviewsRef.current = [];
    setEarned(null);
    setEarnCapReached(false);
    setIndex(0);
    setFlipped(false);
    setCorrect(0);
  }

  async function quit() {
    // Beim frühen Beenden noch die LP der bisher gelernten Karten sichern.
    await awardSession(index);
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

  if (total === 0) {
    return (
      <div className="empty-state">
        <div className="ic" aria-hidden>
          <Layers size={30} />
        </div>
        <h3>Keine Karten zum Lernen</h3>
        <p>Füge dem Deck zuerst ein paar Karten hinzu.</p>
        <Link href={`/dashboard/deck/${deckId}`} className="btn btn-primary">
          Karten hinzufügen
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="study-wrap">
        <div className="study-done">
          <div className="big" aria-hidden style={{ color: "var(--amber)" }}>
            <Trophy size={56} />
          </div>
          <h2 className="h2">Session geschafft!</h2>
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
            <button type="button" className="btn btn-primary" onClick={restart}>
              Nochmal lernen
            </button>
            <Link href={`/dashboard/deck/${deckId}`} className="btn btn-ghost">
              Zurück zum Deck
            </Link>
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
            <span className="flip__hint">Tippen zum Umdrehen</span>
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

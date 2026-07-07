"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/app/auth-context";
import {
  listCardsInDeck,
  reviewCard,
  isApiError,
  type Card,
  type ReviewRating,
} from "@/lib/api";
import { X, Trophy, Layers, AlertTriangle } from "@/components/icons";

const RATINGS: { key: ReviewRating; label: string; cls: string }[] = [
  { key: "again", label: "Nochmal", cls: "rating--again" },
  { key: "hard", label: "Schwer", cls: "rating--hard" },
  { key: "good", label: "Gut", cls: "rating--good" },
  { key: "easy", label: "Leicht", cls: "rating--easy" },
];

export default function LearnPage() {
  const params = useParams<{ id: string }>();
  const deckId = params.id;
  const { userId } = useAuth();

  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [correct, setCorrect] = useState(0);

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

  function rate(rating: ReviewRating) {
    const card = cards[index];
    if (!card || !userId) return;
    if (rating === "good" || rating === "easy") setCorrect((n) => n + 1);
    // Fire-and-forget so the session stays snappy; FSRS updates server-side.
    reviewCard(userId, card.id, rating).catch(() => {
      /* review sync best-effort; scheduling will catch up on next load */
    });
    setFlipped(false);
    window.setTimeout(() => setIndex((i) => i + 1), 160);
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
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setIndex(0);
                setFlipped(false);
                setCorrect(0);
              }}
            >
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
        <Link href={`/dashboard/deck/${deckId}`} className="crumb" style={{ margin: 0 }}>
          <X size={16} /> Beenden
        </Link>
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

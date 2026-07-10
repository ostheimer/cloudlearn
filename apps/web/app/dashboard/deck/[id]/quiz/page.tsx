"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/app/auth-context";
import { listCardsInDeck, reviewCard, earnLp, isApiError, type Card } from "@/lib/api";
import { X, Trophy, Layers, AlertTriangle, Check, Zap } from "@/components/icons";

type Question = { cardId: string; prompt: string; correct: string; options: string[] };

// Ab so vielen beantworteten Karten schreibt der Server LP gut (featureGates).
const LP_SESSION_MIN = 5;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

// Baut pro Karte eine Frage mit der richtigen Antwort + bis zu 3 zufälligen
// falschen Antworten aus den anderen Karten des Decks.
function buildQuestions(cards: Card[]): Question[] {
  return shuffle(cards).map((card) => {
    const pool = [...new Set(cards.map((c) => c.back))].filter((b) => b !== card.back);
    const distractors = shuffle(pool).slice(0, 3);
    return {
      cardId: card.id,
      prompt: card.front,
      correct: card.back,
      options: shuffle([card.back, ...distractors]),
    };
  });
}

export default function QuizPage() {
  const params = useParams<{ id: string }>();
  const deckId = params.id;
  const router = useRouter();
  const { userId } = useAuth();

  const [cards, setCards] = useState<Card[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [earned, setEarned] = useState<number | null>(null);
  const awardedRef = useRef(false);

  const load = useCallback(async () => {
    if (!deckId) return;
    try {
      const { cards: c } = await listCardsInDeck(deckId);
      setCards(c);
      setQuestions(buildQuestions(c));
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

  const total = questions.length;
  const q = questions[index];
  const done = !loading && total > 0 && index >= total;

  const awardSession = useCallback(async (count: number) => {
    if (awardedRef.current || count < LP_SESSION_MIN) return;
    awardedRef.current = true;
    try {
      const r = await earnLp("session", count);
      setEarned(r.granted);
    } catch {
      /* LP-Gutschrift best-effort */
    }
  }, []);

  useEffect(() => {
    if (done) void awardSession(answeredCount);
  }, [done, answeredCount, awardSession]);

  function pick(opt: string) {
    if (picked !== null || !q) return;
    setPicked(opt);
    setAnsweredCount((n) => n + 1);
    const correct = opt === q.correct;
    if (correct) setScore((s) => s + 1);
    if (userId) {
      reviewCard(userId, q.cardId, correct ? "good" : "again").catch(() => {
        /* Wiederholung best-effort; FSRS holt beim nächsten Laden auf */
      });
    }
  }

  function next() {
    setPicked(null);
    setIndex((i) => i + 1);
  }

  function restart() {
    awardedRef.current = false;
    setEarned(null);
    setIndex(0);
    setPicked(null);
    setScore(0);
    setAnsweredCount(0);
    setQuestions(buildQuestions(cards));
  }

  function quit() {
    void awardSession(answeredCount);
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
          <Layers size={30} />
        </div>
        <h3>Zu wenige Karten</h3>
        <p>Für Multiple Choice braucht das Deck mindestens 2 Karten (für die Antwortoptionen).</p>
        <Link href={`/dashboard/deck/${deckId}`} className="btn btn-primary">
          Zurück zum Deck
        </Link>
      </div>
    );
  }

  if (done) {
    const pct = total > 0 ? Math.round((score / total) * 100) : 0;
    return (
      <div className="study-wrap">
        <div className="study-done">
          <div className="big" aria-hidden style={{ color: "var(--amber)" }}>
            <Trophy size={56} />
          </div>
          <h2 className="h2">Quiz geschafft!</h2>
          <p className="lead">
            {score} von {total} richtig — {pct}&nbsp;%.
          </p>
          {earned !== null && earned > 0 && (
            <span className="lp-pill">
              <Zap size={15} /> +{earned} Lernpunkte
            </span>
          )}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
            <button type="button" className="btn btn-primary" onClick={restart}>
              Nochmal
            </button>
            <Link href={`/dashboard/deck/${deckId}`} className="btn btn-ghost">
              Zurück zum Deck
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const answered = picked !== null;

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

      <div className="quiz-q">{q?.prompt}</div>

      <div className="quiz-options">
        {q?.options.map((opt) => {
          const isCorrect = opt === q.correct;
          const isPicked = opt === picked;
          let cls = "quiz-opt";
          if (answered && isCorrect) cls += " quiz-opt--correct";
          else if (answered && isPicked) cls += " quiz-opt--wrong";
          return (
            <button
              key={opt}
              type="button"
              className={cls}
              disabled={answered}
              onClick={() => pick(opt)}
            >
              <span>{opt}</span>
              {answered && isCorrect && <Check size={18} className="quiz-opt__mark" />}
              {answered && isPicked && !isCorrect && <X size={18} className="quiz-opt__mark" />}
            </button>
          );
        })}
      </div>

      {answered && (
        <div className="center" style={{ marginTop: 20 }}>
          <button type="button" className="btn btn-primary btn-lg" onClick={next}>
            {index + 1 >= total ? "Ergebnis" : "Weiter"}
          </button>
        </div>
      )}
    </div>
  );
}

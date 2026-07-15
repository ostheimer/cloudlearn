"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/app/auth-context";
import { listCardsInDeck, earnLp, isApiError, type Card } from "@/lib/api";
import {
  ArrowLeft,
  X,
  Match,
  Clock,
  Trophy,
  CheckCircle,
  RotateCw,
  Zap,
  Star,
  StarFilled,
  AlertTriangle,
} from "@/components/icons";

const MAX_PAIRS = 6;
// Ab so vielen Paaren schreibt der Server LP gut (wie learn/quiz/cloze).
const LP_SESSION_MIN = 5;

type Tile = { id: string; text: string; cardId: string; side: "front" | "back" };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const x = s % 60;
  return `${m}:${x.toString().padStart(2, "0")}`;
}

const bestKey = (deckId: string) => `clearn:zuordnen:best:${deckId}`;

export default function MatchPage() {
  const params = useParams<{ id: string }>();
  const deckId = params.id;
  const router = useRouter();
  const { userId } = useAuth();

  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [timed, setTimed] = useState(false);
  const [bestTime, setBestTime] = useState<number | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);

  const [phase, setPhase] = useState<"setup" | "playing" | "finished">("setup");
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [selected, setSelected] = useState<Tile | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [wrong, setWrong] = useState<[string, string] | null>(null);
  const [errors, setErrors] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  // Karten-IDs der Paare, die mindestens einmal falsch zugeordnet wurden
  // („nicht gewusst"). Für die Wiederholung nur dieser Paare.
  const [missedIds, setMissedIds] = useState<Set<string>>(new Set());

  const [earned, setEarned] = useState<number | null>(null);
  const awardedRef = useRef(false);

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
      const v = window.localStorage.getItem(bestKey(deckId));
      const n = v ? parseInt(v, 10) : NaN;
      if (!Number.isNaN(n)) setBestTime(n);
    } catch {
      /* localStorage nicht verfügbar */
    }
  }, [deckId]);

  useEffect(() => {
    load();
  }, [load]);

  const pairCount = Math.min(MAX_PAIRS, cards.length);
  const gamePairs = tiles.length / 2;

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

  const startGameWith = useCallback(
    (sourceCards: Card[], withTimer: boolean) => {
      const selectedCards = shuffle(sourceCards).slice(
        0,
        Math.min(MAX_PAIRS, sourceCards.length)
      );
      const newTiles: Tile[] = [];
      for (const card of selectedCards) {
        newTiles.push({
          id: `${card.id}-front`,
          text: (card.front || "").trim(),
          cardId: card.id,
          side: "front",
        });
        newTiles.push({
          id: `${card.id}-back`,
          text: (card.back || "").trim(),
          cardId: card.id,
          side: "back",
        });
      }
      setTiles(shuffle(newTiles));
      setSelected(null);
      setMatched(new Set());
      setWrong(null);
      setErrors(0);
      setElapsed(0);
      setMissedIds(new Set());
      setIsNewBest(false);
      awardedRef.current = false;
      setEarned(null);
      setTimed(withTimer);
      setPhase("playing");
    },
    []
  );

  const startGame = useCallback(
    (withTimer: boolean) => startGameWith(cards, withTimer),
    [cards, startGameWith]
  );

  // Stoppuhr — läuft nur im Zeit-Modus während des Spiels.
  useEffect(() => {
    if (phase !== "playing" || !timed) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [phase, timed]);

  // Abschluss erkennen: Bestzeit merken, LP gutschreiben, Ergebnis zeigen.
  useEffect(() => {
    if (phase !== "playing" || tiles.length === 0 || matched.size !== tiles.length) return;
    if (timed) {
      if (bestTime == null || elapsed < bestTime) {
        setBestTime(elapsed);
        setIsNewBest(true);
        try {
          window.localStorage.setItem(bestKey(deckId), String(elapsed));
        } catch {
          /* egal */
        }
      }
    }
    void awardSession(tiles.length / 2);
    setPhase("finished");
  }, [matched, tiles.length, phase, timed, elapsed, bestTime, deckId, awardSession]);

  function tap(tile: Tile) {
    if (matched.has(tile.id) || wrong) return;
    if (!selected) {
      setSelected(tile);
      return;
    }
    if (selected.id === tile.id) {
      setSelected(null);
      return;
    }
    if (selected.cardId === tile.cardId && selected.side !== tile.side) {
      setMatched((prev) => {
        const next = new Set(prev);
        next.add(selected.id);
        next.add(tile.id);
        return next;
      });
      setSelected(null);
    } else {
      setErrors((e) => e + 1);
      setWrong([selected.id, tile.id]);
      // Beide beteiligten Paare als „nicht gewusst" merken.
      setMissedIds((prev) => {
        const next = new Set(prev);
        next.add(selected.cardId);
        next.add(tile.cardId);
        return next;
      });
      setTimeout(() => {
        setWrong(null);
        setSelected(null);
      }, 600);
    }
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
          <Match size={30} />
        </div>
        <h3>Zu wenige Karten</h3>
        <p>Zum Zuordnen braucht das Deck mindestens 2 Karten.</p>
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
            style={{ background: "rgba(59,130,246,0.14)", color: "var(--info)" }}
          >
            <Match size={30} />
          </span>
          <h1 className="h2">Zuordnen</h1>
          <p className="muted">{pairCount} Paare zuordnen</p>
        </div>

        <div className="cl-optcard">
          <div className="cl-row">
            <div>
              <div className="cl-row__t">Auf Zeit</div>
              <div className="cl-row__s">
                {timed
                  ? "Stoppuhr läuft mit — schlag deine Bestzeit"
                  : "Entspannt üben, ohne Zeitdruck"}
              </div>
            </div>
            <button
              type="button"
              className={`cl-switch${timed ? " on" : ""}`}
              role="switch"
              aria-checked={timed}
              aria-label="Auf Zeit"
              onClick={() => setTimed((t) => !t)}
            >
              <i />
            </button>
          </div>
        </div>

        {bestTime != null && (
          <div className="cl-optcard">
            <div className="zu-best">
              <span style={{ color: "var(--amber)", flex: "none", display: "grid" }} aria-hidden>
                <Trophy size={18} />
              </span>
              <span className="zu-best__t">Deine Bestzeit</span>
              <b style={{ fontVariantNumeric: "tabular-nums" }}>{formatTime(bestTime)}</b>
            </div>
          </div>
        )}

        <button
          type="button"
          className="btn btn-primary btn-lg btn-block"
          onClick={() => startGame(timed)}
        >
          Starten
        </button>
      </div>
    );
  }

  // ---------- Ergebnis ----------
  if (phase === "finished") {
    const stars = errors === 0 ? 3 : errors <= 2 ? 2 : errors <= 4 ? 1 : 0;
    // „Nicht gewusst" = Paare mit mindestens einem Fehlversuch. Zuordnen braucht
    // mindestens 2 Paare, darum nur ab 2 offenen Paaren anbieten.
    const notKnownCards = cards.filter((c) => missedIds.has(c.id));
    const showSubset = notKnownCards.length >= 2;
    return (
      <div className="study-wrap">
        <div className="study-done">
          <div className="big" aria-hidden style={{ color: "var(--green)" }}>
            {timed ? <Trophy size={54} /> : <CheckCircle size={54} />}
          </div>
          <div
            style={{
              fontSize: "2.4rem",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {timed ? formatTime(elapsed) : "Geschafft!"}
          </div>
          {timed && isNewBest && (
            <span className="lp-pill">
              <Trophy size={15} /> Neue Bestzeit!
            </span>
          )}
          <div className="zu-stars" aria-label={`${stars} von 3 Sternen`}>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                aria-hidden
                style={{ color: i < stars ? "var(--amber)" : "var(--line)" }}
              >
                {i < stars ? <StarFilled size={28} /> : <Star size={28} />}
              </span>
            ))}
          </div>
          <p className="lead" style={{ margin: 0 }}>
            {gamePairs} Paare zugeordnet
          </p>
          <p style={{ margin: 0, fontWeight: 700, color: errors === 0 ? "var(--green)" : "#ef4444" }}>
            {errors === 0 ? "Keine Fehler!" : `${errors} Fehler`}
          </p>
          {timed && !isNewBest && bestTime != null && (
            <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
              Bestzeit: {formatTime(bestTime)}
            </p>
          )}
          {earned !== null && earned > 0 && (
            <span className="lp-pill">
              <Zap size={15} /> +{earned} Lernpunkte
            </span>
          )}
          <div style={{ display: "grid", gap: 8, width: "100%", maxWidth: 320 }}>
            {showSubset && (
              <button
                type="button"
                className="btn btn-primary btn-block"
                onClick={() => startGameWith(notKnownCards, timed)}
              >
                <RotateCw size={18} /> Nur nicht gewusste ({notKnownCards.length})
              </button>
            )}
            <button
              type="button"
              className={`btn btn-block ${showSubset ? "btn-ghost" : "btn-primary"}`}
              onClick={() => startGame(timed)}
            >
              <RotateCw size={18} /> {showSubset ? "Nochmal alle" : "Nochmal"}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-block"
              style={{ border: "none", boxShadow: "none" }}
              onClick={() => setPhase("setup")}
            >
              Einstellungen
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Spielen ----------
  const pairs = matched.size / 2;
  return (
    <div className="study-wrap">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button
          type="button"
          className="crumb"
          style={{ margin: 0, background: "none", border: "none", cursor: "pointer" }}
          onClick={() => {
            setPhase("setup");
          }}
        >
          <X size={16} /> Abbrechen
        </button>
      </div>

      <div className="zu-statbar">
        <span className={`zu-statbar__l${timed ? "" : " mut"}`}>
          {timed ? <Clock size={16} /> : <Match size={16} />}
          <span>{timed ? formatTime(elapsed) : "Üben"}</span>
        </span>
        <span className="zu-statbar__m">
          {pairs} / {gamePairs} Paare
        </span>
        <span
          className="zu-statbar__e"
          style={{ color: errors > 0 ? "#ef4444" : "var(--ink-3)" }}
        >
          {errors} Fehler
        </span>
      </div>

      <div className="zu-grid">
        {tiles.map((tile) => {
          const isMatched = matched.has(tile.id);
          const isSelected = selected?.id === tile.id;
          const isWrong = wrong?.includes(tile.id);
          let cls = "zu-tile";
          if (isMatched) cls += " zu-tile--matched";
          else if (isWrong) cls += " zu-tile--wrong";
          else if (isSelected) cls += " zu-tile--sel";
          return (
            <button
              key={tile.id}
              type="button"
              className={cls}
              disabled={isMatched}
              onClick={() => tap(tile)}
            >
              <span className={`zu-dot zu-dot--${tile.side}`} aria-hidden />
              <span>{tile.text}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
